/*
 * Copyright 2016  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
const env = require('../.env');
const wchconfig = {
        endpoint: 'authoring',
        tenantid: env.credentials.tenantid, // Replace with your tenant
        credentials: {
          usrname: env.credentials.usrname, // Replace with your blueid
          pwd: env.credentials.pwd // Replace with your password
        }
      };
// Since I'm in the sample directly I directly requre the entry point...
const wchConnector = require('../index')(wchconfig); 
// In your case this changes to:
// const wchConnector = require('wchnode')(wchconfig);

// A simple query against authoring... feel free to play around
wchConnector.doSearch({
        query : '*:*',
        fields: 'creator, lastModified, classification',
        facetquery : ['classification:asset', 'lastModified:[2016-12-20T09:15:25.882Z TO NOW]'],
        amount : 5,
        sort : 'creator asc, lastModified desc',
        start : 0
      }).
      then(console.log);
