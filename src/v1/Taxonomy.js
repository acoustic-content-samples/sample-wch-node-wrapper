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

class Taxonomy {
    constructor({wchConnector}){
        this.connector = wchConnector;
    }

    /**
     * Returns all matchin taxonomies by searchquery.
     * @param  {Object} query - A valid searchquery object. See search#query for details.
     * @return {Promise} Resolves with a complete taxonomy tree.
     */
    getTaxonomy(query, taxconfig) {
      return this.connector.search.taxonomies(query).
        then(data => (data.documents) ? data.documents : []).
        then(documents => documents.map(document => (document.id.startsWith('taxonomy:')) ? document.id.substring('taxonomy:'.length) : document.id)).
        then(idset => resolveall(idset.map(taxid => this.getCategoryTree(taxid, taxconfig))) );
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

        return this.connector.loginstatus.
        then(base => Object.assign({},
            this.connector.options,
            {
              baseUrl: base,
              uri: `${this.connector.endpoint.uri_categories}/${encodeURIComponent(categoryId)}/children`,
              method: 'GET',
              qs: {
                  recurse: recurse,
                  limit: limit,
                  offset: offset
              }
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler))
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
      console.log('create ', categoryDef);
        return this.connector.loginstatus.
        then(base => Object.assign({},
            this.connector.options,
            { 
              baseUrl: base,
              uri: this.connector.endpoint.uri_categories,
              method: 'POST',
              body: categoryDef
            })).
        then(options => this.connector.send(options, this.connector.retryHandler));
    }

    /**
     * Deletes a category item all all its children.
     * @param  {String} categoryId - The uniue id of the category item to delete
     * @return {Promis} - Resolves when the element is deleted.
     */
    deleteCategory(categoryId) {
        return this.connector.loginstatus.
        then(base => Object.assign({},
            this.connector.options,
            { 
              baseUrl: base,
              uri: `${this.connector.endpoint.uri_categories}/${encodeURIComponent(categoryId)}`,
              method: 'DELETE'
            })
        ).
        then(options => this.connector.send(options, this.connector.retryHandler)).
        catch(this.connector.errorLogger);
    }

    /* Convinience method to create taxonomies. Since taxonomies are reliying on a 'strict' parent child relation ship. We have to ensure
    that the parent category was created before the child categories. */
    createCategoryLvl(taxonomyLvl, categoryMap) {
        return new Promise((resolve, reject) => {
            if(taxonomyLvl.name) {
                this.createCategory({name:taxonomyLvl.name}).
                then(result => categoryMap.set(taxonomyLvl.name, result.id)).
                then(() => taxonomyLvl.childs).
                then(childs => resolveall(childs.map(child => this.createCategory({name:child, parent: categoryMap.get(taxonomyLvl.name)})))).
                then(categories => resolveall(categories.map(result => categoryMap.set(result.name, result.id)))).
                then(resolve).
                catch(reject);
            } else {
                Promise.resolve(taxonomyLvl.childs).
                then(childs => resolveall(childs.map(child => this.createCategory({name:child, parent: categoryMap.get(taxonomyLvl.parent)})))).
                then(categories => resolveall(categories.map(result => categoryMap.set(result.name, result.id)))).
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
        then(taxonomyCategories => taxonomyCategories.reduce((p, taxonomyLvl) => p.then(() => this.createCategoryLvl(taxonomyLvl, nameMap)), Promise.resolve()));
    }

    /**
     * Deletes all taxonomies matched by this query. If the query is empty all taxonomies will get deleted.
     * @param  {String} query - A valid solr facet query element specifing the taxonomies to delete.
     * @param  {Number} rows - the amount of matched elements to get deleted.
     * @return {Promise} - Resolves when all matched elements are deleted.
     */
    deleteTaxonomies(query, rows) {
        let amtEle = rows || 100;
        let qryParams = {query: 'classification:taxonomy', facetquery: query, fields:'id', rows: amtEle};
        return this.connector.search.query(qryParams).
        then(data => (data.documents) ? data.documents : []).
        then(documents => documents.map(document => (document.id.startsWith('taxonomy:')) ? document.id.substring('taxonomy:'.length) : document.id)).
        then(ids => resolveall(ids.map(id => this.deleteCategory(id))));
    }

}

module.exports = Taxonomy;