'use strict';

/**
*	Pipe Run Stats implementation
*	@Author: David Taieb
*/

var moment = require("moment");
var pipeDb = require("./pipeStorage");
var _ = require("lodash");

/**
 * PipeRunStats class
 * encapsulate the stats for a particular run
 */
function pipeRunStats(pipe, steps, callback){
	this.pipe = pipe;
	var runDoc = {
		type : "run",
		startTime : moment(),
		pipeId: pipe._id,
		status: "NOT_STARTED",
		error: null,
		tableStats : {},
		message:""
	};
	
	for ( var i = 0; i < steps.length; i++ ){
		//Assign a space for this step
		steps[i].stats = {
			label: steps[i].label,
			status: "NOT_STARTED",
			error: ""
		};
		
		runDoc["step" + i] = steps[i].stats;
	}
	
	var save = this.save = function(callback){
		//Create a new run doc and associate it with this pipe
		pipeDb.saveRun( pipe, runDoc, function( err, runDocument ){
			if ( err ){
				console.log("Unable to save run information: " + err );
				return callback && callback( err );
			}
			//Replace with the latest doc from db
			runDoc = runDocument;
			return callback && callback();
		});
	}
	
	//Initial save
	save( callback );
	
	//Public apis
	this.getId = function(){
		return runDoc._id;
	}
	
	this.getPipe = function(){
		return this.pipe;
	}
	
	this.setMessage = function( message ){
		runDoc.message = message || "";
	}
	
	this.getTableStats = function(){
		return runDoc.tableStats;
	}
	
	this.addTableStats = function( stats ){
		if ( runDoc.tableStats.hasOwnProperty( stats.tableName )){
			//Merge the two objects
			_.assign( runDoc.tableStats[stats.tableName], stats );
		}else{
			runDoc.tableStats[stats.tableName] = stats;
		}
		
		//Save the document
		save();
	}	
	
	this.start = function(){
		console.log("Starting a new run");
		runDoc.startTime = moment();
		runDoc.status = "RUNNING";
	}
	
	this.done = function(err ){
		if ( err ){
			runDoc.status = "ERROR";
			runDoc.message = "" + err;
		}else{
			runDoc.status = "FINISHED";
			runDoc.message = "Pipe Run completed Successfully";
		}
		
		runDoc.endTime = moment();
		runDoc.elapsedTime = moment.duration( runDoc.endTime.diff( runDoc.startTime ) ).humanize();
		
		//compute the number of records processed
		runDoc.numRecords = 0;
		_.forEach( runDoc.tableStats, function( value, key){
			if ( value && value.numRecords ){
				runDoc.numRecords += value.numRecords;
			}
		})
		
		console.log( runDoc.message );
		
		//Save the document
		save();
	}
}

module.exports = pipeRunStats;