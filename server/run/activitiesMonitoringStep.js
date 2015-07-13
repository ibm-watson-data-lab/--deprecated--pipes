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
		
		//Start monitoring the activities
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
						}
//						else{
//							console.log("Waiting for Activity %s to complete", tableName);
//						}
						return callback();
					})
				}else{
					return callback();
				}
			},function(err){
				if ( err ){
					return callback(err);
				}
				console.log("%d activities running and %d activities completed", stepStats.numRunningActivities, stepStats.numFinishedActivities);
				if ( stepStats.numRunningActivities > 0 ){
					//Schedule another round
					return setTimeout( monitor, 10000 );
				}
				stepStats.status = "All DataWorks activities have been completed";
				return callback();
			});
		};
		setTimeout( monitor, 10000 );		
	}
}

module.exports = activitiesMonitoringStep;