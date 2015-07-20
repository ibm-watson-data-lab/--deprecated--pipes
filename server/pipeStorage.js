'use strict';

/**
*	Endpoints for managing data pipes
*	@Author: David Taieb
*/

var cloudant = require('./storage');
var _ = require('lodash');
var moment = require('moment');
var schedule = require('node-schedule');
var global = require('./global');

var dbName =  process.env.CLOUDANT_DB_NAME || "pipe_db";
var allPipesView = "all_pipes";

//Map of scheduled jobs
var jobs = {};

var addScheduledJob = function(pipe){
	
	//Validate pipe
	if ( !pipe.scheduleTime ){
		return null;
	}

	//Check if it doesn't already exist
	if ( jobs.hasOwnProperty(pipe._id) ){
		var jobInfo = jobs[pipe._id];
		if ( jobInfo.scheduleTime === pipe.scheduleTime ){
			return jobInfo.job;
		}else{
			//Cancel this job and create a new one
			removeScheduledJob( pipe );
		}
	}
	
	var m = moment( pipe.scheduleTime)
	var rule = new schedule.RecurrenceRule();
	rule.hour = m.hour()
	rule.minute = m.minute();

	console.log("Add new scheduled job: %d:%d", rule.hour, rule.minute);
	var job = schedule.scheduleJob(rule, function(){
		if ( global.currentRun ){
			console.log("Unable to execute a schedule run for pipe %s because a run is already in progress", pipe._id);
			return;
		}
		
		//Emit an event
		global.emit("runScheduledEvent", pipe._id );
	});
	
	//Save in the cache
	jobs[pipe._id] = {
		scheduleTime: pipe.scheduleTime,
		job : job,
		pipeId : pipe._id
	}
}

var removeScheduledJob = function( pipe ){
	if ( jobs.hasOwnProperty( pipe._id )){
		console.log("Removing scheduled job for pipe id " + pipe._id);
		//cancel existing job
		jobs[pipe._id].job.cancel();
		delete jobs[pipe._id];
	}
}

var viewsManager = new cloudant.views('_design/application');
viewsManager
.addView( 
	"all_pipes",
	{
		map: function(doc){
			if ( doc.type === "pipe" ){
				emit( doc._id, {'_id': doc._id} );
			}
		}
	}, 2 //Version
)
.addView( 
	"all_scheduled_pipes",
	{
		map: function(doc){
			if ( doc.type === "pipe" && doc.scheduleTime ){
				emit( doc._id, {'_id': doc._id} );
			}
		}
	}, 1 //Version
)
.addView( 
	"all_running_pipes",
	{
		map: function(doc){
			if ( doc.type === "pipe" && doc.run ){
				emit( doc._id, {'_id': doc._id} );
			}
		}
	}, 1 //Version
)
.addView( 
	"all_runs",
	{
		map: function(doc){
			if ( doc.pipeId && doc.type === "run" ){
				emit( [doc.startTime, doc.pipeId], doc._id );
			}
		}
	}, 4 //Version
)
var pipeDb = new cloudant.db(dbName, viewsManager );

pipeDb.on( "cloudant_ready", function(){
	console.log("Data Pipe Configuration database (" + dbName + ") ready");
	
	//Check pipes for references to stale runs
	pipeDb.listPipes( function( err, pipes ){
		if ( err ){
			//should not happen
			return console.log( err );
		}
		_.forEach( pipes, function( pipe ){
			if ( pipe.run ){
				pipeDb.upsert( pipe._id, function( storedPipe ){
					if ( storedPipe && storedPipe.hasOwnProperty("run") ){
						//Mark the run as STOPPED
						pipeDb.upsert( storedPipe.run, function( doc ){
							doc.status = "STOPPED";
							doc.message = "Run didn't complete normally. See details";
							return doc;
						}, function( err, runDoc ){
							if ( err ){
								console.log( "Unable to save run: " + err );
							}
						});						
					}
					delete storedPipe["run"];
					return storedPipe;
				}, function( err, doc ){
					if ( err ){
						console.log("Unable to break reference to stale run " + err );
					}
				});
			}
			
			//If scheduled, then create a new job now.
			//TODO: Read from the all_scheduled_view instead
			if ( pipe.scheduleTime ){
				addScheduledJob( pipe );
			}
		});
	});
});

