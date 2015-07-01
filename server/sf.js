'use strict';

/**
*	Object Oriented APIs to salesforce
*	@Author: David Taieb
*/

var jsforce = require('jsforce');
var _ = require('lodash');
var async = require('async');
var pipeDb = require('./connectionStorage');
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

function sf( connId ){
	this.connId = connId;	//Remember our connection id which should never change
	
	//Private APIs
	var getConnection = function( callback ){
		pipeDb.getConnection( this.connId, function( err, connection ){
			if ( err ){
				return callback( err );
			}
			
			callback( null, connection );			
		}.bind(this));
	}.bind(this);
	
	var getOAuthConfig = function( connection ){
		return new jsforce.OAuth2({
			 loginUrl: connection.loginUrl || "https://login.salesforce.com",
			 clientId: connection.clientId,
		     clientSecret: connection.clientSecret,
		     redirectUri: "https://127.0.0.1:8082/authCallback"
		});
	}
	
	//Public APIs
	this.connect = function( req, res, callback ){
		getConnection( function( err, connection ){
			if ( err ){
				return callback( err );
			}
			console.log( "Trying to connect using : " + JSON.stringify( connection ) );
			//Redirect authorization
			res.redirect( getOAuthConfig( connection ).getAuthorizationUrl({ scope : 'api id web', state: connection._id }));
			
		});
	};
	
	this.authorize = function( code, callback ){
		getConnection( function( err, toolConnection ){
			if ( err ){
				return callback( err );
			}
			console.log("Authorizing connection using : " + JSON.stringify( toolConnection ));
			var conn = new jsforce.Connection({ oauth2 : getOAuthConfig( toolConnection ) });
			if ( !conn || !code ){
				return callback( "Unable to get SalesForce Connection" );
			}
			
			conn.authorize(code, function(err, userInfo){
				return callback( err, userInfo, conn, toolConnection );
			});			
		});		
	}

}

//Export the module
module.exports = sf;