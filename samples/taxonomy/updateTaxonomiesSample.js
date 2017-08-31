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
// Note: In order for this sample to work you need to first execute the getTaxonomySample.js sample. This script will 
// update the taxonomy by appending an Updated to all Element names. It also adds on the first level a new child category. 
///////////////////

// I've placed my credentials in a separate .env file. You can remove this line and
// add your credentials directly to the wchconfig variable down below. 
const fs = require('fs');
const path = require('path');
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
const pathToSample = path.join(__dirname, 'getTaxonomiesSampleResult.json');
const taxonomyDef = JSON.parse(fs.readFileSync(pathToSample));

function writeFile(objTax) {
  return new Promise((res, rej) => {
    fs.writeFile(path.join(__dirname, "updateTaxonomiesSampleResult.json"), JSON.stringify(objTax, null, 1), 
    (err) => {
      if (err) {
          console.error(err);
          rej(err);
      };
      console.log("File has been created");
      res(objTax);
    });
  });
}

wchConnector.taxonomy.updateTaxonomies(taxonomyDef).
then(writeFile).
then(objTax => JSON.stringify(objTax, null, 1)).
then(console.log);