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

const resolveall = promiseMap => new Promise((res, rej) => Promise.all(promiseMap).then(res).catch(rej)); 

class Content {
    constructor({wchConnector}){
      this.connector = wchConnector;
    }

    /**
     * Creates a new content type based on the definition. Recommendation: Use authoring UI. A content type
     * becomes complicated fast!
     * @param  {Object} typeDefinition - JSON Object representing the content type definition
     * @return {Promise} - Resolves when the content type is created
     */
    createContentType(typeDefinition) {
        return this.connector.loginstatus.
        then(base => Object.assign({},
            this.connector.options,
            {
                baseUrl: base,
                uri: this.connector.endpoint.uri_types,
                method: 'POST',
                body: typeDefinition
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler));
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
        return this.connector.loginstatus.
        then(base => Object.assign({},
            this.connector.options,
            {
                baseUrl: base,
                uri: this.connector.endpoint.uri_types+'/'+encodeURIComponent(typeDefinition.id),
                method: 'PUT',
                body: typeDefinition
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler));
    }

    /**
     * Deletes all content items based on the ids passed in.
     * @param  {Array} contentItemIds - String array with all content item ids that should get deleted.
     * @return {Promse} - Resolves when the deletion process has finished.
     */
    bulkDeleteItems(contentItemIds) {
      if(!contentItemIds || contentItemIds.length === 0) return Promise.resolve('No Id');
      return this.connector.loginstatus.
        then(base => Object.assign({},
          this.connector.options, 
          { baseUrl: base,
            uri: `${this.connector.endpoint.uri_content}`,
            method: 'DELETE',
            qs: {
              ids: contentItemIds.join(',')
            }
          })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler)).
        catch(this.connector.errLogger);
    }

    /**
     * Convenience method to bulk delete items based on a search query result.
     * @param  {String} query - A facet query term to specify which content items should get deleted.
     * @param  {Integer} rows - The maximum amount of elements which should get deleted.
     * @return {Promse} Resolves when the bulk delete step has finished.
     */
    deleteContentItems(query, rows) {
      let amtEle = rows || 500;
      let qryParams = {query: `classification:content`, facetquery: query, fields:'id', rows: amtEle};

      return this.connector.search.query(qryParams).
              then(data => (data.documents) ? data.documents : []).
              then(documents => documents.map(document => (document.id.startsWith('content:')) ? document.id.substring('content:'.length) : document.id)).
              then(this.bulkDeleteItems);
    }

    /**
     * Deletes a single content type based on its ID.
     * @param  {String} typeid - The content type id.
     * @return {Promise} With the result of the delete operation
     */
    deleteTypes(typeid) {
      if(!typeid) return Promise.resolve('No Id');
      return this.connector.loginstatus.
        then(base => Object.assign({},
          this.connector.options, 
          { baseUrl: base,
            uri: `${this.connector.endpoint.uri_types}/${typeid}`,
            method: 'DELETE'
          })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler)).
        catch(this.connector.errLogger);
    }

    /**
     * Deletes all content types based on the ids passed in. At the moment this feature is not available in WCH yet. 
     * Therefore we will call a delte for each ID separately.
     * @param  {Array} contentTypeIds - String array with all content-type ids that should get deleted.
     * @return {Promse} - Resolves when the deletion process has finished.
     */
    bulkDeleteTypes(contentItemIds) {
      if(!contentItemIds || contentItemIds.length === 0) return Promise.resolve('No Ids');
      return resolveall(contentItemIds.map(contentId => this.deleteTypes(contentId)));
    }

    /**
     * Convenience method to bulk delete items based on a search query result.
     * @param  {String} query - A facet query term to specify which content items should get deleted.
     * @param  {Integer} rows - The maximum amount of elements which should get deleted.
     * @return {Promse} Resolves when the bulk delete step has finished.
     */
    deleteContentTypes(query, rows) {
      let amtEle = rows || 500;
      let qryParams = {query: `classification:content-type`, facetquery: query, fields:'id', rows: amtEle};

      return this.connector.search.query(qryParams).
              then(data => (data.documents) ? data.documents : []).
              then(documents => documents.map(document => (document.id.startsWith('content-type:')) ? document.id.substring('content-type:'.length) : document.id)).
              then(ids => this.bulkDeleteTypes(ids));
    }

}

module.exports = Content;