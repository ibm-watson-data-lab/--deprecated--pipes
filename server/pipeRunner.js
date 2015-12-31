'use strict';

/**
*	Pipe Runner implementation
*	@Author: David Taieb
*/

var pipesSDK = require('pipes-sdk');
var cloudant = pipesSDK.cloudant;
var _ = require("lodash");
var async = require("async");
var connectorAPI = require("./connectorAPI");

function pipeRunner( pipe ){
	this.pipe = pipe;
	
	//Private APIs
	var validate = function(){
		if ( !this.pipe.tables ){
			return "Cannot run because pipe is not connected";
		}
	}.bind( this );	
	
	var getSteps = function(){
		//Get the steps from the connector associated with this pipe
		var connector = connectorAPI.getConnector( pipe );
		if ( !connector ){
			console.log("Can't find connector %s", pipe.connectorId );
			return [];
		}
		return connector.getSteps();
	};
	
	var runStarted = function(readyCallback){
		var connector = connectorAPI.getConnector( pipe );
		if ( !connector ){
			return console.log("Can't find connector %s", pipe.connectorId );
		}
		return connector.runStarted(readyCallback);
	}
	
	var runFinished = function(){
		var connector = connectorAPI.getConnector( pipe );
		if ( !connector ){
			return console.log("Can't find connector %s", pipe.connectorId );
		}
		return connector.runFinished();
	}
	
	//Public APIs
	/**
	 * getSourceTables
	 * @returns: array of source tables to be processed by the pipe 
	 */
	this.getSourceTables = function(){
		if ( !this.pipe.tables ){
			//Pipe is not connected, should never happen
			return [];
		}
		if ( this.pipe.selectedTableId ){
			var retTable = _.find( this.pipe.tables, function( table ){
				return table.name == this.pipe.selectedTableId;
			}.bind(this));
			return [retTable];
		}
		//Return all tables, filter out the one with no name
		return _.filter(pipe.tables, function(table){
			return !!table.name;
		});
	}.bind( this );
	
	/**
	 * Create a new run
	 */
	this.newRun = function( callback ){
		var err = validate();
		if ( err ){
			return callback( err );
		}

		var steps = getSteps();
		var pipeRunStats = new (require("./pipeRunStats"))( pipe, steps, function(err){
			if ( err ){
				return callback(err);
			}
			pipeRunStats.start( function(err){
				if ( err ){
					return pipeRunStats.done( err );
				}
				runStarted(function(err){
					if ( err ){
						return pipeRunStats.done(err);
					}
					var logger = pipeRunStats.logger;
					async.eachSeries( steps, function( step, callback ){
						try{
							step.beginStep( this, pipeRunStats );
							step.run( function( err ){
								if ( err ){
									return callback( err );
								}
								step.endStep( callback );
							});
						}catch(e){
							//Error caught
							logger.error("Exception caught: " + e);
							logger.error("Stack: " + e.stack);
							step.endStep( callback, e );
						}
					}.bind(this), function( err ){
						//All done
						runFinished(err);
						pipeRunStats.done( err );
					});
				}.bind(this));
			}.bind(this));
			
			//Request accepted, send response back to the client immediately
			return callback( null, pipeRunStats);
		}.bind(this));
	};
}

//Export the module
module.exports = pipeRunner;