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
wchConnector.doQuery({
        query : '*:*',
        fields: 'creator, lastModified, classification',
        facetquery : ['classification:asset', 'lastModified:[2016-12-20T09:15:25.882Z TO NOW]'],
        amount : 5,
        sort : 'creator asc, lastModified desc',
        start : 0
      }).
      then(console.log);