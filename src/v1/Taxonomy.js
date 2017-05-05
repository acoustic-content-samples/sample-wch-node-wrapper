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
     * Returns a list of all child categories based on the given ID. The given ID is not included in the
     * searchresult.
     * @param  {String}  categoryId - UUID of the category to search for
     * @param  {Object}  config - Config on what to retrieve.
     * @param  {Boolean} config.recurse - If true it will also include children of children, if false only direct childs are returned
     * @param  {Number}  config.limit - How many items are returned max.
     * @param  {Number}  config.offset - Where to start returning. Useful for pagination.
     * @param  {Boolean} config.simple - When simple is set to true the result is transformed into a simple view. Otherwise the original answer for WCH is returned. Defaults to false.
     * @return {Promse} - Resolves when the category tree was retrieved.
     */
    getCategoryTree(categoryId, config) {
        let _config = config || {};
        let recurse = _config.recurse || true;
        let limit = _config.limit || 100;
        let offset = _config.offset || 0;
        let transform = (_config.simple) ? (res) => {
          return new Promise((resolve, reject) => {
            let transformedTax = new Map();
            let taxonomyName = res.items[0].namePath[0];
            res.items.forEach((item) => {
              let {name, id, parent, taxonomy, namePath} = item;
              let newNode = {parent: {name: namePath[namePath.length-2], id: parent}, children: []};
              let ancestorNode = (transformedTax.has(parent)) ? transformedTax.get(parent) : newNode;
              ancestorNode.children.push({name, id});
              transformedTax.set(parent, ancestorNode);
            });

            resolve({[taxonomyName]: Array.from(transformedTax.values())});
          });
        } : res => Promise.resolve(res);

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
        then(options => this.connector.send(options, this.connector.retryHandler)).
        then(transform).
        catch(this.connector.errorLogger);
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
      return this.connector.loginstatus.
      then(base => Object.assign({},
          this.connector.options,
          { 
            baseUrl: base,
            uri: this.connector.endpoint.uri_categories,
            method: 'POST',
            body: categoryDef
          })).
      then(options => this.connector.send(options, this.connector.retryHandler)).
      catch(this.connector.errorLogger);
    }

    /**
     * Updates an existing category element. If the category doesn't exist an error
     * will be thrown.
     * @param  {Object} updatedCategoryDef - The category definition
     * @param  {String} updatedCategoryDef.id - The id of the category to update
     * @param  {String} updatedCategoryDef.name - The name of the category
     * @param  {String} updatedCategoryDef.parent - The id of the parent category.
     * @return {Promise} - Resolves when the category was created
     */
    updateCategory(updatedCategoryDef) {
      return this.connector.loginstatus.
      then(base => Object.assign({},
          this.connector.options,
          { 
            baseUrl: base,
            uri: `${this.connector.endpoint.uri_categories}/${encodeURIComponent(updatedCategoryDef.id)}`,
            method: 'PUT',
            body: updatedCategoryDef
          })).
      then(options => this.connector.send(options, this.connector.retryHandler)).
      catch(this.connector.errorLogger);
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
        let _getname = (obj) => (typeof obj === 'string') ? obj : obj.name;
        return new Promise((resolve, reject) => {
          Promise.resolve(taxonomyLvl.childs).
          then(childs => childs.map(child => this.createCategory({name:_getname(child), parent: categoryMap.get(_getname(taxonomyLvl.parent))}))).
          then(createPromises => resolveall(createPromises)).
          then(categories => categories.map(result => categoryMap.set(result.name, result.id))).
          then(resolve).
          catch(reject);
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
      let taxonomiesMap = {};
      return Promise.resolve(Object.keys(taxonomyDefinition)).
      then(taxonomyKeys => {
        return resolveall(taxonomyKeys.map(key => {
          taxonomiesMap[key] = new Map();
          return this.createCategory({name:key}).
          then(result => taxonomiesMap[key].set(key, result.id)).
          then(() => taxonomyDefinition[key].reduce((p, taxonomyLvl) => p.then(() => this.createCategoryLvl(taxonomyLvl, taxonomiesMap[key])), Promise.resolve()));
        }));
      }).
      then(() => taxonomiesMap);
    }

    /**
     * Updates an exisiting taxonomy based on a simple taxonomy format used in this sample. A good starting point 
     * is to use the getTaxonomies method (in simple mode) and do your changes based on the result.
     * 
     * @param  {Object} newTaxonomyDefinitions - An object with at least one taxonomy definition.
     * @return {Promise} - Returns the updated taxonomy definition with all potential new ids for new categories.
     */
    updateTaxonomies(newTaxonomyDefinitions) {
      let taxonomies = Object.keys(newTaxonomyDefinitions);
      let taxQuery = `name:${taxonomies.join(' OR name:')}`;
      return this.getTaxonomy({facetquery: taxQuery}, {simple:true}).
        then(currentTaxonomies => {
          return new Promise((resolve, reject) => {
            let openCalls = [];
            taxonomies.forEach(key => {
              let currentTax = currentTaxonomies[key];
              let newTax = newTaxonomyDefinitions[key];
              newTax.forEach(newCategoryLvl => {
                let {id : parentid , name :parentname } = newCategoryLvl.parent;
                let currCategoryLvl = currentTax.find((element) => element.parent.id && element.parent.id===parentid);

                newCategoryLvl.children.forEach((child, indx) => {
                  let {name, id} = child;
                  let currChild = currCategoryLvl.children.find((element) => element.id && element.id===id);
                  if(!currChild) {
                    openCalls.push(this.createCategory({name, parent: parentid}).
                    then(result => {newCategoryLvl.children[indx].id = result.id;}));
                  } else if(name !== currChild.name) {
                     openCalls.push(this.updateCategory({name, id, parent: parentid}));
                  }
                });

              });
            });
            Promise.all(openCalls).
            then(() => resolve(newTaxonomyDefinitions));
          });
        });
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

    /**
     * Returns all matching taxonomies based by a regular searchquery.
     * @param  {Object} query - A valid searchquery object. See search#query for details.
     * @return {Promise} Resolves with a complete taxonomy tree.
     */
    getTaxonomies(query, taxconfig) {
      return this.connector.search.taxonomies(query).
        then(data => (data.documents) ? data.documents : []).
        then(documents => documents.map(document => (document.id.startsWith('taxonomy:')) ? document.id.substring('taxonomy:'.length) : document.id)).
        then(idset => resolveall(idset.map(taxid => this.getCategoryTree(taxid, taxconfig)))).
        then(resultset => resultset.reduce((result, taxonomy) => Object.assign(result, taxonomy), {}));
    }

}

module.exports = Taxonomy;