'use strict';

/**
*	Endpoints for managing access to salesforce APIs
*	@Author: David Taieb
*/

var sf = require('./sf');
var _ = require('lodash');
var async = require('async');
var pipeDb = require('./connectionStorage');
var misc = require("./misc");

module.exports = function( app ){	
	app.get("/authCallback", function( req, res ){
		var code = req.param('code');
		var connId = req.param('state');
		
		if ( !code || !connId ){
			return misc.jsonError( res, "No code or state specified in OAuth callback request");
		}
		
		console.log("OAuth callback called with connection id: " + connId );
		var sfObject = new sf( connId );
		
		sfObject.authorize(code, function(err, userInfo, jsForceConnection, toolConnection ){
			if (err) { 
				return misc.jsonError( res, err );
			}
			
			var tables = [];
			async.series([
				function( done ){
					jsForceConnection.describeGlobal(function(err, res) {
						if (err) { 
							return done(err); 
						}
						for ( var i=0; i < res.sobjects.length; i++){
							if ( res.sobjects[i].createable ){
								tables.push( res.sobjects[i] );
							}
						}
						return done(null);
					});
				},
				function( done ){
					async.map( tables, function( sobject, done ){
						jsForceConnection.sobject( sobject.name).describe( function( err, meta){
							if ( err ){
								return done( err );
							}
							if ( _.isArray( meta.recordTypeInfos ) && meta.recordTypeInfos.length > 0 ){
								return done( null, meta );
							}
							return done( null, null );
						});
					}, function( err, results){
						if ( err ){
							return done( err );
						}
						tables = _.remove( results, function( v ){
							return v != null;
						});
						return done(null);
					});
				}
			], function( err, results ){
				if ( err ){
					return misc.jsonError( res, err );
				}
				
				for ( var i = 0 ; i < tables.length; i++ ){
					console.log( tables[i].name + " : " + tables[i].labelPlural );
				}

				toolConnection.tables = tables;
				toolConnection.sf = {
						accessToken: jsForceConnection.accessToken,
						refreshToken: jsForceConnection.refreshToken,
						instanceUrl: jsForceConnection.instanceUrl,
						userId: userInfo.id,
						orgId: userInfo.organizationId
				};

				//Save the connection
				pipeDb.saveConnection( toolConnection, function( err, data ){
					if ( err ){
						return json.miscError( res, err );
					}

					res.send("<html><head><script>window.close()</script></head><body></body></html>");
				})
				
			});
		});
	});
	
	app.get("/sf/:id", function( req, res){
		var sfConnection = new sf( req.params.id );
		sfConnection.connect( req, res, function (err, results ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			return res.json( results );
		});
	});
}