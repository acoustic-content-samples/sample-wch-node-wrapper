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
const fs = require('fs');
const path = require('path');
const env = require('../.env');
const wchconfig = {
        endpoint: 'authoring',
        credentials: {
          usrname: env.credentials.usrname, // Replace with your blueid
          pwd: env.credentials.pwd // Replace with your password
        }
      };

// Since I'm in the sample directly I directly requre the entry point...
const wchConnector = require('../index')(wchconfig); 
// In your case this changes to:
// const wchConnector = require('sample-wch-node-connector')(wchconfig);
const pathToSample = path.join(__dirname, 'createTaxonomiesSample.json');
const taxonomyDef = JSON.parse(fs.readFileSync(pathToSample));
      
wchConnector.taxonomy.createTaxonomies(taxonomyDef).
then(console.log);