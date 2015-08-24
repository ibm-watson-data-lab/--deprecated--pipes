'use strict';

/**
 * CDS Labs module
 * 
 *   Library to dataWorks APIs
 * 
 * @author David Taieb
 */
var request = require('request');
var bluemixHelperConfig = require("bluemix-helper-config");
var global = bluemixHelperConfig.global;
var _ = require("lodash");
var util = require("util");
var vcapServices = bluemixHelperConfig.vcapServices;
var configManager = bluemixHelperConfig.configManager;

var proxyStarted = false;

/**
 * Main dataworks api class
 */
function dataworks( options ){
	
	options = options || {};
	
	var dwService = null;
	var url = null;
	var proxyTarget = null;
	var proxyRoot = null;
	var appEnv = null;
	
	//Init the instance
	(function(){
		dwService = vcapServices.getService( options.dwServiceName || "dataworks" );	
		if ( !dwService ){
			throw new Error( "Unable to find dataWorks service");
		}
		
		console.log("Using dataworks service: " + dwService.name);
		
		url = require('url').parse( dwService.credentials.url );
		//proxyTarget = "http://127.0.0.1:8084"; 
		proxyTarget = url.protocol + "//" + url.host;
		proxyRoot = "/proxy";
		
		if ( configManager.get("START_PROXY") && !proxyStarted){
			//Don't start the proxy more than once. For dev purpose, only one DW Instance is supported
			proxyStarted = true;
			var proxy = require("http-proxy").createProxyServer();
			global.app.use(proxyRoot, function(req, res ){				
				var newHeaders = {};
				_.forOwn( req.headers, function( value, key ){
					if ( ['authorization','accept','content-type','content-length'].indexOf( key.toLowerCase() ) >= 0 ){
						newHeaders[key] = value;
					}
				});
				req.headers = newHeaders;
				
				//Proxy the request to the target
				proxy.web( req, res, 
					{
						target: proxyTarget,
						secure: false
					}
				);
			});
			console.log("Proxy started on context root %s with target %s", proxyRoot, proxyTarget );
		}
	})();
	
	//Private APIs
	var serviceBindingUrl = "/dc/v1/activities";
	var makeUrl = function( path ){
		var baseUrl = configManager.get( "USE_PROXY") ? configManager.get("USE_PROXY") + proxyRoot + url.pathname : dwService.credentials.url;
		return baseUrl + serviceBindingUrl + ( path || "" );
	};
	
	var getReqOptions = function(){
		return {
			'strictSSL':false,
			'auth': {
				'user': dwService.credentials.userid,
				'pass': dwService.credentials.password,
				'sendImmediately': true
			},
			json: true
		}
	}
	
	var getError = function( err, body, bodyExpected ){
		if ( err ){
			return err;
		}
		
		if ( _.isPlainObject( body ) && body.hasOwnProperty("httpStatus") ){
			if ( body.httpStatus != 200 || body.httpStatus != 202 ){
				return body.msgExplanation || "Unexpected error";
			}
		}
		
		if ( !body && bodyExpected ){
			return "Unexpected error: dataworks api returned no error but no response payload was received";
		}
		
		return null;
	}
	
	
	//Public APIs
	/**
	 * Factory method for creating a new connection
	 */
	this.newConnection = function( type ){
		var connection = null;
		if ( type === "cloudant" ){
			connection = require("./cloudantConnection");
		}else if ( type === "dashDB" ){
			connection = require("./dashDBConnection");
		}else{
			console.log("Unknow connection type: %s", type );
			return null;
		}
		
		return new connection(this);
	}
	
	/**
	 * listActivities: return a list of activities for this instance
	 * @param callback( err, activities)
	 */
	this.listActivities = function(callback){
		request.get( makeUrl(), getReqOptions(), function(err, response, body){
			return callback( getError(err, body), body );
		});
	};
	
	/**
	 * getActivity: return an activity from an id
	 * @param activityId: id of the activity
	 * @callback(err, activity)
	 */
	this.getActivity = function( activityId, callback ){
		request.get( makeUrl( "/" + activityId), getReqOptions(), function(err, response, body){
			return callback( getError(err, body), body );
		});
	}
	
	/**
	 * getActivityByName: find an activity by name
	 * @param activityName: name of the activity
	 * @param callback(err, activity)
	 */
	this.getActivityByName = function( activityName, callback ){
		this.listActivities( function( err, activities ){
			if ( err ){
				return callback( err );
			}
			
			var activity = _.find( activities, function( activity ){
				return activity.name === activityName;
			})
			
			return callback( null, activity );			
		});
	}
	
	/**
	 * deleteActivity
	 * @param activityId: id of the activity
	 * @callback(err)
	 */
	this.deleteActivity = function( activityId, callback ){
		request.del( makeUrl( "/" + activityId), getReqOptions(), function(err, response, body){
			return callback( getError(err, body) );
		});
	}
	
	/**
	 * createActivity: create a new activity represented by the activity object (see activity.js)
	 * @param activityDefinition: activity definition object 
	 * 		{
	 * 			name: Activity name, 
	 * 			desc: Optional short description 
	 * 			srcConnection: Source connection definition (see connection.js)
	 * 			targetConnection: Target connection definition (see connection.js)
	 * @param callback( err, activity )
	 */
	this.createActivity = function( activityDefinition, callback ){
		//Validate payload
		if ( !activityDefinition.name || !activityDefinition.srcConnection || !activityDefinition.targetConnection){
			return callback("Called createActivity with invalid definition. Missing name, srcConnection or targetConnection field");
		}
		
		//Validate connections
		var err = activityDefinition.srcConnection.validate() || activityDefinition.targetConnection.validate();
		if ( err ){
			return callback( err );
		}
		
		//Build the payload
		var payload = {
			activityPatternId : "DataLoad",
			name : activityDefinition.name,
			expirationDelay: 'never',
			shortDescription : activityDefinition.desc || "",
			inputDocument : {
				name : activityDefinition.name,
				sourceOptions : activityDefinition.srcConnection.getOptions(),
				targetOptions : activityDefinition.targetConnection.getOptions(),

				target : {
					connection : activityDefinition.targetConnection.getConnectionDetails(),
					tables : activityDefinition.targetConnection.getTablesDetails()
				},
				sources : 	[{
					connection : activityDefinition.srcConnection.getConnectionDetails(),
					tables : activityDefinition.srcConnection.getTablesDetails()
				}]
			}
		};
		
		//Make the request
		request.post( makeUrl(), _.assign( getReqOptions(), {json: payload} ), function( err, response, body ){
			return callback( getError(err, body, true), body );
		});
	}
	
	/**
	 * runActivity: run the activity given by the id
	 * @param activityId
	 * @param callback(err, activityRunDoc)
	 */
	this.runActivity = function( activityId, callback ){
		request.post( makeUrl("/" + activityId + "/activityRuns"), _.assign( getReqOptions(), {json: true} ), function( err, response, body ){
			var err = getError(err, body);
			if ( err ){
				return callback( err );
			}
			
			//Return the outputDocument for the body
			var run = body.outputDocument.common;
			run.activityId = activityId;
			run.id = body.id;
			return callback( null, run);
		});
	}
	
	/**
	 * listActivityRuns: list all runs for a particular activity
	 * @param activityId
	 * @param callback(err, activityRuns)
	 */
	this.listActivityRuns = function( activityId, callback ){
		request.get( makeUrl( "/" + activityId + "/activityRuns"), getReqOptions(), function(err, response, body){
			return callback( getError(err, body), body );
		});
	}
	
	/**
	 * deleteActivityRun : delete a run by id
	 * @param activityId
	 * @param activityRunId
	 * @param callback(err)
	 */
	this.deleteActivityRun = function( activityId, activityRunId, callback ){
		request.del( makeUrl( "/" + activityId + "/activityRuns/" + activityRunId), getReqOptions(), function(err, response, body){
			var err = getError(err, body);
			if ( err ){
				return callback( err );
			}
			return callback();
		});
	}
	
	/**
	 * monitorActivityRun: return the status of the activity run
	 * @param activityId
	 * @param activityRunId
	 * @param callback(err, activityRunDoc)
	 */
	this.monitorActivityRun = function( activityId, activityRunId, callback ){
		request.get( makeUrl( "/" + activityId + "/activityRuns/" + activityRunId), getReqOptions(), function(err, response, body){
			var err = getError(err, body);
			if ( err || !body || !body.outputDocument || !body.outputDocument.common ){
				return callback( err || "Unexpected response from DataWorks server" );
			}
			
			//Return the outputDocument for the body
			var run = body.outputDocument.common;
			run.activityId = activityId;
			run.id = body.id;
			return callback( null, run);
		});
	}
	
	/**
	 * Convenience method to determine if a run is finished
	 */
	this.isFinished = function( status ){
		return status.toLowerCase().indexOf("finished") >= 0;
	}
	
	this.isRunning = function( status ){
		return status.toLowerCase().indexOf("running") >= 0;
	}
}

module.exports = dataworks;