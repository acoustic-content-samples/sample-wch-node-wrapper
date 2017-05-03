/*
 * Copyright 2017  IBM Corp.
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
        baseUrl: env.credentials.baseurl, // Required! The API Url found on the authoring UI
        credentials: {
          usrname: env.credentials.usrname, // Replace with your blueid
          pwd: env.credentials.pwd // Replace with your password
        }
      };

// Since I'm in the sample directly I directly require the entry point...
const wchConnector = require('../src/index')(wchconfig); 
// In your case this changes to:
// const wchConnector = require('sample-wch-node-connector')(wchconfig);

// Enter you the name of you in your WCH tenant here and see how many content
// you've created over the last month. 
const authorName = 'Author Name';

// A simple facet range query looking for items you've created and modified in the last 
// 30 days.
wchConnector.search.query({
        query : 'creator:"'+authorName+'"',
        rows : 0,
        facet: {
          range: {
            fields: ['created', 'lastModified'],
            start: 'NOW/DAY-30DAYS',
            end: 'NOW',
            gap: '+1DAY'
          },
          mincount: 0
        }
      }).then(data => console.log(data.facet_ranges));