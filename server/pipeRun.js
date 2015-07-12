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
var dataworks = require("./dw/dataworks");
var util = require("util");

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
			dbName : targetDb.getDbName(),
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
		.run({ autoFetch : true, maxFetch : 100000 });
	}.bind(this);
	
	//This is step1 finish handler
	var finishStep1 = function( err, statsArray, callback ){		
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
				return callback( err );
			}
			return callback(null);
		})
	}.bind(this);
	
	/**
	 * create DataWorksActivities for each tables and run them
	 * @param statsArray: step1 stats
	 * @param callback(err, dataWorksStats)
	 */
	var createAndRunDataWorksActivities = function( statsArray, callback){
		console.log("Step2: Creating DataWorks activities");
		var dwInstance = new dataworks();
		var runDoc = this.runDoc;
		
		//Create the activities if needed
		dwInstance.listActivities( function( err, activities ){
			if ( err ){
				console.log( "Unable to get list of DataWorks activities: " + err );
				return callback( err );
			}
			
			if ( _.isArray( statsArray ) ){
				async.each( statsArray, function(stats, callback ){
					var runActivityFn = function(activity){
						dwInstance.runActivity( activity.id, function( err, activityRun ){
							if ( err ){
								return callback( err );
							}
							stats.activityRunId = activityRun.id;
							console.log("SuccessFully submitted a activity for running. Waiting for results...: " + util.inspect( activityRun, { showHidden: true, depth: null } ) );
							return callback( null );
						});
					}
					var activity = _.find( activities, function( act ){
						return act.name.toLowerCase() === stats.dbName.toLowerCase();
					});
					if ( activity ){
						console.log("Activity %s already exists", stats.dbName);
						stats.activityId = activity.id;
						//Run it now
						runActivityFn(activity);
					}else{
						console.log("Creating activity for table " + stats.dbName );

						var srcConnection = dwInstance.newConnection("cloudant");
						srcConnection.setDbName( stats.dbName.toLowerCase() );
						srcConnection.addTable( {
							name: stats.dbName.toUpperCase()
						});
						var targetConnection = dwInstance.newConnection("dashDB");
						targetConnection.setSourceConnection( srcConnection );

						dwInstance.createActivity({
							name: stats.dbName,
							desc: "Generated by Pipes Tool - Cloudant to dashDB",
							srcConnection: srcConnection,
							targetConnection: targetConnection
						}, function( err, activity ){
							if ( err ){
								return callback( err );
							}

							//Record the activity id and start execution
							stats.activityId = activity.id;							
							console.log("SuccessFully created a new activity: " + util.inspect( activity, { showHidden: true, depth: null } ) );
							//Run it now
							runActivityFn(activity);
						});
					}
				}, function(err){
					if ( err ){
						return callback(err);
					}
					
					//Save the run, before starting monitoring
					pipeDb.saveRun( pipe, runDoc, function( err, runDoc ){
						if ( err ){
							return callback( err );
						}
					})
					
					//Start monitoring the activities
					var monitor = function(){
						console.log("Monitoring activities...");
						var running = 0;
						var finished = 0;
						async.each( statsArray, function(stats, callback ){
							if ( !stats.activityDone ){
								dwInstance.monitorActivityRun( stats.activityId, stats.activityRunId, function( err, activityRun ){
									if ( err ){
										return callback(err);
									}
									if ( dwInstance.isFinished( activityRun.status ) ){
										console.log("ActivityRun complete");
										finished++;
										stats.activityDone = true;
										callback();
									}else{
										running++;
										callback();
									}
								})
							}else{
								finished++;
								callback();
							}
						},function(err){
							if ( err ){
								return callback(err);
							}
							console.log("%d activities running and %d activities completed", running, finished);
							if ( running > 0 ){
								//Schedule another round
								setTimeout( monitor, 10000 );
							}else{
								runDoc.step2 = {
									status: "Finished"
								}
								callback();
							}
						});
					};
					setTimeout( monitor, 10000 );
				});
			}
		});
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
			
			//This is the main dispatcher code for processing the tables for Step1 (copy to Cloudant)
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
				finishStep1( err, statsArray, function( err ){
					if ( err ){
						return runListener.done( err );
					}
					//On to step2: create dataworks activities for each tables
					createAndRunDataWorksActivities( statsArray, function( err, dataWorksStats ){
						console.log("Done creating activities: " + err );
						return runListener.done( err );
					});
				} );
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