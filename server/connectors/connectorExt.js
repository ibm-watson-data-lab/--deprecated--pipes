//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

/**
 * CDS Labs module
 * 
 *   Base Extended Connector object that provides default implementation for the following steps:
 *    -Connect to data source
 *    -Batch the record for bulk update in Cloudant
 *    -Create DataWorks activities
 *    -Monitor DataWorks activities
 *   
 *   Note: Connector implementation have the choice to inherit from connector.js or connectorExt.js
 * 
 * @author David Taieb
 */

var connector = require("./connector");
var pipeRunStep = require('../run/pipeRunStep');
var _ = require('lodash');
var async = require('async');
var cloudant = require('../storage');
var recordTransformer = require("../transform/recordTransformer");
var pipeDb = require("../pipeStorage");

function connectorExt(id, label, options){
	options = options || {};
	if ( !options.hasOwnProperty("copyToDashDb") ){
		options.copyToDashDb = true;
	}
	
	//Call constructor from super class
	connector.call(this);
	
	if ( id ){
		this.setId( id );
	}
	
	if ( label ){
		this.setLabel( label );
	}
	
	/*********************************************************************
	*Abstract APIs, must be implemented by subclasses
	**********************************************************************/
	
	/**
	* doConnectep method: overridable method implemented by connector implementations to validate connection
	* @param done: callback that must be called when the connection is establish
	* @param pipeRunStep
	* @param pipeRunStats
	* @param logger
	* @param pipe
	* @param pipeRunner
	*/
	this.doConnectStep = function( done, pipeRunStep, pipeRunStats, logger, pipe, pipeRunner ){
		console.log("Calling the default implementation of doConnectStep");
		
		//Default does nothing
		return done();
	}

	/**
	* getTablePrefix method: return a prefix to be added to the tables on dashDB
	*/
	this.getTablePrefix = function(){
		//Default implementation is no prefix
		return null;
	}
	
	/**
	* fetchRecords method: overridable method implemented by connector implementations to validate connection
	* @param table: json object that contains information about the table
	* @param pushRecordFn: function used by connector implementation to push records through the pipeline
	* 		pushRecordFn(records)
	* @param done: callback that must be called when the implementation is done fetching records
	* @param pipeRunStep
	* @param pipeRunStats
	* @param logger
	* @param pipe
	* @param pipeRunner
	*/
	this.fetchRecords = function( table, pushRecordFn, done, pipeRunStep, pipeRunStats, logger, pipe, pipeRunner ){
		throw new Error("fetchRecords method must be implemented by subclass");
	}
	/*********************************************************************
	*End of Abstract APIs
	**********************************************************************/
	
	/*********************************************************************
	*Default implementation of oAuth protocol
	**********************************************************************/
	/**
	 * authCallback: callback for OAuth authentication protocol
	 * @param oAuthCode
	 * @param pipeId
	 * @param callback(err, pipe )
	 */
	this.authCallback = function( oAuthCode, pipeId, callback ){
		return callback();
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
		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			pipeDb.upsert( pipeId, function( storedPipe ){
				//tables is required
				storedPipe.tables = [{name : 'demotable', labelPlural : 'demotable'}];
				return storedPipe;
			}, function( err ){
				res.redirect( url );
				return callback( err, pipe );
			});
		});
	};
	/*********************************************************************
	*End of default implementation of oAuth protocol
	**********************************************************************/
	
	/*********************************************************************
	*Implementation of the connect and copytoCloudant steps
	**********************************************************************/
	var thisConnector = this;
	
	var connectStep = function(){
		//connect step
		pipeRunStep.call(this);

		this.label = "Connecting to " + thisConnector.getLabel();

		//public APIs
		this.run = function( callback ){
			this.setStepMessage(this.label + "...");
			var logger = this.pipeRunStats.logger;
			var pipe = this.getPipe();
			var pipeRunner = this.getPipeRunner();
			
			//Call the doConnectStep method
			return thisConnector.doConnectStep( callback, this, this.pipeRunStats, logger, pipe, pipeRunner );
		};
	};
	
	//Extend the class
	require('util').inherits(connectStep, pipeRunStep);
	
	var copyRecordsToCloudantStep = function(){
		//copy to cloudant step
		pipeRunStep.call(this);
		
		this.label = "Moving data from " + thisConnector.getLabel() + " to Cloudant";
		
		this.run = function( callback ){			
			var logger = this.pipeRunStats.logger;
			var stepStats = this.stats;
			stepStats.numRecords = 0;

			//Get the tables to process
			var tables = this.getPipeRunner().getSourceTables();

			//record stats for each table
			this.pipeRunStats.tableStats = {};
			
			var getProcessTableFunctions = function( logger, table ){
				var processTableFunctions = [];
				var targetDb = null;
				processTableFunctions.push( function( callback ){
					createCloudantDbForTable(logger, table, function( err, result){
						if ( err ){
							return callback(err);
						}
						//result is targetDb
						targetDb = result;
						return callback(null);	//Make sure to return no results!
					});
				});
				processTableFunctions.push( function( callback ){
					processTable( logger, table, targetDb, function( err, stats ){
						if ( err ){
							return callback( err );
						}
						//Process for this table was successful, roll up the stats
						return callback( null, stats );
					});
				});
				return processTableFunctions;
			};
			
				//Private APIs
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
				var tables = table || this.getPipeRunner().getSourceTables();
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
			
			var createCloudantDbForTable = function( logger, table, callback ){
				//One database per table, create it now
				var tablePrefix = thisConnector.getTablePrefix() ? (thisConnector.getTablePrefix() + "_") : "";
				var dbName =  tablePrefix + table.name.toLowerCase();
				var targetDb = new cloudant.db(dbName, genViewsManager( table ));
				var ready = null;
				targetDb.on( "cloudant_ready", ready = function(){
					logger.info("Data Pipe Configuration database (" + dbName + ") ready");
					logger.info("Delete all documents for table %s in database %s", table.name, dbName);
					//Remove listener to avoid using the callback again in case we have downstream errors
					targetDb.removeListener("cloudant_ready", ready );
					var called = false;
					targetDb.destroyAndRecreate( function( err ){
						if ( called ){
							return;
						}
						called = true;
						if ( err ){
							logger.error("Unable to recreate db : " + err );
							return callback(err);
						}
						return callback( null, targetDb);
					});
				});

				targetDb.on("cloudant_error", function(){
					var message = "Fatal error from Cloudant database: unable to initialize " + dbName;
					logger.error( message )
					return callback( message );
				});
			};
			
			//convenience method
			var totalCopied = 0;
			var formatCopyStepMessage = function( added ){
				totalCopied += added;
				var percent = totalCopied == 0 ? 0 : ((totalCopied/this.pipeRunStats.expectedTotalRecords)*100).toFixed(1);
				this.setPercentCompletion( percent );
				var message = totalCopied + " documents copied to Cloudant out of " + this.pipeRunStats.expectedTotalRecords + " (" + percent + "%)";
				this.setStepMessage( message );
			}.bind(this);

			/**
			 * @param: table: json object representing the source table
			 * @param targetDb: the target db to write data to
			 * @callback: function( err, stats )
			 */
			var processTable = function( logger, table, targetDb, callback ){
				var stats = {
						tableName : table.name,
						numRecords: 0,
						dbName : targetDb.getDbName(),
						errors: []
				};

				var pipeRunStats = this.pipeRunStats;
				pipeRunStats.addTableStats( stats );

				//Batch the docs to minimize number of requests
				var batch = { batchDocs: [] };
				var maxBatchSize = 200;

				var transformer = new recordTransformer( table );

				var processBatch = function( force, callback ){
					if ( batch.batchDocs.length > 0 && (force || batch.batchDocs.length >= maxBatchSize) ){
						var thisBatch = { batchDocs:batch.batchDocs};
						//Release the array for the next batch
						batch.batchDocs = [];

						//Insert into the database
						targetDb.run( function( err, db ){
							if ( err ){
								return callback && callback(err);
							}
							//Update docs in bulks
							var added = thisBatch.batchDocs.length;
							db.bulk( {"docs": thisBatch.batchDocs}, function( err, data ){
								if ( err ){
									stats.errors.push( err );
								}
								formatCopyStepMessage( added );
								delete thisBatch.batchDocs;
								return callback && callback();
							});
						});
					}else if ( callback ){
						return callback();
					}
				}
				
				//Delegate the fetching of records to the subclass
				thisConnector.fetchRecords( table, function(records){
					if ( !_.isArray(records) ){
						records = [records];
					}
					_.forEach( records, function( record ){
						stats.numRecords++;
						//Add the type to the record
						record.pt_type = table.name;

						//Process record transformation
						//transformer.process( record );

						batch.batchDocs.push( record );
					})
					processBatch( false );
				}, function( err ){
					if ( err ){
						logger.error( err );
						stats.errors.push( err );
						pipeRunStats.addTableStats( stats );
						return callback( null, stats );	//Do not stop other tables to go through
					}
					processBatch( true, function( err ){
						pipeRunStats.addTableStats( stats );
						//Complete the processtable method
						return callback(null, stats);
					});
				},
				this, pipeRunStats, logger, this.getPipe(), this.getPipeRunner() );
			}.bind(this);

			//Main dispatcher code
			async.map( tables, function( table, callback ){
				logger.info("Starting processing table : " + table.name );
				async.series( getProcessTableFunctions(logger, table), function( err, results){
					var stats =  _.find( results, function( result ){
						return result != null
					});
					logger.info({
						message: "Finished processing table " + table.name,
						stats: stats
					});
					stepStats.numRecords += stats.numRecords;
					return callback(err, stats );
				});
			}, function( err, statsArray ){
				var hasErrors = false;

				if ( _.isArray( statsArray ) ){
					_.forEach( statsArray, function(stats){
						if ( stats ){
							if ( stats.errors.length > 0 ){
								hasErrors = true;
							}
						}
					});
				}


				if ( err ){
					stepStats.status = "Unsuccessful: " + err;
				}else if( hasErrors ){
					stepStats.status = "Succesfully completed with errors";
				}else{
					stepStats.status = "Successfully completed";
				}
				var message = require("util").format( "Successfully copied %d documents from %s to Cloudant", totalCopied, thisConnector.label);
				logger.info( message );
				this.setStepMessage( message );
				return callback( err );
			}.bind(this));
		}
	};
	
	//Extend the class
	require('util').inherits(copyRecordsToCloudantStep, pipeRunStep);
	
	/*********************************************************************
	*End of Implementation of connect and copy to cloudant steps
	**********************************************************************/
	
	//Set the steps
	var steps = [ new connectStep(), new copyRecordsToCloudantStep()];
	if ( options.copyToDashDb ){
		steps.push( new (require("../run/cloudantToDashActivitiesStep"))() );
		steps.push( new (require("../run/activitiesMonitoringStep"))() );
	}
	this.setSteps( steps );
};

//Extend event Emitter
require('util').inherits(connectorExt, connector);

//Export the class
module.exports = connectorExt;