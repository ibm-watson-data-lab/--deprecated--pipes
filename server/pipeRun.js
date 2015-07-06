'use strict';

/**
*	Encapsulate implementation of a pipe Run
*	@Author: David Taieb
*/

var pipeDb = require("./pipeStorage");
var _ = require("lodash");
var async = require("async");
var moment = require("moment");

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
	 * @callback: function( err, stats )
	 */
	var processTable = function( table, runListener, callback ){
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
		this.conn.query(selectStmt)
		.on("record", function(record) {
			stats.numRecords++;
			//Add the type to the record
			record.pt_type = table.name; 
			runListener.onNewRecord( record, stats, function( err, savedItem ){
				if ( err ){
					stats.errors.push( err );
					//return callback( err );
				}				
			});
		})
		.on("end", function(query) { 
			return callback(null, stats);
		})
		.on("error", function(err) {
			console.log("Error while processing table " + table.name + ". Error is " + err );
			stats.errors.push( err );
			return callback( null, stats );	//Do not stop other tables to go through
		})
		.run({ autoFetch : true, maxFetch : 4000 });
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
		_.forEach( statsArray, function(stats){
			runDoc.stats[stats.tableName] = stats;
			//Aggregate records for this table
			runDoc.numRecords += stats.numRecords;
			if ( stats.errors.length > 0 ){
				hasErrors = true;
			}
		});
		
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
				if ( _.isFunction( runListener.beforeProcessTable ) ){
					processTableFunctions.push( function( callback ){
						runListener.beforeProcessTable(table, callback );
					});
				}
				processTableFunctions.push( function( callback ){
					processTable( table, runListener, function( err, stats ){
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