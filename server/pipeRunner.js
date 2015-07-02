'use strict';

/**
*	Pipe Runner implementation
*	@Author: David Taieb
*/

var cloudant = require('./storage');
var _ = require("lodash");
var async = require("async");
var pipeRun = require("./pipeRun");
var jsforce = require("jsforce");

function pipeRunner( sf, pipe ){
	this.pipe = pipe;
	this.sf = sf;
	
	//Private APIs
	var validate = function(){
		if ( !this.pipe.tables ){
			return "Cannot run because pipe is not connected";
		}
	}.bind( this );
	
	var genViewsManager = function(){
		return new cloudant.views('_design/application');
	}.bind( this );
	
	/**
	 * getSourceTables
	 * @returns: array of source tables to be processed by the pipe 
	 */
	var getSourceTables = function(){
		if ( !this.pipe.tables ){
			//Pipe is not connected, should never happen
			return [];
		}
		if ( this.pipe.selectedTableId ){
			var retTable = _.find( this.pipe.tables, function( table ){
				return table.name == this.pipe.selectedTableId;
			}.bind(this));
			return [retTable];
		}
		//Return all tables
		return pipe.tables;
	}.bind( this );
	
	
	//Public APIs
	this.newRun = function( callback ){
		var err = validate();
		if ( err ){
			return callback( err );
		}
		
		//Create a Cloudant connection
		var dbName =  (process.env.CLOUDANT_DB_NAME || "pipe_db_") + pipe._id;
		var targetDb = new cloudant.db(dbName, genViewsManager());
		
		//Create jsForce connection
		var conn = new jsforce.Connection({
			oauth2 : this.sf.getOAuthConfig( this.pipe ),
			instanceUrl : pipe.sf.instanceUrl,
			accessToken : pipe.sf.accessToken,
			refreshToken : pipe.sf.refreshToken || null
		});
		
		var pipeRunInstance = new pipeRun( this.pipe, conn );
		
		//Main listener of the run instance
		var pipeRunListener = new function(){
			this.onNewRecord = function( record, stats, callback ){
				targetDb.run( function( err, db ){
					if ( err ){
						return callback(err);
					}
					db.insert( record, function( err, data ){
						if ( err ){
							return callback(err);
						}
						return callback( null, data );
					});
				});
			}
		};
		
		//Process the tables
		pipeRunInstance.processSourceTables( getSourceTables(), pipeRunListener );
		return callback( null, pipeRunInstance );
	};
}

//Export the module
module.exports = pipeRunner;