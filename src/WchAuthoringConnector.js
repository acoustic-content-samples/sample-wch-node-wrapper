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

// Immutable connection endpoints to WCH.
// const wchEndpoints = require('./wchConnectionEndpoints');
const WchConnector = require('./WchConnector');
const Asset = require('./v1/Asset');
const Taxonomy = require('./v1/Taxonomy');
const Content = require('./v1/Content');

/**
 * Class containing all authoring only API methods. Rule of thumb: All create, update & delete
 * methods are only available in authoring.
 */
class WchAuthoringConnector extends WchConnector {
    constructor(configuration) {
      super(configuration);
      
      const connector = {
          wchConnector: this
      };

      this.Asset = new Asset(connector);

      this.Taxonomy = new Taxonomy(connector);

      this.Content = new Content(connector);
    }

    /**
     * creates a fresh Asset instance for use with the connector
     * @return {Asset}
     */
    get asset() {return this.Asset;}

    /**
     * Creates a fresh Taxonomy instance for use with the connector
     * @return {Taxonomy}
     */
    get taxonomy() {return this.Taxonomy;}
 
     /**
     * Creates a fresh Taxonomy instance for use with the connector
     * @return {Taxonomy}
     */
    get content() {return this.Content;}   
    
}
module.exports = WchAuthoringConnector;