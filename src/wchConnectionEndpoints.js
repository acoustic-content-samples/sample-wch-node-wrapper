module.exports = {
        authoring : {
          baseUrl: 'https://my.digitalexperience.ibm.com/api', 
          uri_search: '/authoring/v1/search',
          uri_auth: '/login/v1/basicauth',
          uri_resource: '/authoring/v1/resources',
          uri_assets: '/authoring/v1/assets',
          uri_types: '/authoring/v1/types'
        },
        publishing:  {
          baseUrl: 'https://my.digitalexperience.ibm.com/api',
          uri_resource: '/delivery/v1/resources',
          // At the moment there is no delivery system for search and auth 
          // hence the endpoints are the same as in authoring... TODO
          uri_search: '/authoring/v1/search',
          uri_auth:   '/authoring/v1/basicauth'
        }
      };