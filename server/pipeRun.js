'use strict';

/**
*	Encapsulate implementation of a pipe Run
*	@Author: David Taieb
*/

var pipeDb = require("./pipeStorage");
var async = require("async");

function pipeRun( pipe, jsForceConnection ){
	this.pipe = pipe;
	this.runDoc = {
		type : "run",
		startTime : null,
		endTime : null,
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
			numRecords: 0
		};
		var selectStmt = "SELECT ";
		var first = true;
		table.fields.forEach( function( field ){
			selectStmt += (first ? "": ",") + field.name;
			first = false;
		});
		selectStmt += " FROM " + table.name;
		console.log( selectStmt );

		this.conn.query(selectStmt)
		.on("record", function(record) {
			stats.numRecords++;
			//Add the type to the record
			record.pt_type = table.name; 
			runListener.onNewRecord( record, stats, function( err, savedItem ){
				if ( err ){
					return callback( err );
				}				
			});
		})
		.on("end", function(query) {
			return callback(null, stats);
		})
		.on("error", function(err) {
			return callback( err );
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
			
		});
	}
	
	//Public APIs
	this.processSourceTables = function( tables, runListener ){
		//Create a new run document for this pipe in the cloudant db
		pipeDb.createNewRun( pipe, this.runDoc,function( err, runDoc ){
			if ( err ){
				return err;
			}
			//Save the running doc
			this.runDoc = runDoc;
			async.map( tables, function( table, callback ){
				processTable( table, runListener, function( err, stats ){
					if ( err ){
						return callback( err );
					}
					//Process for this table was successful, roll up the stats
					return callback( null, stats );
				});			
			}, function( err, statsArray ){
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