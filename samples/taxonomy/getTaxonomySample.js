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

///////////////////
// Note: The sample is configured to return the taxonomy which was created by the createTaxonomiesSample.js. 
// Either run that sample first or adapt the search query to find an existing taxonomy in your tenant. 
///////////////////

const fs = require('fs');
const path = require('path');
// I've placed my credentials in a separate .env file. You can remove this line and
// add your credentials directly to the wchconfig variable down below. 
const env = require('../../.env');
const wchconfig = {
        endpoint: 'authoring',
        baseUrl: env.credentials.baseurl, // Required! The API Url found on the authoring UI
        credentials: {
          usrname: env.credentials.usrname, // Replace with your blueid
          pwd: env.credentials.pwd // Replace with your password
        }
      };

// Since I'm in the sample directly I directly requre the entry point...
const wchConnector = require('../../index')(wchconfig); 
// In your case this changes to:
// const wchConnector = require('sample-wch-node-connector')(wchconfig);

function writeFile(objTax) {
  return new Promise((res, rej) => {
    fs.writeFile(path.join(__dirname, "getTaxonomiesSampleResult.json"), JSON.stringify(objTax, null, 1), 
    (err) => {
      if (err) {
          console.error(err);
          rej(err);
      };
      console.log("File has been created");
      res(objTax[0]);
    });
  });
}

wchConnector.taxonomy.getTaxonomies({facetquery: 'name:mycool*'}, {simple:true}).
then(objTax => writeFile(objTax)).
then(objTax => console.log(JSON.stringify(objTax, null, 1)));