pipeDb.on("cloudant_error", function(){
	throw new Error("Fatal error from Cloudant database: unable to initialize " + dbName);
});

//Get pipe by Id
pipeDb.getPipe = function( id, callback, noFilterForOutbound ){
	noFilterForOutbound = noFilterForOutbound || false;
	this.getDoc( id, function( err, body ){
		if ( err ){
			return callback( err );
		}
		return callback( null, noFilterForOutbound ? body : outboundPayload( body ) );
	});
};

/**
 * Return a filtered down version of the pipe for outbound purposes
 * @param pipe
 */
function outboundPayload( pipe ){
	//Clone first
	var result = JSON.parse(JSON.stringify( pipe ) );
	if ( result.hasOwnProperty("tables")){
		//Filtered down the table object as the info it contains is too big to be transported back and forth
		result.tables = _.map( result.tables, function( table ){
			return { name: table.name, label: table.label, labelPlural: table.labelPlural };
		});
	}
	
	if ( result.hasOwnProperty( "sf") ){
		delete result.sf;
	}
	return result;
}

/**
 * Merge the pipe with the stored value, restoring any fields that have been filtered during outbound
 */
function inboundPayload( storedPipe, pipe ){
	if ( storedPipe && storedPipe.hasOwnProperty( "tables" ) ){
		pipe.tables = storedPipe.tables;
	}
	
	if ( !pipe.hasOwnProperty("sf") ){
		if ( storedPipe && storedPipe.hasOwnProperty( "sf" ) ){
			pipe.sf = storedPipe.sf;
		}
	}
	return pipe;
}

pipeDb.savePipe = function( pipe, callback ){
	//Make sure doc has the right type
	pipe.type = "pipe";
	//If new pipe, then _id is just a placeholder, new to remove it before saving it
	if ( pipe.hasOwnProperty("new") ){
		pipe._id = null;
		delete pipe["new"];
	}
	
	if (!pipe.scheduleTime){
		removeScheduledJob(pipe);
	}else{
		addScheduledJob(pipe);
	}
	
	this.upsert( pipe._id, function( storedPipe ){
		return inboundPayload( storedPipe, pipe );
	}, function( err, data ){
		if ( err ){
			return callback( err );
		}
		return callback( null, outboundPayload(data) );
	});
}

pipeDb.listPipes = function( callback ){
	this.run( function( err, db ){
		db.view('application', allPipesView, {'include_docs':true},
			function(err, data) {
				if ( err ){
					//No pipes yet, return empty array
					return callback( null, [] );
				}
				
				if ( data.rows && data.rows.length == 0 ){
					//Need at least one pipe, create a place holder now
					return pipeDb.savePipe( {name:'Pipe1'}, function( err, pipe ){
						if ( err ){
							return callback( err );
						}						
						return callback( null, [pipe]);
					});
				}
				return callback( null, _.map( data.rows, function( row ){
					return outboundPayload(row.doc);
				}));
			}
		);
	});
}

pipeDb.removePipe = function( id, callback ){
	this.getPipe( id, function( err, pipe ){
		if ( err ){
			return callback( err );
		}
		
		this.run( function( err, db ){
			if ( err ){
				return callback(err);
			}
			db.destroy( pipe._id, pipe['_rev'], function( err, data ){
				if ( err ){
					return callback( err );
				}
				return callback( null, data );
			});
		});
	}.bind( this ));
}

/**
 * Create or Save a Run for specified pipe
 */
pipeDb.saveRun = function(pipe, run, callback){	
	this.upsert( run._id, function( doc ){
		return run;
	}, function( err, runDoc ){
		if ( err ){
			return callback( err );
		}
		
		//Add the run to doc if needed
		if ( pipe.run !== runDoc._id ){
			this.upsert( pipe._id, function( storedPipe ){
				if ( !runDoc.status ){
					storedPipe.run = runDoc._id;
				}
				return storedPipe;
			}, function( err ){
				if ( err ){
					return callback( err );
				}			
			});
		}
		return callback( null, runDoc );
	}.bind(this));
}

/**
 * fetch a run document by Id from the database
 */
pipeDb.getRun = function( runId, callback ){
	this.getDoc( runId, callback );
}

module.exports = pipeDb;