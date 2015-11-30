'use strict';

/**
 * CDS Labs module
 * 
 *   Connector implementation for Salesforce
 * 
 * @author David Taieb
 */

var pipesSDK = require('pipes-sdk');
var connectorExt = pipesSDK.connectorExt;
var pipesDb = pipesSDK.pipesDb;
var jsforce = require("jsforce");
var sf = require("./sf");
var async = require('async');
var _ = require('lodash');

/**
 * SalesForce connector
 */
function sfConnector( parentDirPath ){
	//Call constructor from super class
	connectorExt.call(this, "SalesForce", "SalesForce");
	
	this.doConnectStep = function( done, pipeRunStep, pipeRunStats, logger, pipe, pipeRunner ){
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
			pipesDb.savePipe( pipe, function( err, storedPipe ){
				if ( err ){
					return logger.error( "Error saving the refreshed token: " + err );
				}
				pipe = storedPipe;
			})
		});

		//Compute the total number of records so we can compute progression
		var tables = pipeRunner.getSourceTables();
		pipeRunStats.expectedTotalRecords = 0;

		var processed = 0;
		//Main dispatcher code
		async.each( tables, function( table, callback ){
			var sfQuery = conn.query("SELECT COUNT() FROM "+ table.name);
			sfQuery.setMaxListeners(0);
			sfQuery.on("end", function(query) {
				pipeRunStats.expectedTotalRecords += query.totalSize;
				table.expectedNumRecords = query.totalSize;
				pipeRunStep.setStepMessage("Connection to Salesforce Successful. " + pipeRunStats.expectedTotalRecords +" records have been found");
				pipeRunStep.setPercentCompletion( (++processed/table.length).toFixed(1) );
				return callback();
			})
			.on("error", function(err) {
				//skip
				logger.error("Error getting count for table %s", table.name);
				pipeRunStep.setPercentCompletion( (++processed/table.length).toFixed(1) );
				return callback(null);
			})
			.run();
		}, function( err ){
			if ( err ){
				pipeRunStep.setStepMessage("Connection to Salesforce unsuccessful: %s", err);
				return done( err );
			}
			//Keep a reference of the connection for the next steps
			pipeRunStats.sfConnection = conn;
			pipeRunStep.setStepMessage("Connection to Salesforce Successful. " + pipeRunStats.expectedTotalRecords +" records have been found");
			return done();
		});
	}
	
	this.getTablePrefix = function(){
		return "sf";
	}
	
	this.fetchRecords = function( table, pushRecordFn, done, pipeRunStep, pipeRunStats, logger, pipe, pipeRunner ){
		var selectStmt = "SELECT ";
		var first = true;
		table.fields.forEach( function( field ){
			selectStmt += (first ? "": ",") + field.name;
			first = false;
		});
		selectStmt += " FROM " + table.name;
		logger.trace( selectStmt );

		var conn = pipeRunStats.sfConnection;
		conn.query(selectStmt)
		.on("record", function(record) {
			pushRecordFn( record );
		})
		.on("end", function(query) {
			logger.trace("total in database : " + query.totalSize);
			logger.trace("total fetched : " + query.totalFetched);

			return done();
		})
		.on("fetch", function(){
			//Call garbage collector between fetches
			global.gc();
		})
		.on("error", function(err) {
			logger.error("Error while processing table " + table.name + ". Error is " + err );
			return done(err);
		})
		.run({ autoFetch : true, maxFetch : (table.expectedNumRecords || 200000) });
	}
	
	/**
	 * authCallback: callback for OAuth authentication protocol
	 * @param oAuthCode
	 * @param pipeId
	 * @param callback(err, pipe )
	 */
	this.authCallback = function( oAuthCode, pipeId, callback ){
		var sfObject = new sf( pipeId );
		
		sfObject.authorize(oAuthCode, function(err, userInfo, jsForceConnection, pipe ){
			if (err) { 
				return callback( err );
			}
			//Get the tables
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
					return callback(err);
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
				
				return callback( null, pipe );				
			});
		});
	};
	
	/**
	 * connectDataSource: connect to the backend data source
	 * @param req
	 * @param res
	 * @param pipeId
	 * @param url: login url
	 * @param callback(err, results)
	 */
	this.connectDataSource = function( req, res, pipeId, url, callback ){
		var sfConnection = new sf( pipeId );
		sfConnection.connect( req, res, url, function (err, results ){
			if ( err ){
				return callback(err);
			}
			return callback(null, results);
		});
	}
}

//Extend event Emitter
require('util').inherits(sfConnector, connectorExt);

module.exports = new sfConnector();