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
//////////////////////////////
// wchConnector Unit tests
//////////////////////////////

const assert = require('assert');
const should = require('should');
const path = require('path');

const env = require('../.env');
const authSDK = require('../index')({
        endpoint: 'authoring',
        tenantid: env.credentials.tenantid,
        credentials: {
          usrname: env.credentials.usrname,
          pwd: env.credentials.pwd
        }
      }),
      publishSDK = require('../src/wchConnector')({
        tenantid: env.credentials.tenantid
      });

describe('WchConnector', function() {

  describe('#init(config)', function() {
    
    it('should initalize against publishing if configuration.endpoint is set to authoring', function() {
      (authSDK.isPublishContext()).should.be.false();
    });

    it('should initalize per default against publishing API', function() {
      (publishSDK.isPublishContext()).should.be.true();
    });

    // it('should get all content at assets (anonymous)', function() {
    //   return publishSDK.getAllAssetsAndContent()
    //         .should.eventually.not.be.null()
    //         .and.be.an.instanceOf(Object)
    //         .and.have.properties(['numFound', 'documents']);
    // });

    it('should get all content at assets (logged in)', function() {
      this.timeout(20000);
      return authSDK.getAllAssetsAndContent()
            .should.eventually.not.be.null()
            .and.be.an.instanceOf(Object)
            .and.have.properties(['numFound', 'documents']);
    });

  });

  describe('#dologin', function() {

    it('should create a valid auth cookie to access private content');

  });

  describe('#uploadResource', function() {

    it('should upload a resource', function() {
      this.timeout(20000);
      return authSDK.createResource(path.resolve('test', 'lab_services_15.jpg'), 'qweretr.jpg', false).then(console.log, console.err);
    });

  });

  describe('#createAsset', function() {
    this.timeout(20000);

    it('should be able to create a new asset based on an existing resource', function() {
      var assetDef = {
        id: 'bipapa',
        tags: {"values":['test', 'upload'],"declined":[],"analysis":"none"},
        description: 'This is kind of a test upload my dear',
        name: 'Lab Services 21321421421',
        resource: '487b66abe60198c36d5351645bf3de78'
      }
      return authSDK.createAsset(assetDef).then(console.log, console.err);
    });

  });

  describe('#uploadAsset', function() {
    this.timeout(20000);

    it('should be able to upload a new asset based on an new resource', function() {
      let asset = {
        filePath : path.resolve('test', 'contenttype.js'),
        fileName : 'contenttype.js',
        assetDef : {
          id: 'ContentTypeTest',
          tags: {"values":['test', 'upload'],"declined":[],"analysis":"none"},
          description: 'This is kind of a test upload my dear',
          name: 'ContentTypeTest'
        }
      }
      return authSDK.
        uploadAsset(asset).
        then(console.log, console.err);
    });

  });

  describe('#deleteAsset', function() {
    this.timeout(20000);

    it('should be able to delete an existing asset', function() {
      var assetDef = {
        id: 'SvensUniqueAssetId2',
        tags: {"values":['test', 'upload'],"declined":[],"analysis":"none"},
        description: 'This is kind of a test upload my dear',
        name: 'UploadAssetTest'
      }
      return authSDK.deleteAsset('SvensUniqueAssetId2').then(console.log, console.err);
    });

  });

  describe('#deleteAssets', function() {
    this.timeout(20000);

    it('should be able to delete multiple existing assets', function() {
      return authSDK.deleteAssets('name:*Death*').then(console.log, console.err);
    });

  });

  describe('#uploadContentType', function() {
    this.timeout(20000);

    it('should be able to upload a contenttype', function() {
      return authSDK.createContentType(require('./contenttype')).then(console.log, console.err);
    });

  });


});