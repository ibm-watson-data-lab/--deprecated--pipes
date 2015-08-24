//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

var pipeRunStep = require('../../run/pipeRunStep');
var sampleConUtil = require('./sampleConUtil.js'); 
var _ = require('lodash');
var async = require('async');

/**
 * Extends pipeRunStep
 * This sample step copies static data to the cloudant stagings database(s)
 */
function sampleDataCopyStep(){
	pipeRunStep.call(this);

	// TODO: Assign a display label to step 
	this.label = 'Copy data from Sample data source to Cloudant';

	/*
	 * public API (pipeRunStep.js)
	 * 
	 */
	this.run = function( callback ){

		// TODO customize step message
		this.setStepMessage('Copying data from sample data source to Cloudant staging area ...');
		
		// stepStats maintains information about this step
		var stepStats = this.stats;	
		// no records have been fetched yet
		stepStats.numRecords = 0;  

		/* Example stepStats
		   {
		    "label": "Copy data from Sample data source to Cloudant",							// assigned through this.label = 						
		    "status": "FINISHED",																// assigned by runtime environment(ignore)
		    "error": "",
		    "startTime": "2015-08-20T22:19:10.542Z",											// assigned by runtime environment(ignore)
		    "percent": 100,																		// assigned by runtime environment(ignore)
		    "message": "Copying data from sample data source to Cloudant staging area ...",		// assigned through this.setStepMessage(
		    "numRecords": 52,																	// total number of records fetched
		    "endTime": "2015-08-20T22:19:13.783Z",												// assigned by runtime environment(ignore)
		    "elapsedTime": "a few seconds"
  		   }
		*/

		// get logger
		var logger = this.pipeRunStats.logger;

		logger.trace('sampleDataCopyStep.run() - Entry');	
		
		var pipe = this.getPipe();
		var pipeRunStats = this.pipeRunStats;
		
		// tables is an array, containing the names of the tables for which data needs to be fetched
		var tables = this.getPipeRunner().getSourceTables();
	
		logger.debug('sampleDataCopyStep.run(): ' + tables.length + ' tables will be processed.');

		// loop through all tables
		async.map( tables, function( table, callback ){

				logger.info('sampleDataCopyStep.run(): Started processing of table ' + table +'.');

				// fetch data from a table and store it in the corresponding Cloudant staging database
				async.series( getProcessTableFunctions(logger, table, pipe, pipeRunStats), function( err, results) {

					// invoked after all functions returned by getProcessTableFunctions() have been processed (or an error was raised)
					if(err) {
							logger.error('sampleDataCopyStep.run() - Error while processing table ' + table.name + ' : ' + JSON.stringify(err));
							return callback(err);
					}

					logger.debug('sampleDataCopyStep.run() - processing for table ' + table.name + ' complete: ' + JSON.stringify(results));		

					// results is an array containing the output from each table function call.
					var tableStats =  _.find( results, function( result ){	
							return (result != null); // 
					});

					logger.info('sampleDataCopyStep.run(): ' + tableStats.numRecords + ' records for table ' + tableStats.tableName +' were copied from the sample data source to the Cloudant staging database.');

					logger.trace('sampleDataCopyStep.run() - Exit');
		
					return callback(err, tableStats); // signal async.map that processing for a specific table has completed

				}); // async.series
			}, function (err, statsArray) {
			
				// Aggregate record count after async.map has finished
				logger.debug('sampleDataCopyStep.run() - aggregating statistics: ' + JSON.stringify(statsArray));	

				// determine wether processing of at least one table resulted in an error
				var hasErrors = false;	

				if ( _.isArray( statsArray ) ){
					_.forEach( statsArray, function(stats){
						if ( stats ){
							if ( stats.errors.length > 0 ){
								hasErrors = true;
							}
							// keep track of the total number of records that were copied
							stepStats.numRecords += stats.numRecords;					
						}
					});
				}

				// set step status
				if ( err ){
					stepStats.status = 'Aborted: ' + err;
				}else if( hasErrors ){
					stepStats.status = 'Completed with one or more errors.';
				}else{
					stepStats.status = 'Completed.';
				}					
			
				// TODO: use appropriate step message
				this.setStepMessage('Copied ' + stepStats.numRecords + ' records from sample data source to Cloudant staging area.');

				return callback( err );

		}.bind(this)); // async.map

	}; // run

	/*
	* Creates an array of functions to be processed sequentially by async.series for the specified table
	*/
	var getProcessTableFunctions = function( logger, table, pipe, pipeRunStats){
		
		var processTableFunctions = []; // return array

		var targetDb = null; // helper variable; it it used to make output from sampleConUtil.createCloudantDbForTable available to sampleConUtil.copyData

		// Function 1: create a Cloudant database for the specified table
		processTableFunctions.push( function( callback ){

			sampleConUtil.createCloudantDbForTable(logger, table, function( err, result){

				if ( err ){
					// there was a problem creating the Cloudant database; signal async.series to abort
					return callback(err);
				}

				//result is targetDb
				targetDb = result;

				return callback(null);	// indicate that the next function can be processed by async.series (note that we don't need the result)
			});
		});

		// Function 2: copy all data for this table to Cloudant
		processTableFunctions.push( function( callback ){
			sampleConUtil.copyData( logger, table.name, pipe, pipeRunStats, targetDb, function( err, stats ){
				if ( err ){
					// there was a problem fetching data from the sample data source or writing data to Cloudant; signal async.series to abort
					return callback( err );
				}
				//Process for this table was successful, return stats for this copy operation
				return callback( null, stats );
			});
		});

		return processTableFunctions;
	}; // getProcessTableFunctions

	
} // sampleDataCopyStep

module.exports = sampleDataCopyStep;