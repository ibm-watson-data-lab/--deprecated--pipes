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

var pipeRunStep = require('../../run/pipeRunStep.js');
var Stripe = require('stripe');
var stripeConUtil = require('./stripeConUtil.js'); 
var _ = require('lodash');
var copyJob = require('./copyJob.js');
var async = require('async');

/**
 * Extends pipeRunStep
 * This function copies data for one or more stripe object types (referred to as tables in the UI) into dedicated Cloudant databases.
 */
function copyFromStripeToCloudantStep(){
	pipeRunStep.call(this);

	this.label = 'Copy data from stripe.com to Cloudant';

	/*
	 * public API (pipeRunStep.js)
	 * 
	 */
	this.run = function( callback ){

		this.setStepMessage('Copying data from stripe.com to Cloudant staging area ...');
		
		var stepStats = this.stats;	
		stepStats.numRecords = 0;   

		// get logger
		var logger = this.pipeRunStats.logger;

		logger.trace('copyFromStripeToCloudantStep.run() - Entry');	
		
		var pipe = this.getPipe();

		logger.info('Running pipe ' + pipe._id + ' using stripe connector version ' + stripeConUtil.getMetaInfo().version);

		var pipeRunStats = this.pipeRunStats;
		
		// process the selected table(s)
		var tables = this.getPipeRunner().getSourceTables();

		// instruct the nodejs library to send the secret stripe API key with each request
		var stripe = new Stripe(this.getPipe().clientSecret);
		
		logger.debug('copyFromStripeToCloudantStep.run(): ' + tables.length + ' tables will be processed.');

		// keep track of progress
		var processedTableCount = 0;
		this.setPercentCompletion( 1 );

		// process selected stripe object types 
		async.map( tables, function( table, callback ){

				logger.info('copyFromStripeToCloudantStep.run(): Started processing of table ' + table.name +'.');

				async.series( getProcessTableFunctions(logger, table, pipe, pipeRunStats, stripe), function( err, results) {

					// invoked after all functions returned by getProcessTableFunctions() have been processed (or an error was raised)
					if(err) {
							logger.error('copyFromStripeToCloudantStep.run() - Error while processing table ' + table.name + ' : ' + JSON.stringify(err));
							return callback(err);
					}

					logger.debug('copyFromStripeToCloudantStep.run() - processing for table ' + table.name + ' complete: ' + JSON.stringify(results));		

					// 
					// update step progress after processing for a table has completed
					// 
					processedTableCount++; 

					this.setPercentCompletion( processedTableCount == 0 ? 1 : ((processedTableCount/tables.length)*100).toFixed(1) );

					// results is an array containing the output from each table function call.
					// Only the second step (copyJob.run) should return a result. Get it.
					var tableStats =  _.find( results, function( result ){	
							return (result != null); // 
					});

					logger.info('copyFromStripeToCloudantStep.run(): ' + tableStats.numRecords + ' records for table ' + tableStats.tableName +' were copied from stripe to the Cloudant staging database.');

					logger.trace('copyFromStripeToCloudantStep.run() - Exit');
		
					return callback(err, tableStats); // signal async.map that processing for a specific table has completed

				}.bind(this)); // async.series

			}.bind(this), function (err, statsArray) {
			
				// Aggregate record count after async.map has finished
				logger.debug('copyFromStripeToCloudantStep.run() - aggregating statistics: ' + JSON.stringify(statsArray));	

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
			
				logger.info('Copied ' + stepStats.numRecords + ' records from stripe.com to Cloudant staging area.');
				this.setStepMessage('Copied ' + stepStats.numRecords + ' records from stripe.com to Cloudant staging area.');

				return callback( err );

		}.bind(this)); // async.map

	}; // run

	/*
	* Creates an array of functions to be processed sequentially by async.series for the specified table
	*/
	var getProcessTableFunctions = function( logger, table, pipe, pipeRunStats, stripeHandle){
		
		var processTableFunctions = []; // return array

		var targetDb = null; // helper variable; it it used to make output from stripeConUtil.createCloudantDbForTable available to copyJob.run

		// Function 1: create a Cloudant database for the specified table
		processTableFunctions.push( function( callback ){

			stripeConUtil.createCloudantDbForTable(logger, table, function( err, result){

				if(err) {
					// Instead of raising a fatal error ('return callback(err)'') save the error information and invalidate the database handle
					// The next step will skip processing.
					targetDb = null;	

					return callback( null, 
							{
								tableName : table.name,			// table name
								numRecords: 0,					// total number of records written to Cloudant
								expectedRecordCount: 0,			// expected number of records to be written to Cloudant
								dbName : stripeConUtil.getCloudantDatabaseName(table.name),
								errors: [err]					// database initialization error information
							}
					);
				}
				else {
					targetDb = result; //result is targetDb
				}

				return callback(null);	// indicate that the next function can be processed by async.series (note that we don't need the result)
			});
		});

		// Function 2: copy all data for this table to Cloudant if the staging database was created successfully
			processTableFunctions.push( function( callback ){
				copyJob.run( logger, table.name, pipe, pipeRunStats, targetDb, stripeHandle, function( err, stats ){
					if ( err ){
						// there was a problem reading data from stripe or writing data to Cloudant; signal async.series to abort
						return callback( err );
					}
					//Process for this table was successful, return stats for this copy operation
					return callback( null, stats );
				});
		});

		return processTableFunctions;
	}; // getProcessTableFunctions

	
} // copyFromStripeToCloudantStep

module.exports = copyFromStripeToCloudantStep;