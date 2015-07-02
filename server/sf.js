'use strict';

/**
*	Object Oriented APIs to salesforce
*	@Author: David Taieb
*/

var jsforce = require('jsforce');
var _ = require('lodash');
var async = require('async');
var pipeDb = require('./pipeStorage');
var pipeRunner = require("./pipeRunner");
var misc = require("./misc");

//Test data
var testConfig = new function(){
	this.oAuthConfigDevSF = new jsforce.OAuth2({
			 loginUrl: "https://login.salesforce.com",
			 clientId: "3MVG98SW_UPr.JFgLYoFuZUV8udi_s_hhQnh76fvudHrj40npYfGHLQYuHJ8iQV2VN6cAoxzXa3WLSEfzDdGk",
		     clientSecret: "1389549770213154921",
		     redirectUri: "https://127.0.0.1:8082/authCallback"
		});

	this.oAuthConfigCDSSandbox = new jsforce.OAuth2({
			 loginUrl: "https://test.salesforce.com",
			 clientId: "3MVG9_7ddP9KqTzdj6CqVC0uI_RpkkogtVDUV1GgYAxxIWTY.naY.FtEYMwCtwOuivHaIp0uRRDaMMeWbv574",
		     clientSecret: "5717758873660437002",
		     redirectUri: "https://127.0.0.1:8082/authCallback"
		});

	this.configCDSSandbox = {
		logLevel: "DEBUG",
		loginUrl: "https://test.salesforce.com/",
		instanceUrl: "https://cs10.salesforce.com",
		oauth2: this.oAuthConfigCDSSandbox
	}
};

function sf( pipeId ){
	this.pipeId = pipeId;	//Remember our pipe id which should never change
	
	//Private APIs
	var getPipe = function( callback, noFilterForOutbound ){
		pipeDb.getPipe( this.pipeId, function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			
			callback( null, pipe );			
		}.bind(this), noFilterForOutbound || false);
	}.bind(this);
	
	//Public APIs
	this.getOAuthConfig = function( pipe ){
		return new jsforce.OAuth2({
			 loginUrl: pipe.loginUrl || "https://login.salesforce.com",
			 clientId: pipe.clientId,
		     clientSecret: pipe.clientSecret,
		     redirectUri: "https://127.0.0.1:8082/authCallback"
		});
	};
	
	this.connect = function( req, res, callback ){
		getPipe( function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			console.log( "Trying to connect using : " + JSON.stringify( pipe ) );
			//Redirect authorization
			res.redirect( this.getOAuthConfig( pipe ).getAuthorizationUrl({ scope : 'api id web', state: pipe._id }));
			
		}.bind( this ));
	};
	
	this.authorize = function( code, callback ){
		getPipe( function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			console.log("Authorizing pipe using : " + JSON.stringify( pipe ));
			var conn = new jsforce.Connection({ oauth2 : this.getOAuthConfig( pipe ) });
			if ( !conn || !code ){
				return callback( "Unable to get SalesForce Connection" );
			}
			
			conn.authorize(code, function(err, userInfo){
				return callback( err, userInfo, conn, pipe );
			});			
		}.bind( this ));		
	};
	
	this.run = function( callback ){
		getPipe( function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			console.log( "Running pipe using : " + JSON.stringify( pipe ) );
			if ( pipe.run ){
				//Can't create a new run while a run is in progress
				return callback( "Error: a run is already in progress " );
			}
			
			var pipeRunnerInstance = new pipeRunner( this, pipe );			
			pipeRunnerInstance.newRun( function( err, pipeRun ){
				if ( err ){
					//Couldn't start the run
					return callback( err );
				}
				return callback( null, pipeRun );
			});
		}.bind( this ), true);
	};

}

//Export the module
module.exports = sf;