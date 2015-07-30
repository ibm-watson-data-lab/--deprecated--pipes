'use strict';

/**
*	SalesForce connection step implementation
*	@Author: David Taieb
*/

var pipeRunStep = require('../../run/pipeRunStep');
var jsforce = require("jsforce");
var pipeDb = require("../../pipeStorage");
var async = require("async");
var sf = require('./sf');

/**
 * sfConnectStep class
 * Abstract Base class for all run steps
 */
function sfConnectStep(){
	pipeRunStep.call(this);

	this.label = "Connecting to SalesForce";

	//public APIs
	this.run = function( callback ){
		this.setStepMessage("Connecting to Salesforce...");
		var logger = this.pipeRunStats.logger;
		var pipe = this.getPipe();
		var pipeRunner = this.getPipeRunner();
		var sfConnection = pipeRunner.sf;
		if ( !sfConnection ){
			sfConnection = new sf( pipe._id );
			pipeRunner.sf = sfConnection;
		}		
		
		//Create jsForce connection
		var conn = new jsforce.Connection({
			oauth2 : sfConnection.getOAuthConfig( pipe ),
			instanceUrl : pipe.sf.instanceUrl,
			accessToken : pipe.sf.accessToken,
			refreshToken : pipe.sf.refreshToken || null,
			logLevel2: "DEBUG"
		});

		conn.on("refresh", function(accessToken, res) {
			logger.info("Got a refreshed token: " + accessToken );
			//Refresh the token for next time
			pipe.sf.accessToken = accessToken;
			//Save the pipe
			pipeDb.savePipe( pipe, function( err, storedPipe ){
				if ( err ){
					return logger.error( "Error saving the refreshed token: " + err );
				}
				pipe = storedPipe;
			})
		});

		//Compute the total number of records so we can compute progression
		var tables = this.getPipeRunner().getSourceTables();
		this.pipeRunStats.expectedTotalRecords = 0;

		var processed = 0;
		//Main dispatcher code
		async.each( tables, function( table, callback ){
			var sfQuery = conn.query("SELECT COUNT() FROM "+ table.name);
			sfQuery.setMaxListeners(0);
			sfQuery.on("end", function(query) {
				this.pipeRunStats.expectedTotalRecords += query.totalSize;
				this.setStepMessage("Connection to Salesforce Successful. " + this.pipeRunStats.expectedTotalRecords +" records have been found");
				this.setPercentCompletion( (++processed/table.length).toFixed(1) );
				return callback();
			}.bind(this))
			.on("error", function(err) {
				//skip
				logger.error("Error getting count for table %s", table.name);
				this.setPercentCompletion( (++processed/table.length).toFixed(1) );
				return callback(null);
			}.bind(this))
			.run();
		}.bind(this), function( err ){
			if ( err ){
				this.setStepMessage("Connection to Salesforce unsuccessful: %s", err);
				return callback( err );
			}
			//Keep a reference of the connection for the next steps
			this.pipeRunStats.sfConnection = conn;
			this.setStepMessage("Connection to Salesforce Successful. " + this.pipeRunStats.expectedTotalRecords +" records have been found");
			return callback();
		}.bind(this));
	}
}

module.exports = sfConnectStep;