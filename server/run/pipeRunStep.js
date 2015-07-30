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
	
	this.setPercentCompletion = function( percent ){
		this.stats.percent = percent;
	}
	
	this.beginStep = function( pipeRunner, pipeRunStats ){
		pipeRunStats.logger.info( "Step %s started", this.getLabel() );
		
		//Reference to the main stats object
		this.pipeRunStats = pipeRunStats;
		this.pipeRunner = pipeRunner;
		
		pipeRunStats.setMessage( this.label );
		
		//Record the start time
		this.stats.startTime = moment();
		this.stats.status = "RUNNING";
		this.setPercentCompletion(0);
		
		this.pipeRunStats.save();
	}

	this.endStep = function(callback, err){
		//Set the end time and elapsed time
		this.stats.endTime = moment();
		this.stats.elapsedTime = moment.duration( this.stats.endTime.diff( this.stats.startTime ) ).humanize();
		
		this.stats.status = err ? "ERROR" : "FINISHED";
		if ( err ){
			this.setStepMessage( err );
		}
		this.setPercentCompletion(100);
		this.pipeRunStats.save( callback, err );
		
		this.pipeRunStats.logger.info({
			message: require('util').format("Step %s completed", this.getLabel() ),
			stats: this.stats
		});
	}
	
	/**
	 * toJSON serialization function
	 */
	this.toJSON = function(){
		return {
			label: this.getLabel()
		}
	}
}

module.exports = pipeRunStep;