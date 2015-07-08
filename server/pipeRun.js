'use strict';

/**
*	Encapsulate implementation of a pipe Run
*	@Author: David Taieb
*/

var pipeDb = require("./pipeStorage");
var _ = require("lodash");
var async = require("async");
var moment = require("moment");
var global = require("./global");

function pipeRun( pipe, jsForceConnection ){
	this.pipe = pipe;
	this.runDoc = {
		type : "run",
		startTime : moment(),
		endTime : null,
		elapsedTime: 0,
		pipeId: pipe._id
	}
	this.conn = jsForceConnection;
	
	//Private APIs
	/**
	 * @param: table: json object representing the source table
	 * @param runListener
	 * @param targetDb: the target db to write data to
	 * @callback: function( err, stats )
	 */
	var processTable = function( table, runListener, targetDb, callback ){
		var stats = {
			tableName : table.name,
			numRecords: 0,
			errors: []
		};
		var selectStmt = "SELECT ";
		var first = true;
		table.fields.forEach( function( field ){
			selectStmt += (first ? "": ",") + field.name;
			first = false;
		});
		selectStmt += " FROM " + table.name;
		//console.log( selectStmt );
		
		//Batch the docs to minimize number of requests
		var batch = { batchDocs: [] };
		var maxBatchSize = 100;
		
		var processBatch = function( force, callback ){
			if ( batch.batchDocs.length > 0 && (force || batch.batchDocs.length >= maxBatchSize) ){
				var thisBatch = { batchDocs:batch.batchDocs};
				//Release the array for the next batch
				batch.batchDocs = [];
				runListener.onNewBatch( targetDb, thisBatch.batchDocs, stats, function( err, savedItem ){
					if ( err ){
						stats.errors.push( err );
					}
					delete thisBatch.batchDocs;
					if ( callback ){
						callback( err );
					}
				});
			}else if ( callback ){
				callback();
			}
		}
		
		this.conn.query(selectStmt)
		.on("record", function(record) {
			stats.numRecords++;

			//Add the type to the record
			record.pt_type = table.name; 
			
			batch.batchDocs.push( record );
			processBatch( false );
		})
		.on("end", function(query) {
			console.log("total in database : " + query.totalSize);
			console.log("total fetched : " + query.totalFetched);
			
			processBatch( true, function( err ){
				return callback(null, stats);
			});			
		})
		.on("fetch", function(){
			//Call garbage collector between fetches
			global.gc();
		})
		.on("error", function(err) {
			console.log("Error while processing table " + table.name + ". Error is " + err );
			stats.errors.push( err );
			return callback( null, stats );	//Do not stop other tables to go through
		})
		.run({ autoFetch : true, maxFetch : 30000 });
	}.bind(this);
	
	var finish = function( err, statsArray ){
		pipeDb.upsert( pipe._id, function( storedPipe ){
			if ( storedPipe && storedPipe.hasOwnProperty("run") ){
				delete storedPipe["run"];
			}
			return storedPipe;
		}, function( err, doc ){
			if ( err ){
				console.log( "Error while saving pipe information: " + err );
			}
		});
		
		//Compute the final stats and save the run
		var runDoc = this.runDoc;
		runDoc.numRecords = 0;
		runDoc.stats = {};
		var hasErrors = false;
		
		if ( _.isArray( statsArray ) ){
			_.forEach( statsArray, function(stats){
				if ( stats ){
					runDoc.stats[stats.tableName] = stats;
					//Aggregate records for this table
					runDoc.numRecords += stats.numRecords;
					if ( stats.errors.length > 0 ){
						hasErrors = true;
					}
				}
			});
		}
		
		if ( err ){
			runDoc.status = "Unsuccessful run: " + err;
		}else if( hasErrors ){
			runDoc.status = "Succesfully completed with errors";
		}else{
			runDoc.status = "Successfully completed";
		}
		
		//Set the end time and elapsed time
		runDoc.endTime = moment();
		runDoc.elapsedTime = moment.duration( runDoc.endTime.diff( runDoc.startTime ) ).humanize();
		
		
		pipeDb.saveRun( pipe, runDoc, function( err, runDoc ){
			if ( err ){
				console.log("Unable to save run information: " + err );
			}
		})
	}.bind(this);
	
	//Public APIs
	this.processSourceTables = function( tables, runListener ){
		//Create a new run document for this pipe in the cloudant db
		pipeDb.saveRun( pipe, this.runDoc,function( err, runDoc ){
			if ( err ){
				return err;
			}
			//Save the running doc
			this.runDoc = runDoc;
			
			var getProcessTableFunctions = function( table ){
				var processTableFunctions = [];
				var targetDb = null;
				if ( _.isFunction( runListener.beforeProcessTable ) ){
					processTableFunctions.push( function( callback ){
						runListener.beforeProcessTable(table, function( err, result){
							if ( err ){
								return callback(err);
							}
							//result is targetDb
							targetDb = result;
							return callback(null);	//Make sure to return no results!
						});
					});
				}
				processTableFunctions.push( function( callback ){
					processTable( table, runListener, targetDb, function( err, stats ){
						if ( err ){
							return callback( err );
						}
						//Process for this table was successful, roll up the stats
						return callback( null, stats );
					});		
				});
				return processTableFunctions;
			}
			
			async.map( tables, function( table, callback ){
				//Call the processTable with runListener events in series
				console.log("Starting processing table : " + table.name );
				async.series( getProcessTableFunctions(table), function( err, results){
					var stats =  _.find( results, function( result ){
						return result != null
					});
					console.log("Finished processing table " + table.name + ". Stats: " + JSON.stringify(stats));
					return callback(err, stats );
				});
			}, function( err, statsArray ){
				console.log("Step1 for run complete, writing stats...");
				//Call when all tables have finished processing
				finish( err, statsArray );
			});
		}.bind(this));
	};
	
	/**
	 * @Return: run id
	 */
	this.getId = function(){
		return this.runDoc ? this.runDoc._id : null;
	}
	
}

//Export the module
module.exports = pipeRun;