'use strict';

/**
*	Step used to move data from SalesForce to Cloudant
*	@Author: David Taieb
*/

var pipeRunStep = require('../../run/pipeRunStep');
var cloudant = require('../../storage');
var _ = require("lodash");
var async = require("async");
var global = require("../../global");
var recordTransformer = require("../../transform/recordTransformer");

/**
 * sfToCloudantStep class
 * Copy all records in tables from SalesForces to Cloudant
 */
function sfToCloudantStep(){
	pipeRunStep.call(this);

	this.label = "Moving data from Salesforce to Cloudant";

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
		var dbName =  "sf_" + table.name.toLowerCase();
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
	}

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
	}

	//convenience method
	var totalCopied = 0;
	var formatCopyStepMessage = function( added ){
		totalCopied += added;
		var percent = totalCopied == 0 ? 0 : ((totalCopied/this.pipeRunStats.expectedTotalRecords)*100).toFixed(1);
		this.setPercentCompletion( percent );
		var message = totalCopied + " documents copied to Cloudant out of " + this.pipeRunStats.expectedTotalRecords
			+ " (" + percent + "%)";
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

		var selectStmt = "SELECT ";
		var first = true;
		table.fields.forEach( function( field ){
			selectStmt += (first ? "": ",") + field.name;
			first = false;
		});
		selectStmt += " FROM " + table.name;
		logger.trace( selectStmt );

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
				callback();
			}
		}

		var conn = this.pipeRunStats.sfConnection;
		conn.query(selectStmt)
		.on("record", function(record) {
			stats.numRecords++;

			//Add the type to the record
			record.pt_type = table.name;
			
			//Process record transformation
			//transformer.process( record );

			batch.batchDocs.push( record );
			processBatch( false );
		})
		.on("end", function(query) {
			logger.trace("total in database : " + query.totalSize);
			logger.trace("total fetched : " + query.totalFetched);

			processBatch( true, function( err ){
				pipeRunStats.addTableStats( stats );
				return callback(null, stats);
			});
		})
		.on("fetch", function(){
			//Call garbage collector between fetches
			global.gc();
		})
		.on("error", function(err) {
			logger.error("Error while processing table " + table.name + ". Error is " + err );
			stats.errors.push( err );
			pipeRunStats.addTableStats( stats );
			return callback( null, stats );	//Do not stop other tables to go through
		})
		.run({ autoFetch : true, maxFetch : (table.expectedNumRecords || 200000) });
	}.bind(this);

	//public APIs
	this.run = function( callback ){
		var logger = this.pipeRunStats.logger;
		var stepStats = this.stats;
		stepStats.numRecords = 0;

		//Get the tables to process
		var tables = this.getPipeRunner().getSourceTables();

		//record stats for each table
		this.pipeRunStats.tableStats = {};

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
			var message = require("util").format( "Successfully copied %d documents from Salesforce to Cloudant", totalCopied);
			logger.info( message );
			this.setStepMessage( message );
			return callback( err );
		}.bind(this));
	}
}

module.exports = sfToCloudantStep;