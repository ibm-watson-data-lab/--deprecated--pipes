'use strict';

/**
*	SalesForce connection step implementation
*	@Author: David Taieb
*/

var pipeRunStep = require('./pipeRunStep');
var jsforce = require("jsforce");
var pipeDb = require("../pipeStorage");

/**
 * sfConnectStep class
 * Abstract Base class for all run steps 
 */
function sfConnectStep(){
	pipeRunStep.call(this);
	
	this.label = "Connecting to SalesForce";
	
	//public APIs
	this.run = function( callback ){
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
		
		//Verify the connection is ok
		conn.identity( function( err, userInfo){
			if ( err ){
				return callback(err);
			}
			console.log("Connection to SalesForce established for user: %s", userInfo.email );
			return callback( null, userInfo);
		});
		
		//Keep a reference of the connection for the next steps
		this.pipeRunStats.sfConnection = conn;
	}
}

module.exports = sfConnectStep;