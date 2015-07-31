'use strict';

/**
 * CDS Labs module
 * 
 *   Connector implementation for Salesforce
 * 
 * @author David Taieb
 */

var connector = require("../connector");
var sf = require("./sf");
var async = require('async');
var _ = require('lodash');

/**
 * SalesForce connector
 */
function sfConnector( parentDirPath ){
	//Call constructor from super class
	connector.call(this);
	
	//Set the id
	this.setId("SalesForce");
	this.setLabel("SalesForce");
	
	//Set the steps
	this.setSteps([
		new (require("./sfConnectStep"))(),
		new (require("./sfToCloudantStep"))(),
		new (require("../../run/cloudantToDashActivitiesStep"))(),
		new (require("../../run/activitiesMonitoringStep"))()
    ]);
	
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
require('util').inherits(sfConnector, connector);

module.exports = new sfConnector();