'use strict';

/**
*	SalesForce connection step implementation
*	@Author: David Taieb
*/

var pipeRunStep = require('./pipeRunStep');
var jsforce = require("jsforce");
var pipeDb = require("../pipeStorage");
var async = require("async");

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
		var sf = this.getPipeRunner().sf;
		var pipe = this.getPipe();
		//Create jsForce connection
		var conn = new jsforce.Connection({
			oauth2 : sf.getOAuthConfig( pipe ),
			instanceUrl : pipe.sf.instanceUrl,
			accessToken : pipe.sf.accessToken,
			refreshToken : pipe.sf.refreshToken || null,
			logLevel2: "DEBUG"
		});

		conn.on("refresh", function(accessToken, res) {
			console.log("Got a refreshed token: " + accessToken );
			//Refresh the token for next time
			pipe.sf.accessToken = accessToken;
			//Save the pipe
			pipeDb.savePipe( pipe, function( err, storedPipe ){
				if ( err ){
					return console.log( "Error saving the refreshed token: " + err );
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
			conn.query("SELECT COUNT() FROM "+ table.name)
			.on("end", function(query) {
				this.pipeRunStats.expectedTotalRecords += query.totalSize;
				this.setStepMessage("Connection to Salesforce Successful. " + this.pipeRunStats.expectedTotalRecords +" records have been found");
				this.setPercentCompletion( (++processed/table.length).toFixed(1) );
				return callback();
			}.bind(this))
			.on("error", function(err) {
				//skip
				console.log("Error getting count for table %s", table.name);
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