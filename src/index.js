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

//////////////////////////////
// WCH Node API Connector
//////////////////////////////

/// This connector provides generall access to the search API for WCH.
/// There are high level methods to access the different content types
/// and add common search patterns to the query.

// Immutable connection endpoints to WCH.
const WchConnector = require('./WchConnector');
const WchAuthoringConnector = require('./WchAuthoringConnector');

/**
 * Initalization of the wch connector.
 * @param  {Object} config - Optional parameter with credentials and default settings
 * @return {Object} - Wrapper to common API calls towards Watson Content Hub
 */
module.exports = function(config) {
  return (config.endpoint === 'delivery') ? new WchConnector(config) : new WchAuthoringConnector(config);
}