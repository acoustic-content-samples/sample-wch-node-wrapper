/*
 * Copyright 2016  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
'use strict';
//////////////////////////////
// WCH Node API Connector
//////////////////////////////

/// This connector provides generall access to the search API for WCH.
/// There are high level methods to access the different content types
/// and add common search patterns to the query.

const rp = require('request-promise'),
      Promise = require('bluebird'),
      Queue = require('promise-queue'),
      fs = Promise.promisifyAll(require('fs')),
      path = require('path'),
      crypto = require('crypto'),
      mime = require('mime-types');

let debug = false;
const errLogger = err => {if (debug) console.error("Error: ", err); throw err;}

// Immutable connection endpoints to WCH.
const wchEndpoints = require('./wchConnectionEndpoints');

/**
 * In case of error try to login again. This is a quick-fix. More sophistiacted would be 
 * to obseve the expiry date of the authentication cookie... clearly a TODO.
 * @param  {Object} options - Request-Promise options Object(value?: any)
 * @return {Promise} - Waiting for the response
 */
function send(options, retryHandling) {
  return rp(options).
         catch(errLogger).
         catch(err => retryHandling(err).then(() => rp(options)));
}

/**
 * Checks the current configuration for authoring environment
 * @param  {Object}  configuration - The connector config
 * @return {Boolean} - true if its authoring, otherwise false
 */
function isAuthoring(configuration) {
  return configuration.endpoint === 'authoring'
}

/**
 * Simple solr special char escaper. Based on 
 * https://cwiki.apache.org/confluence/display/solr/The+Standard+Query+Parser
 * @param  {String} str - The string to escape
 * @return {String} - The same string with all special solr chars escaped with '\'
 */
