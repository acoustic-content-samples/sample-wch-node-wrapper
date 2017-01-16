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
const fs = require('fs');

const env = require('../.env');
const authSDK = require('../index')({
        endpoint: 'authoring',
        tenantid: env.credentials.tenantid,
        credentials: {
          usrname: env.credentials.usrname,
          pwd: env.credentials.pwd
        }
      }),
      publishSDK = require('../index')({
        tenantid: env.credentials.tenantid
      });

describe('WchConnector', function() {

  describe.only('#init(config)', function() {
    
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

    it('should perform a complex query.' , function() {
      this.timeout(20000);
      return authSDK.doSearch({
        query : '*:*',
        fields: 'creator, lastModified, classification',
        facetquery : ['classification:asset', 'lastModified:[2016-12-20T09:15:25.882Z TO NOW]'],
        amount : 30,
        sort : 'creator asc, lastModified desc',
        start : 5
      });
    });

    it.only('should perform a facet query.' , function() {
      this.timeout(20000);
      return authSDK.doSearch({
        query : '*test*',
        amount : 0,
        edismax: {
          queryFields: ['name', 'assetType', 'tags', 'status', 'categoryLeaves keywords renditionCount'],
        },
        facet: {
          fields: ['name', 'assetType', 'tags', 'status', 'categoryLeaves', 'keywords', 'creator'],
          range: {
            fields: ['created', 'lastModified'],
            start: 'NOW/DAY-30DAYS',
            end: 'NOW',
            gap: '+1DAY'
          },
          mincount: 1,
          limit: 10,
          contains : {
            text: 'Test',
            ignoreCase: true
          }
        },
        override: {
          'created.facet.mincount': 0, 
          'lastModified.facet.mincount': 0
        }
      }).then(data => console.log(data.facet_ranges));
    });

    it('should perform a contenttype query.' , function() {
      this.timeout(20000);
      return authSDK.getContentTypeDefinitions().then(console.log);
    });

    it('should return delivery URLs', function() {
      this.timeout(30000);
      return authSDK.getResourceDeliveryUrls({queryParams:{facetquery:'name:*TypeTest*',isManaged:false},urlType:'akami'}).then(console.log);
    });

  });

  describe('#dologin', function() {

    it('should create a valid auth cookie to access private content');

  });

  describe('#uploadResource', function() {

    it('should upload a resource', function() {
      this.timeout(20000);
      let resource = {
        filePath : path.resolve('test', 'contenttype.js'),
        fileName : 'content.js',
        randomId : true
      }
      return authSDK.createResource(resource).then(console.log, console.err);
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
        resourceDef: {
          filePath : path.resolve('test', 'sampleresource.jpg'),
          fileName : 'sampleresource.jpg',
          randomId : true
        },
        assetDef : {
          tags: {"values":['test', 'upload'],"declined":[], "analysis":"none"},
          description: 'This is kind of a test upload my dear',
          name: 'ContentTypeTestTest',
          categoryIds:["12fbc71263acc432dbeb5a31b5ce70af"]
        }
      }
      return authSDK.
        uploadAsset(asset).
        then(console.log, console.err);
    });

    it('should be able to upload a new web asset based on an new resource', function() {
      let asset = {
        resourceDef: {
          filePath : path.resolve('test', 'sampleresource.jpg'),
          fileName : 'sampleresource.jpg',
          randomId : false
        },
        assetDef : {
          tags: {"values":['test', 'upload'],"declined":[], "analysis":"none"},
          description: 'This is kind of a test upload my dear',
          name: 'ContentTypeTestTest',
          categoryIds:["12fbc71263acc432dbeb5a31b5ce70af"],
          path: '/sample/sampleresource.jpg'
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
      return authSDK.deleteAsset('a8a100ce-7aa2-4c64-a05a-4f1e7f8b104e').then(console.log, console.err);
    });

  });

  describe('#deleteAssets', function() {
    this.timeout(200000);

    it('should be able to delete multiple existing assets', function() {
      return authSDK.deleteAssets('name:*Calendar*').then(console.log, console.err);
    });

  });

  describe('#uploadContentType', function() {
    this.timeout(20000);

    it('should be able to upload a contenttype', function() {
      return authSDK.createContentType(require('./contenttype')).then(console.log, console.err);
    });

  });

  describe('#createCategory', function() {
    this.timeout(20000);

    it('should be able to create a new category', function() {
      let categoryDef = {
        name: "Yo!"
      }
      return authSDK.
        createCategory(categoryDef).
        then(console.log, console.err);
    });

  });

  describe('#createTaxonomy', function() {
    this.timeout(20000);

    it('should be able to create a new taxonomy', function() {
      let sampletax = JSON.parse(fs.readFileSync('./test/sampletax.json'));
      return authSDK.
        createTaxonomies(sampletax).
        then(console.log, console.err);
    });

  });

  describe('#deleteTaxonomy', function() {
    this.timeout(20000);

    it('should be able to delete a new taxonomy', function() {
      return authSDK.
        deleteTaxonomies('name:mycooltesttax').
        then(console.log, console.err);
    });

  });


  describe('#getCategoryTree', function() {
    this.timeout(20000);

    it('should be able to retrieve a complete taxonomy', function() {
      return authSDK.
        getCategoryTree('63b4f36de6e3c2a1116fbd837106a81d').
        then(console.log, console.err);
    });

  });


});