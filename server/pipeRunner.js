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
var pipeDb = require("./pipeStorage");

function pipeRunner( sf, pipe ){
	this.pipe = pipe;
	this.sf = sf;
	
	//Private APIs
	var validate = function(){
		if ( !this.pipe.tables ){
			return "Cannot run because pipe is not connected";
		}
	}.bind( this );
	
	/**
	 * Return the design doc associated with table
	 */
	var getDesignDocForTable = function( table ){
		return '_design/' + table.name;
	};
	
	/**
	 * Return the view name associated with a table
	 */
	var getViewNameForTable = function( table ){
		return table.labelPlural || table.label || table.name;
	};
	
	var genViewsManager = function(table){
		var tables = table || getSourceTables();
		if ( !_.isArray( tables ) ){
			tables = [tables];
		}
		var viewsManager = [];
		_.forEach( tables, function( table ){
			var manager = new cloudant.views( getDesignDocForTable(table) );
			manager.addView(
				getViewNameForTable(table),
				JSON.parse("{"+
					"\"map\": \"function(doc){" +
						"if ( doc.pt_type === '" + table.name + "'){" +
							"emit( doc._id, {'_id': doc._id, 'rev': doc._rev } );" +
						"}" +
					"}\"" +
				"}"
				), 2 //Version
			);
			viewsManager.push( manager );
		})
		return viewsManager;
		
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
	
	/**
	 * doRun: internal api to execute a run
	 * @param callback
	 */
	var doRun = function(callback){
		//Create jsForce connection
		var conn = new jsforce.Connection({
			oauth2 : this.sf.getOAuthConfig( pipe ),
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
			pipeDb.savePipe( pipe, function( err, data ){
				if ( err ){
					console.log( "Error saving the refreshed token: " + err );
				}
			})
		});
		
		var pipeRunInstance = new pipeRun( this.pipe, conn );
		
		//Main listener of the run instance
		var pipeRunListener = new function(){
			this.onNewBatch = function( targetDb, batchDocs,stats, callback ){
				targetDb.run( function( err, db ){
					if ( err ){
						return callback(err);
					}
					//Update docs in bulks
					db.bulk( {"docs": batchDocs}, function( err, data ){
						if ( err ){
							return callback(err);
						}
						return callback( null, data );
					});
				});
			},
			this.beforeProcessTable = function( table, callback ){
				//One database per table, create it now
				var dbName =  "sf_" + table.name.toLowerCase();
				var targetDb = new cloudant.db(dbName, genViewsManager( table ));
				targetDb.on( "cloudant_ready", function(){
					console.log("Data Pipe Configuration database (" + dbName + ") ready");
					console.log("Delete all documents for table %s in database %s", table.name, dbName);
					targetDb.destroyAndRecreate( function( err ){
						if ( err ){
							return callback(err);
						}
						return callback( null, targetDb);
					});
					
					//Since we are now putting all docs from a SF table in its own database, we don't need to do a selective delete, instead
					//do a wholesale destroy of the db
//					targetDb.deleteDocsFromView( table.name, getViewNameForTable(table), function( err, results){
//						if ( err ){
//							return callback(err);
//						}
//						return callback( null, targetDb);
//					})
				});

				targetDb.on("cloudant_error", function(){
					return callback("Fatal error from Cloudant database: unable to initialize " + dbName);
				});
			}
		};
		
		//Process the tables
		pipeRunInstance.processSourceTables( getSourceTables(), pipeRunListener );
		return callback( null, pipeRunInstance );
	}.bind(this);	
	
	//Public APIs
	this.newRun = function( callback ){
		var err = validate();
		if ( err ){
			return callback( err );
		}
		
		doRun( callback );
	};
}

//Export the module
module.exports = pipeRunner;