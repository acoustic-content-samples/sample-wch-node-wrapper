/*
 * Copyright 2016  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
'use strict'

// I've placed my credentials in a separate .env file. You can remove this line and
// add your credentials directly to the wchconfig variable down below. 
const env = require('../.env');
const wchconfig = {
        endpoint: 'authoring',
        tenantid: env.credentials.tenantid, // Replace with your tenant
        credentials: {
          usrname: env.credentials.usrname, // Replace with your blueid
          pwd: env.credentials.pwd // Replace with your password
        }
      };
// Since I'm in the sample directly I directly require the entry point...
const wchConnector = require('../index')(wchconfig); 
// In your case this changes to:
// const wchConnector = require('sample-wch-node-connector')(wchconfig);

// A simple typeahead solution based on facets
wchConnector.doSearch({
        query : '*test*',
        rows : 0,
        dismax: {
          extended: true,
          queryFields: ['name', 'assetType', 'tags', 'status', 'categoryLeaves keywords renditionCount'],
        },
        facet: {
          fields: ['name', 'assetType', 'tags', 'status', 'categories', 'categoryLeaves', 'keywords'],
          mincount: 1,
          limit: 3,
          contains : {
            text: 'test',
            ignoreCase: true
          }
        }
      }).then(console.log);