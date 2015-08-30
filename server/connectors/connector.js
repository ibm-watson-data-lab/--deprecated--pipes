//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

/**
 * CDS Labs module
 * 
 *   Base Connector object that every connector implementation  should inherit from
 * 
 * @author David Taieb
 */

var fs = require('fs');
var path = require('path');

function connector(){
	var id = null;
	var label = null;
	var steps = [];
	
	/**
	 * getId: return the unique id for this connector
	 */
	this.getId = function(){
		return id;
	};
	
	/**
	 * setId: set the unique id for this connector
	 */
	this.setId = function( _id ){
		id = _id;
	};
	
	/**
	 * getLabel: return the unique id for this connector
	 */
	this.getLabel = function(){
		return label;
	};
	
	/**
	 * setLabel: set the unique id for this connector
	 */
	this.setLabel = function( _label ){
		label = _label;
	};
	
	/**
	 * setSteps: set the running steps related to this connector
	 * steps must inherit from {@link pipeRunStep}
	 */
	this.setSteps = function( _steps ){
		steps = _steps;
	}
	
	/**
	 * getSteps: get the running steps related to this connector
	 */
	this.getSteps = function(){
		return steps;
	}
	
	/**
	 * Initialize the connector
	 * @param app: express app to register end points specific to the connector
	 */
	this.init = function( app ){
		console.log("Connector initialized");
	};
	
	/**
	 * authCallback: callback for OAuth authentication protocol
	 * @param oAuthCode
	 * @param pipeId
	 * @param callback(err, pipe )
	 */
	this.authCallback = function( oAuthCode, pipeId, callback ){
		return callback({
			message : "Not Authorized",
			code: 401
		});
	};
	
	/**
	 * connectDataSource: connect to the backend data source
	 * @param req
	 * @param res
	 * @param pipeId
	 * @param url: login url
	 * @param callback(err, results)
	 */
	this.connectDataSource = function( req, res, pipeId, url, callback ){
		return callback({
			message : "Not Authorized",
			code: 401
		});
	};
	
	/**
	 * toJSON serialization function
	 */
	this.toJSON = function(){
		return {
			id: this.getId(),
			label: this.getLabel(),
			steps: this.getSteps()
		}
	}
};

//Export the class
module.exports = connector;