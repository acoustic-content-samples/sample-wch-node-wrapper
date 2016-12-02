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

let debug = true;
const errLogger = err => {if(debug){console.error("Login expired... relogin. Err: ", err);} throw err;}

// Immutable connection endpoints to WCH.
const connections = {
        authoring : {
          baseUrl: 'https://www.digitalexperience.ibm.com/api', 
          uri_search: '/authoring/v1/search',
          uri_auth: '/login/v1/basicauth',
          uri_resource: '/authoring/v1/resources',
          uri_assets: '/authoring/v1/assets',
          uri_types: '/authoring/v1/types'
        },
         // At the moment there is no delivery system hence the endpoints are the same
         // as in authoring... a future TODO
        publishing:  {
          baseUrl: 'https://www.digitalexperience.ibm.com/api',
          uri_resource: '/authoring/v1/resources',
          uri_search: '/authoring/v1/search',
          uri_auth: '/authoring/v1/basicauth'
        }
      };

/**
 * In case of error try to login again. This is a quick-fix. More sophistiacted would be 
 * to obseve the expiry date of the authentication cookie... clearly a TODO.
 * @param  {Object} options [Request-Promise options Object(value?: any)]
 * @return {Promise}         [Waiting for the response]
 */
function send(options, retryHandling) {
  return rp(options)
        .catch(errLogger)
        .catch(err => retryHandling(err).then(() => rp(options)));
}

/**
 * Simple solr special char escaper. Based on 
 * https://cwiki.apache.org/confluence/display/solr/The+Standard+Query+Parser
 * @param  {String} str [The string to escape]
 * @return {String}     [The same string with all special solr chars escaped with '\']
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
   * @param  {Object} configuration [Config options for WCH]
   * @return {Class}               [Initalized SDK ready to query for content]
   */
  constructor (configuration) {
    // Update default config
    this.configuration = Object.assign({
      endpoint: 'publishing',
      rejectUnauthorized: true
    }, configuration);

    var endpoint = connections[this.configuration.endpoint];
    // Request-promise module default options.
    this.cookieJar = rp.jar();
    this.options = {
          baseUrl: `${endpoint.baseUrl}/${this.configuration.tenantid}`,
          uri: endpoint.uri_search,
          qsStringifyOptions: {encode:true},
          agentOptions: {
            rejectUnauthorized: this.configuration.rejectUnauthorized
          },
          jar: this.cookieJar,
          json: true
      };

    var creds = this.configuration.credentials;
    this.loginstatus = (creds) ? this.dologin(creds) : Promise.resolve();

    this.retryHandler = error => {
      this.loginstatus = this.dologin(this.configuration.credentials);
      return this.loginstatus;
    }
  }

  dologin(credentials) {
    var username = credentials.usrname,
        pwd = credentials.pwd;

    var request = Object.assign({}, 
      this.options, 
      {
        uri: connections[this.configuration.endpoint].uri_auth,
        auth: {
          user: credentials.usrname,
          pass: credentials.pwd
        }
    });
    var loginstatus = rp(request).promise();
    loginstatus.catch(() => console.log("Login failed..."));
    return loginstatus;
  }

  deleteAsset(assetId) {
    console.log('Delete assets ', assetId);
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: connections[this.configuration.endpoint].uri_assets+'/'+assetId,
          method: 'DELETE'
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  deleteAssets(query) {
    let amtEle = 100;
    let qryParams = {query: `classification:asset`, facetquery: query, fields:'id', amount: amtEle};
    return this.doQuery(qryParams).
            then(data => (data.documents) ? data.documents : []).
            map(documents => (documents.id.startsWith('asset:')) ? documents.id.substring('asset:'.length) : documents.id).
            map(val => this.deleteAsset(val)).
            all();
  }

  createAsset(assetDef) {
    if(this.configuration.endpoint !== 'authoring') new Error('Asset creation not supported on delivery!');
    if(!assetDef) new Error('Need a asset definition to upload');
    return this.loginstatus.
      then(() => Object.assign({}, 
        this.options, 
        {
          uri: connections[this.configuration.endpoint].uri_assets,
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

  uploadResource(filePath, fileName) {
    if(this.configuration.endpoint !== 'authoring') new Error('Resource Upload not supported on delivery!');
    if(!filePath) new Error('Need a file to upload');
    var _fileName = fileName || path.basename(filePath, path.extname(filePath));
    var contentType = mime.lookup(path.extname(filePath));

    return this.loginstatus.
      then(() => fs.readFileAsync(filePath)).
      then(fileBuffer => Object.assign({},
        this.options, 
        {
          uri: connections[this.configuration.endpoint].uri_resource+'/'+_fileName,
          method: 'PUT',
          headers: {
            'Content-Type': contentType
          },
          qs: {
            name: path.basename(filePath),
            md5: crypto.createHash('md5').update(fileBuffer).digest('base64')
          },
          body: fileBuffer,
          json: false
        })
      ).
      then(options => send(options, this.retryHandler)).
      then(() => {return {"id": _fileName}});
  }

  createContentType(typeDefition) {
    return this.loginstatus.
       then(() => Object.assign({},
        this.options, 
        {
          uri: connections[this.configuration.endpoint].uri_types,
          method: 'POST',
          body: typeDefition
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  updateContentType(typeDefition) {
    return this.loginstatus.
       then(() => Object.assign({},
        this.options, 
        {
          uri: connections[this.configuration.endpoint].uri_types+'/'+typeDefition.id,
          method: 'PUT',
          body: typeDefition
        })
      ).
      then(options => send(options, this.retryHandler));
  }

  // query, amount, sort
  doQuery(queryParams) {
    var _query = queryParams.query || '*:*',
        _fields = queryParams.fields || '*',
        _fq = queryParams.facetquery || '',
        _amount = queryParams.amount || 10,
        _sort = queryParams.sort || '',
        _start = queryParams.start || 0;
    
    let request = Object.assign({
        qs: {
            q: _query,
            fl: _fields,
            fq: _fq,
            rows: _amount,
            sort: _sort,
            start: _start
        }
    }, this.options);

    return this.loginstatus.then(() => send(request, this.retryHandler));
  }

  uploadAsset(filePath, fileName, assetDef) {
    return this.uploadResource(filePath, fileName).
      then(resourceResp => {
        assetDef.resource = resourceResp.id;
        return assetDef;
      }).
      then(asset => this.createAsset(asset));
  }

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

  isPublishContext() {
    return this.configuration.endpoint === 'publishing';
  }

}

/**
 * Initalization of the wch connector.
 * @param  {Object} config [Optional parameter with credentials and default settins]
 * @return {Object} returns wrapper to common API calls towards Watson Content Hub
 */
module.exports = function(config) {
  return new WchSDK(config);
}