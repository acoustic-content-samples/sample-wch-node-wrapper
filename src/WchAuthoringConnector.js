const rp = require('request-promise-native'),
    Queue = require('promise-queue'),
    fs = require('fs'),
    path = require('path'),
    mime = require('mime-types');

// let debug = false;
// const errLogger = err => {if (debug) console.error("Error: ", err); throw err;}

// Immutable connection endpoints to WCH.
// const wchEndpoints = require('./wchConnectionEndpoints');
const hashUtils = require('./util/hash');
const fileUtils = require('./util/file');
const WchConnector = require('./WchConnector');
const Asset = require('./Asset');

/**
 * Class containing all authoring only API methods. Rule of thumb: All create, update & delete
 * methods are only available in authoring.
 */
class WchAuthoringConnector extends WchConnector {

    /**
     * creates a fresh Asset instance for use with the connector
     * @return {Search}
     */
    get asset() {
      return new Asset({
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
      return this.doSearch(qryParams).
              then(data => (data.documents) ? data.documents : []).
              map(document => (document.id.startsWith('content:')) ? document.id.substring('content:'.length) : document.id).
              then(contentItemIds => this.bulkDeleteItems(contentItemIds));
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
        then((base) => Object.assign({},
            this.options,
            {
                baseUrl: base,
                uri: `${this.endpoint.uri_categories}/${encodeURIComponent(categoryId)}/children`,
                method: 'GET',
                qs: {
                    recurse: true,
                    limit: 100,
                    offset: 0
                }
            })
        ).
        then(options => this.send(options, this.retryHandler))
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
        then((base) => Object.assign({},
            this.options,
            { baseUrl: base,
                uri: this.endpoint.uri_categories,
                method: 'POST',
                body: categoryDef
            })).
        then(options => this.send(options, this.retryHandler));
    }

    /**
     * Deletes a category item all all its children.
     * @param  {String} categoryId - The uniue id of the category item to delete
     * @return {Promis} - Resolves when the element is deleted.
     */
    deleteCategory(categoryId) {
        return this.loginstatus.
        then((base) => Object.assign({},
            this.options,
            { baseUrl: base,
                uri: `${this.endpoint.uri_categories}/${encodeURIComponent(categoryId)}`,
                method: 'DELETE'
            })
        ).
        then(options => this.send(options, this.retryHandler)).
        catch(this.errorLogger);
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
     * @param  {Number} rows - the amount of matched elements to get deleted.
     * @return {Promise} - Resolves when all matched elements are deleted.
     */
    deleteTaxonomies(query, rows) {
        let amtEle = rows || 100;
        let qryParams = {query: 'classification:taxonomy', facetquery: query, fields:'id', rows: amtEle};
        return this.doSearch(qryParams).
        then(data => (data.documents) ? data.documents : []).
        map(document => (document.id.startsWith('taxonomy:')) ? document.id.substring('taxonomy:'.length) : document.id).
        map(id => this.deleteCategory(id)).
        all();
    }

}
module.exports = WchAuthoringConnector;