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
      return authSDK.uploadResource(path.resolve('test', 'lab_services.jpg')).then(console.log, console.err);
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
      var assetDef = {
        id: 'SvensUniqueAssetId2',
        tags: {"values":['test', 'upload'],"declined":[],"analysis":"none"},
        description: 'This is kind of a test upload my dear',
        name: 'UploadAssetTest'
      }
      return authSDK.uploadAsset(path.resolve('test', 'lab_services.jpg'), 'lab123.jpg', assetDef).then(console.log, console.err);
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

});