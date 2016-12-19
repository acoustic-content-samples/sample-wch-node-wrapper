'use strict';
//////////////////////////////
// WCH Node API Connector
//////////////////////////////

/// This connector provides generall access to the search API for WCH.
/// There are high level methods to access the different content types
/// and add common search patterns to the query.

const rp = require('request-promise'),
      Promise = require('bluebird'),
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
  return rp(options)
        .catch(errLogger)
        .catch(err => retryHandling(err).then(() => rp(options)));
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
      endpoint: 'publishing',
      rejectUnauthorized: true
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
          json: true
      };

    let creds = this.configuration.credentials;
    this.loginstatus = (creds) ? this.dologin(creds) : Promise.resolve();

    this.retryHandler = error => {
      this.loginstatus = this.dologin(creds);
      return this.loginstatus;
    };
  }

  /**
   * @return {Boolean} - True if the connector targets publish system, otherwise false.
   */
  isPublishContext() {
    return this.configuration.endpoint === 'publishing';
  }

  /**
   * Login to WCH as authenticated user.
   * @param  {Object} credentials - Containing username and password
   * @param  {String} [credentials.usrname] - The blueid for an admin user
   * @param  {String} [credentials.pwd] - The password to the admin user
   * @return {Promise} - Promise indicating success or failure
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
   * Create a resource with the given filename. Fallback is resource name. You can also decide to get a random
   * ID if you dont care through the matching param.
   * @param  {Object}  options - The settings required to upload a resource
   * @param  {String}  [options.filePath] - Path to the resource file on system.
   * @param  {String}  [options.fileName] - Name of the file inside of WCH. Filename is the unique id of this resource.
   * @param  {Boolean} [options.randomId] - Define if ID of the resource is based on the filename or a random UUID.
   * @return {Promise} - Resolves when the resource is created
   */
  createResource(options) {
    if(!isAuthoring(this.configuration)) new Error('Resource Upload not supported on delivery!');
    if(!options.filePath) new Error('Need a file to upload');
    let _randomId = options.randomId || false;
    let _fileName = options.fileName || options.filePath;
    let contentType = mime.lookup(path.extname(options.filePath));
    let resourceId = (_randomId) ? '' : '/'+path.basename(_fileName, path.extname(_fileName));
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
            md5: (_randomId) ? '' : crypto.createHash('md5').update(fileBuffer).digest('base64')
          },
          body: fileBuffer,
          json: false
        })
      ).
      then(options => send(options, this.retryHandler)).
      then(data => data || {"id": path.basename(_fileName, path.extname(_fileName))});
  }

  /**
   * Deletes a single asset based on it's id.
   * @param  {String} assetId - The WCH unique Asset ID
   * @return {Promise} - Resolved after the resource was deleted
   */
  deleteAsset(assetId) {
    if(!isAuthoring(this.configuration)) new Error('Asset can only be deleted in authoring!');
    console.log('Delete asset with id: ', assetId);
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: this.endpoint.uri_assets+'/'+assetId,
          method: 'DELETE'
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  /**
   * Deletes the specified amount of assets matching the query.
   * @param  {String}  query  - Facet query specifing the assets to be deleted
   * @param  {Integer} amount - Amount of elements that will be deleted
   * @return {Promise} - Resolves when all assets are deleted
   */
  deleteAssets(query, amount) {
    if(!isAuthoring(this.configuration)) new Error('Not supported on delivery!');
    let parallelUploads = 10;
    let amtEle = amount || 100;
    let qryParams = {query: `classification:asset`, facetquery: query, fields:'id', amount: amtEle};
    return this.doQuery(qryParams).
            then(data => (data.documents) ? data.documents : []).
            map(documents => (documents.id.startsWith('asset:')) ? documents.id.substring('asset:'.length) : documents.id).
            then(docIds => Array(Math.ceil(docIds.length/parallelUploads)).fill().map((_,i) => docIds.slice(i*parallelUploads, i*parallelUploads+parallelUploads))).
            each(docIdChunk => Promise.resolve(docIdChunk).
                              map(doc => this.deleteAsset(doc)).
                              all()
            );
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
    if(!isAuthoring(this.configuration)) new Error('Asset creation not supported on delivery!');
    if(!assetDef) new Error('Need a asset definition to upload');
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: this.endpoint.uri_assets,
          method: 'POST',
          qs: {
            analyze: true,
            autocurate: true
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
    if(!isAuthoring(this.configuration)) new Error('Asset creation not supported on delivery!');
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
   * @param  {String} filePath - Path to the file
   * @param  {String} fileName - Name of the file
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
   * @return {Promise} - Resolves when the asset & resource is created
   */
  uploadAsset(filePath, fileName, assetDef) {
    if(!isAuthoring(this.configuration)) new Error('Not supported on delivery!');
    return this.createResource(filePath, fileName).
      then(resourceResp => {
        assetDef.resource = resourceResp.id;
        return assetDef;
      }).
      then(asset => this.createAsset(asset));
  }

  /**
   * Creates a new content type based on the definition. Recommendation: Use authoring UI. A content type
   * becomes complicated fast!
   * @param  {Object} typeDefinition - JSON Object representing the content type definition
   * @return {Promise} - Resolves when the content type is created
   */
  createContentType(typeDefinition) {
    if(!isAuthoring(this.configuration)) new Error('Not supported on delivery!');
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

  updateContentType(typeDefinition) {
    if(!isAuthoring(this.configuration)) new Error('Not supported on delivery!');
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
   * Search API access. This should be your go to point when retrieving ANYTHING from 
   * Content Hub. Why? Because Search API will be available on authoring and delivery soon.
   * Other convinience APIs like /authoring/v1/assets not so much. 
   * @param  {Object} queryParams - The params object to build a query. Not all params are supported yet!
   * @param  {String} query - The main query. Must be a valid SOLR query. Required. Default is all content.
   * @param  {String} fields - The fields returned from the search. Default are all fields.
   * @param  {String} facetquery - Query to filter the main result. Cachable. Default is none.
   * @param  {Number} amount - Amount of results returned. Default is 10 elements.
   * @param  {String} sort - The order in which results are returned.
   * @param  {Number} start - The first element in order to be returned.
   * @return {Promise} - Resolves when the search finished.
   */
  doQuery(queryParams) {
    let _query = queryParams.query || '*:*',
        _fields = queryParams.fields || '*',
        _fq = queryParams.facetquery || '',
        _amount = queryParams.amount || 10,
        _sort = queryParams.sort || '',
        _start = queryParams.start || 0;
    
    let request = Object.assign({},
      this.options,
      {
          qs: {
              q: _query,
              fl: _fields,
              fq: _fq,
              rows: _amount,
              sort: _sort,
              start: _start
          }
      });
    return this.loginstatus.then(() => send(request, this.retryHandler));
  }

  /*----------  Helper Methods for Queries  ----------*/
  
  getContentById(type, id, filter) {
    var _type = escapeSolrChars(type) || '',
        _id = escapeSolrChars(id) || '',
        _filter = filter || '';
    return this.doQuery({
            query: `id:${_filter}${_type}\\:${_id}`,
            amount: 1
        });
  }

  getAllAssetsAndContent(filter, amount, sortAsc) {
    var _filter = (filter) ? ' '+filter : '',
        _sort = `lastModified ${(sortAsc) ? 'asc' : 'desc'}`;
    return this.doQuery({
      'query': `*:*${_filter}`, 
      'amount': amount,
      'sort': _sort
    });
  }

  getAllContentOfType(type, amount, sortAsc, start) {
    var _filter = (type) ? ' AND type:'+type : '',
        _sort = `lastModified ${(sortAsc) ? 'asc' : 'desc'}`;

    return this.doQuery({
      'query': `classification:content${_filter}`, 
      'amount': amount,
      'sort': _sort,
      'start': start
    });
  }

  getImageProfileWithName(name) {
    var _filter = (name) ? ' AND name:'+name : '';
    return this.doQuery({
      'query': `classification:image-profile${_filter}`, 
      'amount': 1
    });
  }

}

/**
 * Initalization of the wch connector.
 * @param  {Object} config - Optional parameter with credentials and default settings
 * @return {Object} - Wrapper to common API calls towards Watson Content Hub
 */
module.exports = function(config) {
  return new WchSDK(config);
}