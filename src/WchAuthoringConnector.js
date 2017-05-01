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

const rp = require('request-promise-native');
const Queue = require('promise-queue');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Immutable connection endpoints to WCH.
// const wchEndpoints = require('./wchConnectionEndpoints');
const hashUtils = require('./util/hash');
const fileUtils = require('./util/file');
const WchConnector = require('./WchConnector');
const Asset = require('./v1/Asset');
const Taxonomy = require('./v1/Taxonomy');

/**
 * Class containing all authoring only API methods. Rule of thumb: All create, update & delete
 * methods are only available in authoring.
 */
class WchAuthoringConnector extends WchConnector {

    /**
     * creates a fresh Asset instance for use with the connector
     * @return {Asset}
     */
    get asset() {
      return new Asset({
          wchConnector: this
      });
    }

    /**
     * Creates a fresh Taxonomy instance for use with the connector
     * @return {Taxonomy}
     */
    get taxonomy() {
      return new Taxonomy({
          wchConnector: this
      });
    }
    
    /**
     * Creates a new content type based on the definition. Recommendation: Use authoring UI. A content type
     * becomes complicated fast!
     * @param  {Object} typeDefinition - JSON Object representing the content type definition
     * @return {Promise} - Resolves when the content type is created
     */
    createContentType(typeDefinition) {
        return this.loginstatus.
        then((base) => Object.assign({},
            this.options,
            {
                baseUrl: base,
                uri: this.endpoint.uri_types,
                method: 'POST',
                body: typeDefinition
            })
        ).
        then(options => this.send(options, this.retryHandler));
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
        then((base) => Object.assign({},
            this.options,
            {
                baseUrl: base,
                uri: this.endpoint.uri_types+'/'+encodeURIComponent(typeDefinition.id),
                method: 'PUT',
                body: typeDefinition
            })
        ).
        then(options => this.send(options, this.retryHandler));
    }

    /**
     * Deletes all content items based on the ids passed in.
     * @param  {Array} contentItemIds - String array with all content item ids that should get deleted.
     * @return {Promse} - Resolves when the deletion process has finished.
     */
    bulkDeleteItems(contentItemIds) {
      return this.loginstatus.
        then((base) => Object.assign({},
          this.options, 
          { baseUrl: base,
            uri: `${this.endpoint.uri_content}`,
            method: 'DELETE',
            qs: {
              ids: contentItemIds.join(',')
            }
          })
        ).
        then(options => send(options, this.retryHandler)).
        catch(errLogger);
    }

    deleteContentItems(query, rows) {
      let amtEle = rows || 500;
      let qryParams = {query: `classification:content`, facetquery: query, fields:'id', rows: amtEle};
      return this.search.query(qryParams).
              then(data => (data.documents) ? data.documents : []).
              map(document => (document.id.startsWith('content:')) ? document.id.substring('content:'.length) : document.id).
              then(this.bulkDeleteItems);
    }

}
module.exports = WchAuthoringConnector;