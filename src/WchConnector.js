/*
 * Copyright 2017  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */

'use strict';

const rp = require('request-promise-native');
const wchEndpoints = require('./util/wchConnectionEndpoints');
const Search = require('./v1/Search');

/**
 * Class for API access towards Watson Content Hub. ES6 Classes style.
 */
class WchConnector {
    /**
     * Initalizes the connection to WCH. This module is designed to be
     * instanciated multiple times. E.g. for logged in and anonymous uses
     * in parallel.
     *
     * @param  {Object} configuration - Config options for WCH
     * @return {Class} - Initalized SDK ready to query for content
     */
    constructor (configuration) {
        // Init config with default
        this.configuration = Object.assign({
            endpoint: 'delivery',
            rejectUnauthorized: true,
            maxSockets: 10
        }, configuration);

        this.endpoint = wchEndpoints[this.configuration.endpoint];
        
        // Request-promise module default options
        this.cookieJar = rp.jar();
        this.options = {
            baseUrl: this.configuration.baseUrl || `${this.endpoint.baseUrl}`,
            uri: this.endpoint.uri_search,
            qsStringifyOptions: {encode:true},
            agentOptions: {
                rejectUnauthorized: this.configuration.rejectUnauthorized
            },
            jar: this.cookieJar,
            json: true,
            pool: {
                maxSockets: this.configuration.maxSockets,
                keepAlive: true
            }
        };

        let creds = this.configuration.credentials;
        this.loginstatus = (creds) ? this.dologin(creds, this.configuration.tenantid) : Promise.resolve(this.configuration.baseUrl);

        this.retryHandler = error => {
            if(error.statusCode === '403') {
                console.log('Authentication failed... try login again,');
                this.loginstatus = this.dologin(creds, this.configuration.tenantid);
            }
            throw error;
        };

        if(configuration.hasOwnProperty('debug') && typeof configuration.debug === 'boolean'){
            this.debug = configuration.debug;
        }else{
            this.debug = false;
        }

        if(configuration.hasOwnProperty('errorLogger') && typeof configuration.errorLogger === 'function'){
            this.errorLogger = configuration.errorLogger;
        }else{
            this.errorLogger = err => {
                if (this.debug)
                    console.error("Error: ", err);
                throw err;
            }
        }
    }

    /**
     * In case of error try to login again. This is a quick-fix. More sophistiacted would be
     * to observe the expiry date of the authentication cookie... clearly a TODO.
     * @param  {Object} options - Request-Promise options Object(value?: any)
     * @return {Promise} - Waiting for the response
     */
    send(options, retryHandling) {
        return rp(options).
            catch(this.errorLogger).
            catch(err => retryHandling(err).
            then(() => rp(options)));
    }

    /**
     * creates a fresh Search instance for use with the connector
     * @return {Search}
     */
    get search() {
        return new Search({
            wchConnector: this
        });
    }

    /**
     * @return {Boolean} - True if the connector targets delivery system, otherwise false.
     */
    isDeliveryContext() {
        return this.configuration.endpoint === 'delivery';
    }

    /**
     * Login to WCH as authenticated user.
     * @param  {Object} credentials - Containing username and password
     * @param  {String} [credentials.usrname] - The blueid for an admin user
     * @param  {String} [credentials.pwd] - The password to the admin user
     * @param  {String} [tenantid] - Tenant id for the tenant to do the login for
     * @return {Promise} - Promise resolves with the WCH baseUrl as String
     */
    dologin(credentials, tenantid) {
        let username = credentials.usrname;
        let pwd = credentials.pwd;
        let request = Object.assign({},
            this.options,
            {
                uri: this.endpoint.uri_auth,
                headers: {
                    'x-ibm-dx-tenant-id': tenantid || undefined
                },
                auth: {
                    user: credentials.usrname,
                    pass: credentials.pwd
                },
                resolveWithFullResponse: true
            });
        return rp(request).
        catch(this.errorLogger).
        then(data => data.headers['x-ibm-dx-tenant-base-url']);
    }
}

module.exports = WchConnector;
