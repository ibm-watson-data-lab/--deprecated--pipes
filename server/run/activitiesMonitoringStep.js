'use strict';

/**
*	Step used to monitor dataworks activities
*	@Author: David Taieb
*/

var pipeRunStep = require('./pipeRunStep');
var _ = require('lodash');
var async = require('async');

/**
 * activitiesMonitoringStep class
 */
function activitiesMonitoringStep(){
	pipeRunStep.call(this);
	
	this.label = "Monitoring DataWorks Activities for completion";
	
	//public APIs
	this.run = function( callback ){
		var pipeRunStats = this.pipeRunStats;
		
		//Get the DataWorks instance
		var dwInstance = pipeRunStats.dwInstance;
		
		var stepStats = this.stats;
		stepStats.numRunningActivities = 0;
		_.forOwn( pipeRunStats.getTableStats(), function(value, key ){
			stepStats.numRunningActivities++;
		})
		
		stepStats.numFinishedActivities = 0;
		
		//convenience method
		var expectedLength = this.getPipeRunner().getSourceTables().length;
		var formatStepMessage = function(){
			var percent = ((stepStats.numFinishedActivities/expectedLength)*100).toFixed(1);
			var message = stepStats.numFinishedActivities + " DataWorks activities completed (" + percent + "%)";
			this.setStepMessage( message );
		}.bind(this);
		
		//Start monitoring the activities
		formatStepMessage();
		var monitor = function(){
			async.forEachOf( pipeRunStats.getTableStats(), function(tableStats, tableName, callback ){
				if ( !tableStats.activityDone ){
					dwInstance.monitorActivityRun( tableStats.activityId, tableStats.activityRunId, function( err, activityRun ){
						if ( err ){
							return callback(err);
						}
						if ( dwInstance.isFinished( activityRun.status ) ){
							//console.log("ActivityRun complete");
							stepStats.numFinishedActivities++;
							stepStats.numRunningActivities--;
							tableStats.activityDone = true;
							formatStepMessage();
						}
						return callback();
					})
				}else{
					return callback();
				}
			},function(err){
				if ( err ){
					return callback(err);
				}
				if ( stepStats.numRunningActivities > 0 ){
					//Schedule another round
					return setTimeout( monitor, 10000 );
				}
				var message = "All DataWorks activities have been completed";
				stepStats.status = message;
				this.setStepMessage(message);
				return callback();
			}.bind(this));
		}.bind(this);
		setTimeout( monitor, 10000 );		
	}
}

module.exports = activitiesMonitoringStep;