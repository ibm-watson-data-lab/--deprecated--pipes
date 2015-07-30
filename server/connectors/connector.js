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
			steps: this.getSteps()
		}
	}
};

//Export the class
module.exports = connector;