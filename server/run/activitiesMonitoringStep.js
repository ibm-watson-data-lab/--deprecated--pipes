'use strict';

/**
*	Step used to monitor dataworks activities
*	@Author: David Taieb
*/

var pipeRunStep = require('./pipeRunStep');
var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var request = require('request');

/**
 * activitiesMonitoringStep class
 */
function activitiesMonitoringStep(){
	pipeRunStep.call(this);

	this.label = "Monitoring DataWorks activities for completion";

	//public APIs
	this.run = function( callback ){
		var logger = this.pipeRunStats.logger;
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
			this.setPercentCompletion( percent );
			var message = stepStats.numFinishedActivities + " DataWorks activities completed (" + percent + "%)";
			this.setStepMessage( message );
		}.bind(this);

		var sendAlert = function(){
			logger.info("Sending alert about possible DataWorks activities hung to metrics-collector");
			async.forEachOf( pipeRunStats.getTableStats(), function(tableStats, tableName, callback ){
				if ( !tableStats.activityDone ){
					var d = moment();
					var props = {
						idsite: "data.pipes",
						type : "pipe_alert",
						activityId: tableStats.activityId,
						activityRunId: tableStats.activityRunId,
						tableName: tableStats.tableName,
						numRecords: tableStats.numRecords,
						date: d.year() + "-" + (d.month() + 1) + "-" + d.date(),
						d: d.format()
					};
					request.get( {url: "http://metrics-collector.mybluemix.net/tracker", qs: props}, function(err, response, body){
						if ( !err ){
							logger.info("Successfully logged an alert to metrics-collector");
						}
						return callback( err );
					});
				}
			},function(err){
				if ( err ){
					logger.error("Unable to create DataWorks activity hung alert: " + err );
				}
			});
		}

		//Start monitoring the activities
		var timeout = moment.duration(5, 'minutes').asMilliseconds();	//timeout to raise possible dataworks hung alerts when no activities has completed.
		var alertSent = false;
		var start = moment();
		formatStepMessage();
		var monitor = function(){
			async.forEachOf( pipeRunStats.getTableStats(), function(tableStats, tableName, callback ){
				if ( !tableStats.activityDone ){
					dwInstance.monitorActivityRun( tableStats.activityId, tableStats.activityRunId, function( err, activityRun ){
						if ( err ){
							return callback(err);
						}
						if ( dwInstance.isFinished( activityRun.status ) ){
							logger.trace("ActivityRun %s complete", tableStats.activityRunId);
							stepStats.numFinishedActivities++;
							stepStats.numRunningActivities--;
							tableStats.activityDone = true;
							formatStepMessage();

							//Reset the timeout start
							start = moment();
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
					if ( moment.duration( moment().diff(start) ).asMilliseconds() > timeout ){
						if ( !alertSent ){
							alertSent = true;
							sendAlert();
						}
					}
					return setTimeout( monitor, 10000 );
				}
				var message = "DataWorks activities are complete";
				logger.info( message );
				stepStats.status = message;
				this.setStepMessage(message);
				return callback();
			}.bind(this));
		}.bind(this);
		setTimeout( monitor, 10000 );
	}
}

module.exports = activitiesMonitoringStep;