'use strict';

/**
*	Object Oriented APIs to salesforce
*	@Author: David Taieb
*/

var jsforce = require('jsforce');
var _ = require('lodash');
var async = require('async');
var pipeDb = require('../../pipeStorage');
var global = require("../../global");

//Test data
var testConfig = new function(){
	this.oAuthConfigDevSF = new jsforce.OAuth2({
			 loginUrl: "https://login.salesforce.com",
			 clientId: "3MVG98SW_UPr.JFgLYoFuZUV8udi_s_hhQnh76fvudHrj40npYfGHLQYuHJ8iQV2VN6cAoxzXa3WLSEfzDdGk",
		     clientSecret: "1389549770213154921",
		     redirectUri: global.getHostUrl() + "/authCallback"
		});

	this.oAuthConfigCDSSandbox = new jsforce.OAuth2({
			 loginUrl: "https://test.salesforce.com",
			 clientId: "3MVG9_7ddP9KqTzdj6CqVC0uI_RpkkogtVDUV1GgYAxxIWTY.naY.FtEYMwCtwOuivHaIp0uRRDaMMeWbv574",
		     clientSecret: "5717758873660437002",
		     redirectUri: global.getHostUrl() + "/authCallback"
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
			 loginUrl: (pipe.useSandbox ? "https://test.salesforce.com" : "https://login.salesforce.com"),
			 clientId: pipe.clientId,
		     clientSecret: pipe.clientSecret,
		     redirectUri: global.getHostUrl() + "/authCallback"
		});
	};
	
	this.connect = function( req, res, url, callback ){
		getPipe( function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			console.log( "Trying to connect using : " + JSON.stringify( pipe.name ) );
			//Redirect authorization
			res.redirect( 
				this.getOAuthConfig( pipe ).getAuthorizationUrl(
					{ 
						scope : 'api id web refresh_token', 
						state: JSON.stringify( {pipe: pipe._id, url: url } ) 
					}
				)
			);			
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
}

//Export the module
module.exports = sf;