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

const debug = require('debug')('wchwrapper:Taxonomy');
const resolveall = promiseMap => new Promise((res, rej) => Promise.all(promiseMap).then(res).catch(rej)); 
const debugPromise = input => {debug(input); return input};

class Taxonomy {
    constructor({wchConnector}){
        this.connector = wchConnector;
    }

    /**
     * Returns a list of all child categories based on the given ID. The given ID is not included in the
     * searchresult.
     * @param  {String}  categoryId - UUID of the category to search for
     * @param  {Object}  config - Config on what to retrieve.
     * @param  {Boolean} config.recurse - If true it will also include children of children, if false only direct children are returned
     * @param  {Number}  config.limit - How many items are returned max.
     * @param  {Number}  config.offset - Where to start returning. Useful for pagination.
     * @param  {Boolean} config.simple - When simple is set to true the result is transformed into a simple view. Otherwise the original answer for WCH is returned. Defaults to false.
     * @return {Promse} - Resolves when the category tree was retrieved.
     */
    getCategoryTree(categoryId, config) {
        debug('getCategoryTree(%s, %o)', categoryId, config)
        let _config = config || {};
        let recurse = _config.recurse || true;
        let limit = _config.limit || 100;
        let offset = _config.offset || 0;
        let transform = (_config.simple) ? (res) => {
          debug('Transform Category Tree Result: %o', res);
          return new Promise((resolve, reject) => {
            debug('Amount of children ', res.items.length);
            if(res.items.length === 0) {
              return resolve([]);
            }
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
          catch(this.connector.errorLogger).
          then(base => (
            {
              baseUrl: base,
              uri: `${this.connector.endpoint.uri_categories}/${encodeURIComponent(categoryId)}/children`,
              method: 'GET',
              qs: {
                  recurse: recurse,
                  limit: limit,
                  offset: offset
              }
            }
          )).
          catch(this.connector.errorLogger).
          then(options => this.connector.send(options, this.connector.retryHandler)).
          catch(this.connector.errorLogger).
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
      debug('Enter createCategory(%o)', categoryDef);
      return this.connector.loginstatus.
        catch(this.connector.errorLogger).
        then(base => (
          {
            baseUrl: base,
            uri: this.connector.endpoint.uri_categories,
            method: 'POST',
            body: categoryDef
          }
        )).
        catch(this.connector.errorLogger).
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
        then(base => (
          { 
            baseUrl: base,
            uri: `${this.connector.endpoint.uri_categories}/${encodeURIComponent(updatedCategoryDef.id)}`,
            method: 'PUT',
            body: updatedCategoryDef
          }
        )).
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
        then(base => (
            { 
              baseUrl: base,
              uri: `${this.connector.endpoint.uri_categories}/${encodeURIComponent(categoryId)}`,
              method: 'DELETE'
            }
        )).
        then(options => this.connector.send(options, this.connector.retryHandler)).
        catch(this.connector.errorLogger);
    }

    /* Convinience method to create taxonomies. Since taxonomies are reliying on a 'strict' parent child relation ship. We have to ensure
    that the parent category was created before the child categories. */
    createCategoryLvl(taxonomyLvl, categoryMap) {
      debug('Enter createCategoryLvl(%o, %o)', taxonomyLvl, categoryMap);
      let _getname = (obj) => (typeof obj === 'string') ? obj : obj.name;
      return new Promise((resolve, reject) => {
        debug('taxonomyLvl %o', taxonomyLvl);
        Promise.resolve(taxonomyLvl.children).
        catch(this.connector.errorLogger).
        then(childs => childs.map(child => this.createCategory({name:_getname(child), parent: categoryMap.get(_getname(taxonomyLvl.parent))}))).
        catch(this.connector.errorLogger).
        then(createPromises => resolveall(createPromises)).
        catch(this.connector.errorLogger).
        then(categories => categories.map(result => {debug('result %o', result);return categoryMap.set(result.name, result.id);})).
        catch(this.connector.errorLogger).
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
      debug('Enter createTaxonomies(%o)', taxonomyDefinition)
      let taxonomiesMap = {};
      return Promise.resolve(Object.keys(taxonomyDefinition)).
        catch(this.connector.errorLogger).
        then(taxonomyKeys => {
          return resolveall(taxonomyKeys.map(key => {
            taxonomiesMap[key] = new Map();
            return this.createCategory({name:key}).
              catch(this.connector.errorLogger).
              then(result => {
                debug('Taxonomy Root %o', result.id);
                taxonomiesMap[key].set(key, result.id)
                debug('taxonomiesMap Root %o', taxonomiesMap);
                return taxonomiesMap[key].set(key, result.id);
              }).
              catch(this.connector.errorLogger).
              then(() => taxonomyDefinition[key].reduce((p, taxonomyLvl) => p.then(() => this.createCategoryLvl(taxonomyLvl, taxonomiesMap[key])), Promise.resolve())).
              catch(this.connector.errorLogger);
          }));
        }).
        catch(this.connector.errorLogger).
        then(() => {
          debug('Created all taxonomies %o', taxonomiesMap); 
          return taxonomiesMap
        });
    }

    /**
     * Updates an exisiting taxonomy based on a simple taxonomy format used in this sample. A good starting point 
     * is to use the getTaxonomies method (in simple mode) and do your changes based on the result.
     * 
     * @param  {Object} newTaxonomyDefinitions - An object with at least one taxonomy definition.
     * @return {Promise} - Returns the updated taxonomy definition with all potential new ids for new categories.
     */
    updateTaxonomies(newTaxonomyDefinitions) {
      debug('Enter updateTaxonomies %o', newTaxonomyDefinitions);
      let taxonomies = Object.keys(newTaxonomyDefinitions);
      let taxQuery = `name:${taxonomies.join(' OR name:')}`;
      debug('Taxonomy Query %o', taxQuery);
      return this.getTaxonomies({facetquery: taxQuery}, {simple:true, limit: 999999}).
        then(currentTaxonomies => {
          debug('Current Taxonomies %o', currentTaxonomies);
          return new Promise((resolve, reject) => {
            let openTaxonomies = taxonomies.map(key => {
              return new Promise((resolve, reject) => {
                let newIdMap = new Map();
                let currentTax = currentTaxonomies[key];
                debug('Current Taxonomy: %o',currentTax);
                
                if(currentTax) {
                  let newTax = newTaxonomyDefinitions[key];

                  let openCatlevels = newTax.reduce((p, newCategoryLvl) => {
                    return p.then(() => {return new Promise((resolve, reject) => {
                        debug('handle newCategoryLvl %o', newCategoryLvl);
                        if (!newCategoryLvl.children) resolve();
                        let {id: parentid , name: parentname } = newCategoryLvl.parent;
                        if(!parentid || parentid === null || newIdMap.has(parentname)) {
                          parentid=newIdMap.get(parentname);
                          newCategoryLvl.parent.id=parentid;
                        }
                        debug('parentname: %o, parentid: %o', parentname, parentid);

                        // First try to identify the current level by its parent id
                        let currCategoryLvl = currentTax.find(element => element.parent && element.parent.id===parentid);
                        if (!currCategoryLvl) {
                          debug('Match by name');
                          currCategoryLvl = currentTax.find(element => element.parent && element.parent.name === parentname);
                          if(currCategoryLvl && currCategoryLvl.parent && currCategoryLvl.parent.id !== null && parentid !== currCategoryLvl.parent.id) {
                            debug('MISSMATCH ', currCategoryLvl);
                            newIdMap.set(currCategoryLvl.parent.name, currCategoryLvl.parent.id);
                            parentid = currCategoryLvl.parent.id;
                          }
                        }

                        debug('currCategoryLvl %o', currCategoryLvl);
                        let openChilds = newCategoryLvl.children.map((child, indx) => {
                          return new Promise((resolve, reject) => {
                            debug('newCategory child %o', child);
                            let {name, id} = child;

                            let currChildId = (currCategoryLvl) ? currCategoryLvl.children.find(element => element.id && element.id === id) : undefined;
                            let currChildName = (currCategoryLvl) ? currCategoryLvl.children.find(element => element.name && element.name === name) : undefined;
                            debug('currChildId %o', currChildId);
                            debug('currChildName %o', currChildName);
                            if(!currChildId && currChildName) {
                              let currChildName = (currCategoryLvl) ? currCategoryLvl.children.find(element => element.name && element.name === name) : undefined;
                              newCategoryLvl.children[indx].id = currChildName.id; 
                              newIdMap.set(currChildName.name, currChildName.id);
                              resolve();
                            } else if(!currChildId && !currChildName) {
                              this.createCategory({name, parent: parentid}).
                              then(result => {newCategoryLvl.children[indx].id = result.id; newIdMap.set(result.name, result.id)}).
                              catch(reject).
                              then(resolve);
                            } else if(name !== currChildId.name) {
                              newIdMap.set(name, id);
                              this.updateCategory({name, id, parent: parentid}).
                              catch(reject).
                              then(resolve);
                            } else {
                              resolve();
                            }
                          });
                        });
                        
                        resolveall(openChilds).
                        catch(reject).
                        then(resolve);

                      });
                    });
                  }, Promise.resolve());
                
                  openCatlevels.
                  catch(reject).
                  then(resolve);
                } else {
                  debug('No current Taxonomy...');
                  this.createTaxonomies({[key]:newTaxonomyDefinitions[key]}).
                  catch(reject).
                  then(resultMap => {
                    debug('Result new Taxonomy Id Map %o', resultMap);
                    newTaxonomyDefinitions[key].forEach(taxLevel => {
                      taxLevel.parent.id = resultMap[key].get(taxLevel.parent.name);
                      taxLevel.children.forEach(child => {
                        child.id = resultMap[key].get(child.name);
                      });
                    });
                  }).
                  then(resolve);
                }

              });
            });

            resolveall(openTaxonomies).
            catch(reject).
            then(() => resolve(newTaxonomyDefinitions));
          }).
          catch(this.connector.errorLogger);
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
        then(ids => resolveall(ids.map(id => this.deleteCategory(id)))).
        catch(this.connector.errorLogger);
    }

    /**
     * Returns all matching taxonomies based by a regular searchquery.
     * @param  {Object} query - A valid searchquery object. See search#query for details.
     * @return {Promise} Resolves with a complete taxonomy tree.
     */
    getTaxonomies(query, taxconfig) {
      debug('Enter getTaxonomies(%o, %o)', query, taxconfig);
      return this.connector.search.taxonomies(query).
        catch(this.connector.errorLogger).
        then(result => {debug('Found taxonomies: %o', result); return result;}).
        catch(this.connector.errorLogger).
        then(data => (data.documents) ? data.documents : []).
        catch(this.connector.errorLogger).
        then(documents => documents.map(document => (document.id.startsWith('taxonomy:')) ? document.id.substring('taxonomy:'.length) : document.id)).
        catch(this.connector.errorLogger).
        then(idset => resolveall(idset.map(taxid => this.getCategoryTree(taxid, taxconfig)))).
        catch(this.connector.errorLogger).
        then(resultset => resultset.reduce((result, taxonomy) => Object.assign(result, taxonomy), {})).
        catch(this.connector.errorLogger).
        then(result => {debug('Leave getTaxonomies() --> %o', result); return result;}).
        catch(this.connector.errorLogger);
    }

}

module.exports = Taxonomy;