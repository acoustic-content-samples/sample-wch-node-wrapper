/*
 * Copyright 2016  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
'use strict';
const Promise = require('bluebird');
const crypto = require('crypto');
const fs = require('fs');
const hash = crypto.createHash('md5');

function generateMD5Hash(stream, hashEncoding, digestEncoding) {
  let encoding = digestEncoding || 'base64';
  let hashType = (crypto.getHashes().indexOf(hashEncoding) > -1) ? hashEncoding : 'md5';
  
  return new Promise((resolve, reject) => {
    var hash = crypto.createHash(hashType);

    stream.on('data', function (data) {
        hash.update(data, 'utf8');
    });

    stream.on('end', function () {
        resolve(hash.digest(encoding));
    });

    stream.on('error', function (error) {
        reject(error);
    });

  });
}

module.exports.generateMD5Hash = generateMD5Hash;