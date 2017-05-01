/*
 * Copyright 2017  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const rp = require('request-promise-native');
const mime = require('mime-types');
const Queue = require('promise-queue');
const hashUtils = require('../util/hash');
const fileUtils = require('../util/file');

class Asset {
    constructor({wchConnector}){
        this.connector = wchConnector;
    }

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
        let resourceId = (_randomId) ? '' : `/${encodeURIComponent(extractedExtname)}`;
        // Be aware that resources are the binary representation of an asset. Hence these resources
        // can get rather large in size. That's why this part is implemented as a stream in order to reduce
        // the memory footprint of this node sample app.

        let hashStream = fs.createReadStream(options.filePath);
        let bodyStream = fs.createReadStream(options.filePath);

        return Promise.all([
          this.connector.loginstatus, 
          fileUtils.getFileSize(options.filePath),
          hashUtils.generateMD5Hash(hashStream)
        ]).
        then(values => Object.assign({}, //(base, fileSize, md5file)
                this.connector.options,
                {
                    baseUrl: values[0],
                    uri: `${this.connector.endpoint.uri_resource}${resourceId}`,
                    method: (_randomId) ? 'POST': 'PUT',
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': values[1]
                    },
                    qs: {
                        name: path.basename(options.filePath),
                        md5: values[2]
                    },
                    json: false
                })
        ).
        then(options => {
            return new Promise((resolve, reject) => {
                let body = '';
                let request = bodyStream.pipe(rp(options));
                request.on('data', data => {body += data});
                request.on('end', () => (body) ? resolve(JSON.parse(body)) : resolve(undefined));
                request.on('error', reject);
            });
        }).
        catch(value => {console.log('Create ... ', value); return value;}).
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
        return this.connector.loginstatus.
        then((base) => Object.assign({},
            this.connector.options,
            {
                baseUrl: base,
                uri: this.connector.endpoint.uri_assets,
                method: 'POST',
                qs: {
                    analyze: true, // These two parameters define if watson tagging is active...
                    autocurate: false // ... and if all tags are accepted automatically
                },
                body: assetDef
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler));
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
    update(assetDef) {
        return this.connector.loginstatus.
        then((base) => Object.assign({},
            this.connector.options,
            {
                baseUrl: base,
                uri: `${this.connector.endpoint.uri_assets}/${encodeURIComponent(assetDef.id)}`,
                method: 'PUT',
                qs: {
                    analyze: true
                },
                body: assetDef
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler));
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
    upload(options) {
        return this.createResource(options.resourceDef).
        then(resourceResp => (typeof resourceResp === 'string') ? JSON.parse(resourceResp) : resourceResp).
        then(resourceResp => Object.assign(
            {},
            options.assetDef,
            {
                tags: {
                    values:   options.assetDef.tags.values.splice(0),
                    declined: options.assetDef.tags.declined.splice(0),
                    analysis: options.assetDef.tags.analysis
                },
                resource: resourceResp.id
            })).
        then(asset => this.createAsset(asset));
    }

    /**
     * Deletes a single asset based on it's id.
     * @param  {String} assetId - The WCH unique Asset ID
     * @return {Promise} - Resolved after the resource was deleted
     */
    delete(assetId) {
        return this.connector.loginstatus.
        then(base => Object.assign({},
            this.connector.options,
            {
                baseUrl: base,
                uri: this.connector.endpoint.uri_assets+'/'+encodeURIComponent(assetId),
                method: 'DELETE'
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler)).
        then(() => `Deleted ${assetId} succesfully.`).
        catch(this.errorLogger).
        catch(err => `An error occured deleting ${assetId}: Status ${err.statusCode}. Enable debugging for details.`);
    }

    /**
     * Deletes the specified amount of assets matching the query.
     * @param  {String}  query  - Facet query specifing the assets to be deleted
     * @param  {Integer} rows - Amount of elements that will be deleted
     * @return {Promise} - Resolves when all assets are deleted
     */
    deleteAssets(query, rows) {
        let parallelDeletes = Math.ceil(this.connector.configuration.maxSockets / 5); // Use 1/5th of the available connections in parallel
        let amtEle = rows || 100;
        let queue = new Queue(parallelDeletes, amtEle);
        let qryParams = {query: `classification:asset`, facetquery: query, fields:'id', rows: amtEle};
        return this.connector.search.query(qryParams).
        then(data => (data.documents) ? data.documents : []).
        then(documents => documents.map(document => (document.id.startsWith('asset:')) ? document.id.substring('asset:'.length) : document.id)).
        then(documents => Promise.all(documents.map(docId => queue.add(() => this.delete(docId)))));
    }
    
}

module.exports = Asset;