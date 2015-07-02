'use strict';

/**
*	Endpoints for managing access to salesforce APIs
*	@Author: David Taieb
*/

var sf = require('./sf');
var _ = require('lodash');
var async = require('async');
var pipeDb = require('./pipeStorage');
var misc = require("./misc");

module.exports = function( app ){	
	app.get("/authCallback", function( req, res ){
		var code = req.param('code');
		var pipeId = req.param('state');
		
		if ( !code || !pipeId ){
			return misc.jsonError( res, "No code or state specified in OAuth callback request");
		}
		
		console.log("OAuth callback called with pipe id: " + pipeId );
		var sfObject = new sf( pipeId );
		
		sfObject.authorize(code, function(err, userInfo, jsForceConnection, pipe ){
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

				pipe.tables = tables;
				pipe.sf = {
						accessToken: jsForceConnection.accessToken,
						refreshToken: jsForceConnection.refreshToken,
						instanceUrl: jsForceConnection.instanceUrl,
						userId: userInfo.id,
						orgId: userInfo.organizationId
				};

				//Save the pipe
				pipeDb.savePipe( pipe, function( err, data ){
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
	
	app.post("/sf/:id", function( req, res ){
		var sfConnection = new sf( req.params.id );
		sfConnection.run( function( err, run ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			//Return a 202 accepted code to the client with information about the run
			return res.status( 202 ).json( run.getId() );
		});
	});
}