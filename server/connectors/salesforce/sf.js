'use strict';

/**
*	Object Oriented APIs to salesforce
*	@Author: David Taieb
*/

var jsforce = require('jsforce');
var _ = require('lodash');
var async = require('async');
var pipesSDK = require('pipes-sdk');
var pipesDb = pipesSDK.pipesDb;
var global = require("bluemix-helper-config").global;

/**
 * Helper class for SalesForce connector
 */
function sf( pipeId ){
	this.pipeId = pipeId;	//Remember our pipe id which should never change
	
	//Private APIs
	var getPipe = function( callback, noFilterForOutbound ){
		pipesDb.getPipe( this.pipeId, function( err, pipe ){
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