function escapeSolrChars(str) {
  const solrChars = /(\+|\-|\!|\(|\)|\{|\}|\[|\]|\^|\"|\~|\*|\?|\:|\/|\&{2}|\|{2}|\s)/gm;
  return str.replace(solrChars, (match) => match.replace(/(.)/gm, '\\$1') );
}

/**
 * Class for API access towards Watson Content Hub. ES6 Classes style.
 */
class WchSDK {
  /**
   * Initalizes the connection to WCH. This module is designed to be
   * instanciated multiple times. E.g. for logged in and anonymous uses 
   * in parallel.
   *
   * @param  {Object} configuration - Config options for WCH
   * @return {Class} - Initalized SDK ready to query for content
   */
  constructor (configuration) {
    // Init config with default
    this.configuration = Object.assign({
      endpoint: 'delivery',
      rejectUnauthorized: true,
      maxSockets: 50
    }, configuration);

    this.endpoint = wchEndpoints[this.configuration.endpoint];
    // Request-promise module default options
    this.cookieJar = rp.jar();
    this.options = {
          baseUrl: `${this.endpoint.baseUrl}/${this.configuration.tenantid}`,
          uri: this.endpoint.uri_search,
          qsStringifyOptions: {encode:true},
          agentOptions: {
            rejectUnauthorized: this.configuration.rejectUnauthorized
          },
          jar: this.cookieJar,
          json: true,
          pool: {
            maxSockets: this.configuration.maxSockets,
            keepAlive: true
          }
      };

    let creds = this.configuration.credentials;
    this.loginstatus = (creds) ? this.dologin(creds) : Promise.resolve();

    this.retryHandler = error => {
      if(error.statusCode === '403') {
        console.log('Auhtentication failed... try login again,');
        this.loginstatus = this.dologin(creds);
      }
      return this.loginstatus;
    };
  }

  /**
   * @return {Boolean} - True if the connector targets delivery system, otherwise false.
   */
  isPublishContext() {
    return this.configuration.endpoint === 'delivery';
  }

  /**
   * Login to WCH as authenticated user.
   * @param  {Object} credentials - Containing username and password
   * @param  {String} [credentials.usrname] - The blueid for an admin user
   * @param  {String} [credentials.pwd] - The password to the admin user
   * @return {Promise} - Promise resolves with a status indicating success or failure
   */
  dologin(credentials) {
    let username = credentials.usrname,
        pwd = credentials.pwd;

    let request = Object.assign({}, 
      this.options, 
      {
        uri: this.endpoint.uri_auth,
        auth: {
          user: credentials.usrname,
          pass: credentials.pwd
        }
    });
    let loginstatus = rp(request).promise();
    loginstatus.catch(() => console.log("Login failed..."));
    return loginstatus;
  }

  /**
   * Convenience method to create valid delivery urls to asset resources.
   * @param  {Object} options - Options on how to generate the delivery Urls.
   * @param  {String} urlType - Defines the URL type. Valid options are `id`, `path` and `akami`. Default type is id.
   * @param  {Object} queryParams - Refines the query to match for a specific set of assets. All params as in `doSearch` are allowed expect for query and fields. 
   * @return {Promise} Resolves with an array of url strings, or just a string when there is only one result. 
   */
  getResourceDeliveryUrls(options) {
    let _options = options || {};
    let urlType = _options.urlType || 'id';
    let urlTypes = {
      id: {
        field:'resource',
        transform: (baseUrl, tenantid, element, path) => `${baseUrl}/api/${tenantid}${path}/${element.resource}`
      },
      path: {
        field:'path',
        transform: (baseUrl, tenantid, element, path) => {
          return `${baseUrl}/api/${tenantid}${path}?path=${element.path}`;
        }
      },
      akami: {
        field:'path',
        transform: (baseUrl, tenantid, element, path) => {
          return `${baseUrl}/${tenantid}${element.path}`;
        }
      }
    }
    let searchQry = Object.
    assign(
      {}, 
      _options.queryParams, 
      {
        query: 'classification:asset',
        fields: urlTypes[urlType].field
      }
    );
    return this.doSearch(searchQry).
      then(result => result.documents).
      map(doc => urlTypes[urlType].transform(wchEndpoints.delivery.akamiUrl, this.configuration.tenantid, doc, wchEndpoints.delivery.uri_resource)).
      then(urlList => (urlList.length === 1) ? urlList[0] : urlList);
  }

  /**
   * Getter for content type definitions. Simple wrapper around search API. 
   * All params allowed as in doSearch except for query which is predefined.
   * @param  {Object} queryParams - The params object to build a query. Not all params are supported yet!
   * @param  {String} queryParams.fields - The fields returned from the search. Default are all fields.
   * @param  {String} queryParams.facetquery - Query to filter the main result. Cachable. Default is none.
   * @param  {Number} queryParams.amount - Amount of results returned. Default is 10 elements.
   * @param  {String} queryParams.sort - The order in which results are returned.
   * @param  {Number} queryParams.start - The first element in order to be returned.
   * @return {Promise} - Resolves when the search finished.
   */
  getContentTypeDefinitions(options) {
    let searchQry = Object.
      assign(
        {}, 
        options, 
        {query: 'classification:content-type'}
      );
    return this.doSearch(searchQry);
  }

  /**
   * Search API access. This should be your go to point when retrieving ANYTHING from 
   * Content Hub. Why? Because Search API will be available on authoring and delivery soon.
   * Other convinience APIs like /authoring/v1/assets not so much. 
   * @param  {Object} queryParams - The params object to build a query. Not all params are supported yet!
   * @param  {String} queryParams.query - The main query. Must be a valid SOLR query. Required. Default is all content.
   * @param  {String} queryParams.fields - The fields returned from the search. Default are all fields.
   * @param  {Number} queryParams.amount - Amount of results returned. Default is 10 elements.
   * @param  {String} queryParams.sort - The order in which results are returned.
   * @param  {Number} queryParams.start - The first element in order to be returned.
   * @param  {String} queryParams.facetquery - Query to filter the main result. Cachable. Default is none.
   * @param  {Bool}   queryParams.isManaged - If true the result set only contains on managed elements. If set to false on unmanaged elements are returned. (Only Managed elements are visible in the authoring UI) Default are all elements. No difference between managed an unmanaged.
   * @return {Promise} - Resolves when the search finished.
   */
  doSearch(queryParams) {
    // General standard query variables
    let _query = queryParams.query || '*:*';
    let _fields = queryParams.fields || '*';
    let _amount = ('amount' in queryParams) ? queryParams.amount : 10;
    let _sort = queryParams.sort || '';
    let _start = queryParams.start || 0;
    let _fq = queryParams.facetquery || '';
    // Edismax main parser variables
    let _useEdismax = 'edismax' in queryParams;
    let _defType = (_useEdismax) ? 'edismax' : 'lucene';
    let _qf = (_useEdismax) ? queryParams.edismax.queryFields : undefined;
    // Facet specific variables
    let _useFacets = queryParams.facet !== undefined;
    let _facet = queryParams.facet || {};
    let _facetFields = _facet.fields || [];
    let _facetMincount = _facet.mincount || 0;
    let _facetLimit = _facet.limit || 10;
    let _facetContains = _facet.contains || {};
    let _facetContainsText = _facetContains.text || undefined; 
    let _facetContainsIgnoreCase = _facetContains.ignoreCase || undefined;
    // WCH specific variables
    let _isManaged = ('isManaged' in queryParams) ? `isManaged:("${queryParams.isManaged}")` : '';
    
    return this.loginstatus.
      then(() => Object.assign({},
        this.options,
        {
          qs: {
            q: _query,
            fl: _fields,
            fq: new Array().concat(_fq, _isManaged),
            rows: _amount,
            sort: _sort,
            start: _start,
            defType: _defType,
            qf: _qf,
            facet: _useFacets,
            'facet.contains': _facetContainsText,
            'facet.contains.ignoreCase': _facetContainsIgnoreCase, 
            'facet.mincount': _facetMincount,
            'facet.limit': _facetLimit,
            'facet.field' : _facetFields
          },
          useQuerystring: true
        })).
      then(options => send(options, this.retryHandler));
  }

  /*----------  Convinience Methods for Search Queries  ----------*/
  
  getContentById(type, id, filter) {
    var _type = escapeSolrChars(type) || '',
        _id = escapeSolrChars(id) || '',
        _filter = filter || '';
    return this.doSearch({
            query: `id:${_filter}${_type}\\:${_id}`,
            amount: 1
        });
  }

  getAllAssetsAndContent(filter, amount, sortAsc) {
    var _filter = (filter) ? ' '+filter : '',
        _sort = `lastModified ${(sortAsc) ? 'asc' : 'desc'}`;
    return this.doSearch({
      query: '*:*',
      facetquery: _filter, 
      amount: amount,
      sort: _sort
    });
  }

  getAllContentOfType(type, amount, sortAsc, start) {
    var _filter = (type) ? ' AND type:'+type : '',
        _sort = `lastModified ${(sortAsc) ? 'asc' : 'desc'}`;

    return this.doSearch({
      query: `classification:content${_filter}`, 
      amount: amount,
      sort: _sort,
      start: start
    });
  }

  getImageProfileWithName(name) {
    var _filter = (name) ? ' AND name:'+name : '';
    return this.doSearch({
      query: `classification:image-profile${_filter}`, 
      amount: 1
    });
  }

}

/**
 * Class containing all authoring only API methods. Rule of thumb: All create, update & delete
 * methods are only available in authoring.
 */
class WchAuthoringSDK extends WchSDK {

  /**
   * Create a resource with the given filename. Fallback is resource name. You can also decide to get a random
   * ID if you dont care through the matching param.
   * @param  {Object}  options - The settings required to upload a resource
   * @param  {String}  [options.filePath] - Path to the resource file on system.
   * @param  {String}  [options.fileName] - Name of the file inside of WCH. Filename is the unique id of this resource.
   * @param  {Boolean} [options.randomId] - Define if ID of the resource is based on the filename or a random UUID.
   * @return {Promise} - Resolves with the response body when the resource is created
   */
  createResource(options) {
    if(!options.filePath) new Error('Need a file to upload');
    let _randomId = options.randomId || false;
    let _fileName = options.fileName || options.filePath;
    let extractedExtname = path.basename(_fileName, path.extname(_fileName));
    let contentType = mime.lookup(path.extname(options.filePath));
    let resourceId = (_randomId) ? '' : `/${extractedExtname}`;
    return this.loginstatus.
      then(() => fs.readFileAsync(options.filePath)).
      then(fileBuffer => Object.assign({},
        this.options, 
        {
          uri: `${this.endpoint.uri_resource}${resourceId}`,
          method: (_randomId) ? 'POST': 'PUT',
          headers: {
            'Content-Type': contentType
          },
          qs: {
            name: path.basename(options.filePath),
            md5: crypto.createHash('md5').update(fileBuffer).digest('base64')
          },
          body: fileBuffer,
          json: false
        })
      ).
      then(options => send(options, this.retryHandler)).
      then(data => data || { id : extractedExtname });
  }

  /**
   * Create a new asset definition.
   * @param  {Object} assetDef - The asset JSON definition
   * @param  {String} assetDef.id - The id of the new assset
   * @param  {Object} assetDef.tags - Tag structure of assets. Consists of active, declined and watson tags.
   * @param  {Array}  assetDef.tags.values - String array with active tags for this asset. 
   * @param  {Array}  assetDef.tags.declined - String array with declined tags for this asset.
   * @param  {Array}  assetDef.tags.analysis - String array with tags from watson.
   * @param  {String} assetDef.description - Description of the asset to be uploaded
   * @param  {String} assetDef.name - The visible name of this asset for authoring UI.
   * @param  {String} assetDef.resource - The resource ID to the binary file this asset references.
   * @param  {Path}   assetDef.path - When this attribute is set the asset is handled as a web asset and not visible in the authoring UI.
   * @return {Promise} - Resolves when the asset is created
   */
  createAsset(assetDef) {
    if(!assetDef) new Error('Need a asset definition to upload');
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: this.endpoint.uri_assets,
          method: 'POST',
          qs: {
            analyze: true, // These two parameters define if watson tagging is active...
            autocurate: false // ... and if all tags are accepted automatically
          },
          body: assetDef
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  /**
   * Updates an existing asset. The id of the assetDef has to match an existing asset.
   * @param  {Object} assetDef - The asset JSON definition
   * @param  {String} assetDef.id - The id of the new assset
   * @param  {Object} assetDef.tags - Tag structure of assets. Consists of active, declined and watson tags.
   * @param  {Array}  assetDef.tags.values - String array with active tags for this asset. 
   * @param  {Array}  assetDef.tags.declined - String array with declined tags for this asset.
   * @param  {Array}  assetDef.tags.analysis - String array with tags from watson.
   * @param  {String} assetDef.description - Description of the asset to be uploaded
   * @param  {String} assetDef.name - The visible name of this asset for authoring UI.
   * @param  {String} assetDef.resource - The resource ID to the binary file this asset references.
   * @param  {Path}   assetDef.path - When this attribute is set the asset is handled as a web asset and not visible in the authoring UI.
   * @return {Promise} - Resolves when the asset is created
   */
  updateAsset(assetDef) {
    if(!assetDef) new Error('Need a asset definition to upload');
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: `${this.endpoint.uri_assets}/${assetDef.id}`,
          method: 'PUT',
          qs: {
            analyze: true
          },
          body: assetDef
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  /**
   * Convinience method which uploads and creates a resource and afterwards an asset definition.
   * @param  {String} options - Options for asset upload.
   * @param  {String} [options.filePath] - Path to the file
   * @param  {String} [options.fileName] - Name of the file
   * @param  {Object} [options.assetDef] - The asset JSON definition
   * @param  {String} [options.assetDef.id] - The id of the new assset
   * @param  {Object} [options.assetDef.tags] - Tag structure of assets. Consists of active, declined and watson tags.
   * @param  {Array}  [options.assetDef.tags.values] - String array with active tags for this asset. 
   * @param  {Array}  [options.assetDef.tags.declined] - String array with declined tags for this asset.
   * @param  {Array}  [options.assetDef.tags.analysis] - String array with tags from watson.
   * @param  {String} [options.assetDef.description] - Description of the asset to be uploaded
   * @param  {String} [options.assetDef.name] - The visible name of this asset for authoring UI.
   * @param  {Path}   [options.assetDef.path] - When this attribute is set the asset is handled as a web asset and not visible in the authoring UI.
   * @param  {Array}  [options.assetDef.categoryIds] - String Array containing Categoriy IDs
   * @return {Promise} - Resolves when the asset & resource is created
   */
  uploadAsset(options) {
    return this.createResource(options.resourceDef).
      then(resourceResp => (typeof resourceResp === 'string') ? JSON.parse(resourceResp) : resourceResp).
      then(resourceResp => Object.assign(
        {},
        options.assetDef, 
        {
          tags: { // Remember: Deep Cloning.
            values:   options.assetDef.tags.values.splice(0),
            declined: options.assetDef.tags.declined.splice(0),
            analysis: options.assetDef.tags.analysis
          },
          resource: resourceResp.id
        })).
      then(asset => this.createAsset(asset));
  }

  /**
   * Creates a new content type based on the definition. Recommendation: Use authoring UI. A content type
   * becomes complicated fast!
   * @param  {Object} typeDefinition - JSON Object representing the content type definition
   * @return {Promise} - Resolves when the content type is created
   */
  createContentType(typeDefinition) {
    return this.loginstatus.
       then(() => Object.assign({},
        this.options, 
        {
          uri: this.endpoint.uri_types,
          method: 'POST',
          body: typeDefinition
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  /**
   * Updates an existing content type. If somebody alters the definition 
   * before you update your changes this method fails. You can only update
   * the most current version known to WCH. Recommendation: Use authoring UI. A content type
   * becomes complicated fast!
   * @param  {Object} typeDefinition - JSON Object representing the content type definition
   * @return {Promise} - Resolves when the content type is updated
   */
  updateContentType(typeDefinition) {
    return this.loginstatus.
       then(() => Object.assign({},
        this.options, 
        {
          uri: this.endpoint.uri_types+'/'+typeDefinition.id,
          method: 'PUT',
          body: typeDefinition
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  /**
   * Deletes a single asset based on it's id.
   * @param  {String} assetId - The WCH unique Asset ID
   * @return {Promise} - Resolved after the resource was deleted
   */
  deleteAsset(assetId) {
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: this.endpoint.uri_assets+'/'+assetId,
          method: 'DELETE'
        })
      ).
      then(options => send(options, this.retryHandler)).
      then(() => `Deleted ${assetId} succesfully.`).
      catch(errLogger).
      catch(err => `An error occured deleting ${assetId}: Status ${err.statusCode}. Enable debugging for details.`);
  }

  /**
   * Deletes the specified amount of assets matching the query.
   * @param  {String}  query  - Facet query specifing the assets to be deleted
   * @param  {Integer} amount - Amount of elements that will be deleted
   * @return {Promise} - Resolves when all assets are deleted
   */
  deleteAssets(query, amount) {
    let parallelDeletes = Math.ceil(this.configuration.maxSockets / 5); // Use 1/5th of the connections in parallel
    let amtEle = amount || 100;
    let queue = new Queue(parallelDeletes, amtEle);
    let qryParams = {query: `classification:asset`, facetquery: query, fields:'id', amount: amtEle};
    return this.doSearch(qryParams).
            then(data => (data.documents) ? data.documents : []).
            map(document => (document.id.startsWith('asset:')) ? document.id.substring('asset:'.length) : document.id).
            map(docId => queue.add(() => this.deleteAsset(docId)))
            .all();
  }

  /**
   * Returns a list of all child categories based on the given ID. The given ID is not included in the 
   * searchresult.
   * @param  {String}  categoryId - UUID of the category to search for
   * @param  {Object}  config - Config on what to retrieve.
   * @param  {Boolean} config.recurse - If true it will also include children of children, if false only direct childs are returned
   * @param  {Number}  config.limit - How many items are returned max.
   * @param  {Number}  config.offset - Where to start returning. Useful for pagination.   
   * @return {Promse} - Resolves when the category tree was retrieved.
   */
  getCategoryTree(categoryId, config) {
    let _config = config || {};
    let recurse = _config.recurse || true;
    let limit = _config.limit || 100;
    let offset = _config.offset || 0;

    return this.loginstatus.
      then(() => Object.assign({},
        this.options, 
        { uri: `${this.endpoint.uri_categories}/${categoryId}/children`,
          method: 'GET',
          qs: {
            recurse: true,
            limit: 100,
            offset: 0
          }
        })
      ).
      then(options => send(options, this.retryHandler))
  }

  /**
   * Creates a new category element. If the parent is empty this will
   * create a taxonomy. 
   * @param  {Object} categoryDef - The category definition
   * @param  {String} [name] - The name of the category
   * @param  {String} [parent] - The id of the parent category. 
   * @return {Promise} - Resolves when the category was created
   */
  createCategory(categoryDef) {
    return this.loginstatus.
      then(() => Object.assign({},
        this.options, 
        { uri: this.endpoint.uri_categories,
          method: 'POST',
          body: categoryDef
        })).
      then(options => send(options, this.retryHandler));
  }

  /**
   * Deletes a category item all all its children.
   * @param  {String} categoryId - The uniue id of the category item to delete
   * @return {Promis} - Resolves when the element is deleted.
   */
  deleteCategory(categoryId) {
    return this.loginstatus.
      then(() => Object.assign({},
        this.options, 
        { uri: `${this.endpoint.uri_categories}/${categoryId}`,
          method: 'DELETE'
        })
      ).
      then(options => send(options, this.retryHandler)).
      catch(errLogger);
  }

  /* Convinience method to create taxonomies. */
  createCategoryLvl(taxonomyLvl, categoryMap) {
    return new Promise((resolve, reject) => {
      if(taxonomyLvl.name) {
        this.createCategory({name:taxonomyLvl.name}).
        then(result => categoryMap.set(taxonomyLvl.name, result.id)).
        then(() => taxonomyLvl.childs).
        map(child => this.createCategory({name:child, parent: categoryMap.get(taxonomyLvl.name)})).
        map(result => categoryMap.set(result.name, result.id)).
        then(resolve).
        catch(reject); 
      } else {
        Promise.resolve(taxonomyLvl.childs).
        map(child => this.createCategory({name:child, parent: categoryMap.get(taxonomyLvl.parent)})).
        map(result => categoryMap.set(result.name, result.id)).
        then(resolve).
        catch(reject);
      }
    });
  }

  /**
   * Creates a complete taxonomy based on a json definition file. It's also possible to define multiple 
   * taxonomies in the same file. Make sure that the names are exclusive inside a single taxonomy. 
   * @param  {Array}  taxonomyDefinition - Object Array. Each Object represents a level inside a taxonomy.
   * @param  {Object} taxonomyLvl - Represents either the root of a taxonomy or a level inisde a taxonomy. Stored inside the taxonomyDefinition.
   * @param  {String} name  - Indicates the start/name of a taxonomy. If name is present the parent attribute will be ignored.
   * @param  {String} parent - Reference to the parent category. Will internally mapped to the category ID.
   * @param  {Array} childs - String Array containing the names of the categories on this level. 
   * @return {Promise} - Resolves when the taxonomy is completly created.
   */
  createTaxonomies(taxonomyDefinition) {
    let nameMap = new Map();
    return Promise.resolve(taxonomyDefinition).
    each(taxonomyLvl => this.createCategoryLvl(taxonomyLvl, nameMap));
  }

  /**
   * Deletes all taxonomies matched by this query. If the query is empty all taxonomies will get deleted.
   * @param  {String} query - A valid solr facet query element specifing the taxonomies to delete. 
   * @param  {Number} amount - the amount of matched elements to get deleted.
   * @return {Promise} - Resolves when all matched elements are deleted. 
   */
  deleteTaxonomies(query, amount) {
    let amtEle = amount || 100;
    let qryParams = {query: 'classification:taxonomy', facetquery: query, fields:'id', amount: amtEle};
    return this.doSearch(qryParams).
      then(data => (data.documents) ? data.documents : []).
      map(document => (document.id.startsWith('taxonomy:')) ? document.id.substring('taxonomy:'.length) : document.id).
      map(id => this.deleteCategory(id)).
      all();
  }

} 

/**
 * Initalization of the wch connector.
 * @param  {Object} config - Optional parameter with credentials and default settings
 * @return {Object} - Wrapper to common API calls towards Watson Content Hub
 */
module.exports = function(config) {
  return (config.endpoint === 'delivery') ? new WchSDK(config) : new WchAuthoringSDK(config);
}