/*
 * Copyright 2016  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
module.exports = {
        authoring : {
          baseUrl: 'https://www.digitalexperience.ibm.com/api', // Used for login. After that make sure to use endpoint returned on succesful login response.
          uri_search: '/authoring/v1/search',
          uri_auth: '/login/v1/basicauth',
          uri_resource: '/authoring/v1/resources',
          uri_assets: '/authoring/v1/assets',
          uri_types: '/authoring/v1/types',
          uri_categories: '/authoring/v1/categories'
        },
        delivery :  {
          akamiUrl: 'https://my.digitalexperience.ibm.com',
          baseUrl: 'https://www.digitalexperience.ibm.com/api',
          uri_resource: '/delivery/v1/resources',
          // At the moment there is no delivery system for search and auth 
          // hence the endpoints are the same as in authoring... TODO
          uri_search: '/authoring/v1/search',
          uri_auth:   '/login/v1/basicauth'
        }
      };