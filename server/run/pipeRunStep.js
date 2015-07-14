'use strict';

/**
*	Pipe Run Step implementation
*	@Author: David Taieb
*/

var moment = require("moment");

/**
 * PipeRunStep class
 * Abstract Base class for all run steps 
 */
function pipeRunStep(){
	//Public APIs
	/**
	 * run: run this step
	 * Should be implemented by subclasses
	 */
	this.run = function( callback ){
		throw new Error("Called run method from abstract pipeRunStep class");
	}
	
	this.getLabel = function(){
		return this.label || "Unknown label";
	}
	
	this.getPipe = function(){
		return (this.pipeRunStats && this.pipeRunStats.getPipe()) || null;
	}
	
	this.getPipeRunner = function(){
		return this.pipeRunner || null;
	}
	
	this.setStepMessage = function(message){
		this.stats.message = message;
		this.pipeRunStats.broadcastRunEvent();
	}
	
	this.beginStep = function( pipeRunner, pipeRunStats ){
		//Reference to the main stats object
		this.pipeRunStats = pipeRunStats;
		this.pipeRunner = pipeRunner;
		
		pipeRunStats.setMessage( this.label );
		
		//Record the start time
		this.stats.startTime = moment();
		this.stats.status = "RUNNING";
		
		this.pipeRunStats.save();
	}

	this.endStep = function(callback){
		//Set the end time and elapsed time
		this.stats.endTime = moment();
		this.stats.elapsedTime = moment.duration( this.stats.endTime.diff( this.stats.startTime ) ).humanize();
		
		this.stats.status = "FINISHED";
		this.pipeRunStats.save( callback );
	}
}

module.exports = pipeRunStep;