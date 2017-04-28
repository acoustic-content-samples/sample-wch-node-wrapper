const expect = require('expect.js');
const env = require('../.env');
const Search = require('../src/Search');

const wchconfig = {
    endpoint: 'authoring',
    tenantid: env.credentials.tenantid, // Replace with your tenant
    credentials: {
        usrname: env.credentials.usrname, // Replace with your blueid
        pwd: env.credentials.pwd // Replace with your password
    }
};

const WchConnector = require('../src/WchConnector');

describe("sample search", ()=>{
    let wchConnector;
    let search;
    const newInstances = false;
    if(newInstances){
        beforeEach(() =>{
            wchConnector = new WchConnector(wchconfig);
            search = new Search({
                wchConnector: wchConnector
            });
        });
    }else{
        wchConnector = new WchConnector(wchconfig);
        search = new Search({
            wchConnector: wchConnector
        });
    }
    it('should return', function(done){

        this.timeout(10000);
        search.doSearch({
            query : '*:*',
            // fields: 'creator, lastModified, classification',
            // facetquery : ['classification:asset', 'lastModified:[2016-12-20T09:15:25.882Z TO NOW]'],
            rows : 5,
            // sort : 'creator asc, lastModified desc',
            start : 0
        }).
        then((result) => {
            console.log(typeof result);
            expect(typeof result).to.be('object');
            console.log("Results : ", result);
            done();
        }, (err) => {
            console.error("Error", err);
            done();
        });
    });
    it('can count all', function (done) {
        this.timeout(10000);
        search.countResults({
            query: '*:*'//,
            // fields: 'creator, lastModified, classification',
            // facetquery : ['classification:asset', 'lastModified:[2016-12-20T09:15:25.882Z TO NOW]'],
            // rows: 0//,
            // sort : 'creator asc, lastModified desc',
            // start : 0
        }).then((result) => {

            console.log("Results : ", result);
            console.log(typeof result);
            expect(typeof result).to.be('number');
            done();
        }, (err) => {
            console.error("Error", err);
            done();
        });
    })
});
