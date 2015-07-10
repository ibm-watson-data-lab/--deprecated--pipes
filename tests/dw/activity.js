'use strict';

/**
 * CDS Labs module
 * 
 *   Test for the dataWorks APIs
 * 
 * @author David Taieb
 */

var dataworks = require("../../server/dw/dataworks");
var util = require("util");
var express = require('express');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var global = require('../../server/global');
var async = require('async');
var _ = require("lodash");

var app = global.app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(errorHandler({ dumpExceptions:true, showStack:true }));

global.appHost = "http://127.0.0.1";
global.appPort = process.env.VCAP_APP_PORT || process.env.DEV_PORT || 8083;

var listActivities = function(callback){
	console.log("Running listActivities");
	var dwInstance = new dataworks();

	dwInstance.listActivities( function( err, activities ){
		if ( err ){
			console.log( "Unable to get list of activities: " + err );
			return callback( err );
		}
		//console.log( "activities: " + util.inspect( activities ) );
		callback( null, dwInstance, activities )
	});
}

var deleteSFActivities = function( dwInstance, activities, callback ){
	console.log( "Delete SF activity");
	async.each( activities, function(activity, callback){
		if ( _.startsWith( activity.name, "sf" ) ){
			console.log("deleting activity %s", activity.name );
			dwInstance.deleteActivity( activity.id, function( err ){
				return callback( err );
			});
		}else{
			return callback();
		}
	}, function( err ){
		callback( err, dwInstance, activities );
	});
}

var getActivity = function( dwInstance, activities, callback ){
	console.log( "Running getActivity" );
	
	async.each( activities, function( activity, callback ){
		//console.log( util.inspect( activity, { showHidden: true, depth: null } ) );
		
		dwInstance.getActivity( activity.id, function( err, activity ){
			if ( err ){
				return callback( err );
			}
			console.log( "Fetched activity: " + util.inspect( activity, { showHidden: true, depth: null } ) );
			callback( null );
		})
	}, function( err ){
		callback( err, dwInstance );
	});
}

var createActivity = function( dwInstance, callback ){
	console.log("Running createActivity");
	dwInstance.createActivity({
		name: "david"
	}, function( err, activity ){
		if ( err ){
			return callback( err );
		}
		console.log("SuccessFully created a new activity: " + util.inspect( activity, { showHidden: true, depth: null } ) );
		return callback(null);
	});
}

var tasks = [ listActivities, deleteSFActivities, getActivity, createActivity ];

var server = require('http').createServer(app);
server.listen(global.appPort, function() {
	console.log("Server started on port %s : %s", global.appPort, Date(Date.now()));
	
	async.waterfall( tasks, function( err, results ){
		if ( err ){
			console.log( err );
		}else{
			console.log( "Test Tasks completed successfully");
		}
		server.close();
	});
	
});
