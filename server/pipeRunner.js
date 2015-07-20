'use strict';

/**
*	Pipe Runner implementation
*	@Author: David Taieb
*/

var cloudant = require('./storage');
var _ = require("lodash");
var async = require("async");
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
	
	var getSteps = function(){
		var steps = [
             new (require("./run/sfConnectStep"))(),
             new (require("./run/sfToCloudantStep"))(),
             new (require("./run/cloudantToDashActivitiesStep"))(),
             new (require("./run/activitiesMonitoringStep"))()
        ];
		return steps;
	}
	
	//Public APIs
	/**
	 * getSourceTables
	 * @returns: array of source tables to be processed by the pipe 
	 */
	this.getSourceTables = function(){
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
	 * Create a new run
	 */
	this.newRun = function( callback ){
		var err = validate();
		if ( err ){
			return callback( err );
		}

		var steps = getSteps();
		var pipeRunStats = new (require("./pipeRunStats"))( pipe, steps, function(err){
			if ( err ){
				return callback(err);
			}
			pipeRunStats.start( function(err){
				async.eachSeries( steps, function( step, callback ){
					console.log( "Starting step : " + step.getLabel() );
					try{
						step.beginStep( this, pipeRunStats );
						step.run( function( err ){
							if ( err ){
								return callback( err );
							}
							step.endStep( callback );
						});
					}catch(e){
						//Error caught
						console.log("Exception caught: " + e);
						console.log("Stack: " + e.stack);
						step.endStep( callback, e );
					}
				}.bind(this), function( err ){
					//All done
					pipeRunStats.done( err );
				});
			}.bind(this));
			
			//Request accepted, send response back to the client immediately
			return callback( null, pipeRunStats);
		}.bind(this));
	};
}

//Export the module
module.exports = pipeRunner;