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

const wchEndpoints = require('../util/wchConnectionEndpoints');

/**
 * Simple solr special char escaper. Based on
 * https://cwiki.apache.org/confluence/display/solr/The+Standard+Query+Parser
 * @param  {String} str - The string to escape
 * @return {String} - The same string with all special solr chars escaped with '\'
 */
function escapeSolrChars(str) {
    let solrChars = /(\+|\-|\!|\(|\)|\{|\}|\[|\]|\^|\"|\~|\*|\?|\:|\/|\&{2}|\|{2}|\s)/gm;
    return str.replace(solrChars, (match) => match.replace(/(.)/gm, '\\$1') );
}

class Search{
    constructor({wchConnector}){
        this.connector = wchConnector;
    }

    /**
     * Search API access. This should be your first access point when retrieving content from WCH. Why? Because the
     * Search API will be available on authoring and delivery soon. Hence most of the queries you build can be used in
     * both environments.
     * Other APIs like /authoring/v1/assets might not be aviailable on production for such purposes.
     * @param  {Object} queryParams - The params object to build a query. Not all params are supported yet!
     * @param  {String} queryParams.query - The main query. Must be a valid SOLR query. Required. Default is all content.
     * @param  {String} queryParams.fields - The fields returned from the search. Default are all fields.
     * @param  {Number} queryParams.rows - Amount of results returned. Default is 10 elements.
     * @param  {String} queryParams.sort - The order in which results are returned.
     * @param  {Number} queryParams.start - The first element in order to be returned.
     * @param  {String} queryParams.facetquery - Query to filter the main result. Cachable. Default is none.
     * @param  {Bool}   queryParams.isManaged - If true the result set only contains on managed elements. If set to false on unmanaged elements are returned. (Only Managed elements are visible in the authoring UI) Default are all elements. No difference between managed an unmanaged.
     * @param  {Object} queryParams.dismax - Object containing dismax specific settings. If this param exists dismax parser is enabled.
     * @param  {Bool}   queryParams.dismax.extended - Boolean specifing if the extended dismax parsers should be used. Defaults to false (and hence to the dismax parser).
     * @param  {String} queryParams.dismax.queryFields - The index fields against which the query is evaluated. Can either be a string with multiple fields separated by a space or an array.
     * @param  {Object} queryParams.facet - Object containing facet specific settings. If this param exists faceting is enabled.
     * @param  {String} queryParams.facet.fields - The fields which are used for creating the facet. Can either be a string with multiple fields separated by a space or an array.
     * @param  {Object} queryParams.facet.range - Object containing range specific settings for facets.
     * @param  {String} queryParams.facet.range.fields - The fields which are used for creating the range facet. Can either be a string with multiple fields separated by a space or an array.
     * @param  {String} queryParams.facet.range.start - The starting point to create the range.
     * @param  {String} queryParams.facet.range.end - The endpoint of the range.
     * @param  {String} queryParams.facet.range.gap - Identifies the steps between a point in the range.
     * @param  {Number} queryParams.facet.mincount - Specifies the minimum counts required for a facet field to be included in the response.
     * @param  {Number} queryParams.facet.limit - Controls how many constraints should be returned for each facet.
     * @param  {Object} queryParams.facet.contains - Object containing the facet contains settings.
     * @param  {String} queryParams.facet.contains.text - Limits the terms used for faceting to those that contain the specified substring.
     * @param  {Bool}   queryParams.facet.contains.ignoreCase - If facet.contains is used, ignore case when searching for the specified substring.
     * @param  {Object} queryParams.spatialsearch - Object containing all information required to do a spacial search
     * @param  {Object} queryParams.spatialsearch.position - Object storing longitute and latitude of geoposition from where to search
     * @param  {Number} queryParams.spatialsearch.position.lat - Latitute
     * @param  {Number} queryParams.spatialsearch.position.lng - Longitute 
     * @param  {Number} queryParams.spatialsearch.distance - Distance in kilomenters (default) to search for matching content around the position
     * @param  {String} queryParams.spatialsearch.distanceUnit - Distance unit. Defaults to `kilometers`. Can also be set to `miles` and `degrees`
     * @param  {String} queryParams.spatialsearch.filter - Logic for distance calulation. Defaults to `geofilter`. Can also be `bbox`.
     * @param  {String} queryParams.spatialsearch.field - THe indexed field where the geopositiong of the content item is stored. This normally should not be changed from the default which is `locations`.
     * @param  {String} queryParams.spatialsearch.sort - Adds a convenience sort method based on the SOLR geodist() function. You simply add 'asc' or 'desc' here.
     * @param  {Object} queryParams.override - Easy way to override settings for a specific field.
     * @return {Promise} - Resolves when the search finished.
     */
    query(queryParams) {
        //  TODO Transform to es6 variable deconstructing
        // General standard query variables
        let _query = queryParams.query || '*:*';
        let _fields = queryParams.fields || '*';
        let _rows = ('rows' in queryParams && typeof queryParams.rows === 'number') ? queryParams.rows : 10;
        let _sort = queryParams.sort || '';
        let _start = queryParams.start || 0;
        let _fq = queryParams.facetquery || '';
        // Edismax main parser variables
        let _useDismax = 'dismax' in queryParams;
        let _dismaxType = (_useDismax && queryParams.dismax.extended) ? 'edismax' : 'dismax';
        let _defType = (_useDismax) ? _dismaxType : 'lucene';
        let _qf = (_useDismax) ? queryParams.dismax.queryFields : undefined;
        // Facet specific variables
        let _useFacets = queryParams.facet !== undefined;
        let _facet = queryParams.facet || {};
        let _facetFields = _facet.fields || [];
        let _facetMincount = _facet.mincount || 0;
        let _facetLimit = _facet.limit || 10;
        let _facetContains = _facet.contains || {};
        let _facetContainsText = _facetContains.text || undefined;
        let _facetContainsIgnoreCase = _facetContains.ignoreCase || undefined;
        let _facetRange = _facet.range || {};
        let _facetRangeFields = _facetRange.fields || [];
        let _facetRangeStart = _facetRange.start || undefined;
        let _facetRangeEnd = _facetRange.end || undefined;
        let _facetRangeGap = _facetRange.gap || undefined;
        // Spacial search specific variables
        let _spacialsearch = queryParams.spacialsearch || {};
        let _spacialfilter = (_spacialsearch.position) ? _spacialsearch.filter || 'geofilt' : '';
        let _spacialfilterfq = (_spacialsearch.position) ? `{!${_spacialfilter}}` : '';
        let _spacialdistance = _spacialsearch.distance || undefined;
        let _spacialfield = (_spacialsearch.position) ? _spacialsearch.field || 'locations' : undefined;
        let _distanceUnits = _spacialsearch.distanceUnits || undefined;
        let _spacialposition = _spacialsearch.position || {};
        let _spacialsort = ('sort' in _spacialsearch) ? `geodist() ${_spacialsearch.sort}` : '';

        // Override settings for specific fields
        let _override = queryParams.override || {};
        let f = {};
        for(let key in _override) {
            f['f.'+key] = _override[key];
        }
        // WCH specific variables
        let _isManaged = ('isManaged' in queryParams) ? `isManaged:("${queryParams.isManaged}")` : '';

        return this.connector.loginstatus.
                then((base) => (
                  {
                    baseUrl: base,
                    qs: Object.assign({
                        q: _query,
                        fl: _fields,
                        fq: new Array().concat(_fq, _isManaged, _spacialfilterfq).filter(ele => (ele !== '')),
                        rows: _rows,
                        sort: [_sort, _spacialsort].filter(ele => (ele !== '')).join(','),
                        start: _start,
                        defType: _defType,
                        qf: _qf,
                        facet: _useFacets,
                        'facet.range': _facetRangeFields,
                        'facet.range.start': _facetRangeStart,
                        'facet.range.end': _facetRangeEnd,
                        'facet.range.gap': _facetRangeGap,
                        'facet.contains': _facetContainsText,
                        'facet.contains.ignoreCase': _facetContainsIgnoreCase,
                        'facet.mincount': _facetMincount,
                        'facet.limit': _facetLimit,
                        'facet.field' : _facetFields,
                        'd': _spacialdistance,
                        'sfield': _spacialfield,
                        'pt': `${_spacialposition.lat},${_spacialposition.lng}`,
                        'distanceUnits': _distanceUnits                    
                    }, f),
                    useQuerystring: true
                  }
                )).
                then(options => this.connector.send(options, this.connector.retryHandler));
    }

    /**
     * Convenience method to create valid delivery urls to asset resources. This method is mainly for
     * the purpose of understanding on how a valid delivery URL can look like.
     * @param  {Object} options - Options on how to generate the delivery Urls.
     * @param  {String} options.urlType - Defines the URL type. Valid options are `id`, `path` and `akami`. Default type is id.
     * @param  {Object} options.queryParams - Refines the query to match for a specific set of assets. All params as in `query` are allowed expect for query and fields.
     * @return {Promise} Resolves with an array of url strings, or just a string when there is only one result.
     */
    resourceDeliveryUrls(options) {
      let _options = options || {};
      let urlType = _options.urlType || 'id';
      let urlTypes = {
          id: {
              field:'resource',
              transform: (baseUrl, path, resource) => `${baseUrl}${path}/${encodeURIComponent(resource)}`
          },
          path: {
              field:'path',
              transform: (baseUrl, path, resource) => `${baseUrl}${path}?path=${encodeURIComponent(resource)}`
          },
          akami: {
              field:'path',
              transform: (baseUrl, path, resource) => `${baseUrl.replace('/api/', '/')}${encodeURIComponent(resource)}`
          }
      };

      let selectedUrlType = urlTypes[urlType];

      let searchQry = Object.
      assign(
          {},
          _options.queryParams,
          {
              query: 'classification:asset',
              fields: selectedUrlType.field
          }
      );

      return Promise.all([this.connector.loginstatus, this.query(searchQry)]).
      then(values =>  ({baseUrl: values[0], qry: values[1].documents})).
      then(result => result.qry.map(doc => selectedUrlType.transform(result.baseUrl, wchEndpoints.delivery.uri_resource, doc[selectedUrlType.field])));   
    }

    /**
     * Convenience filter to filter the resultset for taxonomies.
     * @param  {queryParams} queryParams - See query method for all available params
     * @return {Promise} Resolves when the query result is available.
     */
    taxonomies(queryParams) {
      let filter = Object.assign({},
        queryParams,
        {
          query: 'classification:taxonomy'
        });
      return this.query(filter);
    }

    /**
     * Getter for content type definitions. Simple wrapper around search API.
     * All params allowed as in query except for query which is predefined.
     * @param  {Object} queryParams - The params object to build a query. Not all params are supported yet!
     * @param  {String} queryParams.fields - The fields returned from the search. Default are all fields.
     * @param  {String} queryParams.facetquery - Query to filter the main result. Cachable. Default is none.
     * @param  {Number} queryParams.rows - Amount of results returned. Default is 10 elements.
     * @param  {String} queryParams.sort - The order in which results are returned.
     * @param  {Number} queryParams.start - The first element in order to be returned.
     * @return {Promise} - Resolves when the search finished.
     */
    contentTypeDefinitions(options) {
        let searchQry = Object.assign({}, options, {query: 'classification:content-type'});
        return this.query(searchQry);
    }

    imageProfileWithName(name) {
        var _filter = (name) ? ' AND name:'+name : '';
        return this.query({
            query: `classification:image-profile${_filter}`,
            rows: 1
        });
    }

    allContentOfType(type, rows, sortAsc, start) {
        var _filter = (type) ? ' AND type:'+type : '',
            _sort = `lastModified ${(sortAsc) ? 'asc' : 'desc'}`;

        return this.query({
            query: `classification:content${_filter}`,
            rows: rows,
            sort: _sort,
            start: start
        });
    }

    contentById(type, id, filter) {
        var _type = escapeSolrChars(type) || '',
            _id = escapeSolrChars(id) || '',
            _filter = filter || '';
        return this.query({
            query: `id:${_filter}${_type}\\:${_id}`,
            rows: 1
        });
    }

    allAssetsAndContent(filter, rows, sortAsc) {
        var _filter = (filter) ? ' '+filter : '',
            _sort = `lastModified ${(sortAsc) ? 'asc' : 'desc'}`;
        return this.query({
            query: '*:*',
            facetquery: _filter,
            rows: rows,
            sort: _sort
        });
    }

    countFoundResults(queryParams){
        let param = queryParams || {};
        if(queryParams){
            Object.keys(queryParams).forEach((k) => {
                param[k] = queryParams[k];
            })
        }
        param['rows'] = 0;
        return this.query(param).then((result) => result.numFound);
    }
}

module.exports = Search;