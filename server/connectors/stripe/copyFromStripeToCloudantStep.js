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

var pipesSDK = require('pipes-sdk');
var pipeRunStep = pipesSDK.pipeRunStep;
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

	// set label for this pipe run step
	this.label = 'Copy data from stripe.com to Cloudant';

	/*
	 * public API (pipeRunStep.js)
	 * 
	 */
	this.run = function( callback ){

		// set message for this step
		this.setStepMessage('Copying data from stripe.com to Cloudant staging area ...');
		
		var stepStats = this.stats;	
		stepStats.numRecords = 0;   

		// get pipe run logger
		var logger = this.pipeRunStats.logger;

		logger.trace('copyFromStripeToCloudantStep.run() - Entry');	
		
		var pipe = this.getPipe();

		logger.info('Running pipe ' + pipe._id + ' using stripe connector version ' + stripeConUtil.getMetaInfo().version);

		var pipeRunStats = this.pipeRunStats;
		
		// retrieve the selected stripe objects table(s)
		var tables = this.getPipeRunner().getSourceTables();

		// instruct the Stripe NODE.JS library to send the secret stripe API key with each request
		var stripe = new Stripe(this.getPipe().clientSecret);
		
		logger.debug('copyFromStripeToCloudantStep.run(): ' + tables.length + ' tables will be processed.');

		// counts the number of tables that have been processed
		var processedTableCount = 0;
		
		// Indicates how much processing has been completed. Whenever a source object has been completed, percent completion is increased.
		this.setPercentCompletion( 1 );

		// asynchronously process selected stripe objects (tables)
		async.map( tables, function( table, callback ){

				logger.info('copyFromStripeToCloudantStep.run(): Started processing of table ' + table.name +'.');

				// copy data for one source object; refer to getProcessTableFunctions below for details
				async.series( getProcessTableFunctions(logger, table, pipe, pipeRunStats, stripe), function( err, results) {

					// async.series callback is invoked after data copy for a source object has finished or a fatal error was raised
					// by one of the processing functions 

					if(err) {
							// fatal error occured; return error information to pipe runner framework
							logger.error('copyFromStripeToCloudantStep.run() - Fatal error while processing table ' + table.name + ' : ' + JSON.stringify(err));
							return callback(err);
					}

					logger.debug('copyFromStripeToCloudantStep.run() - processing for table ' + table.name + ' complete: ' + JSON.stringify(results));		

					// The results data structure is an array, containing either null or elements of type
    				//  { 
    				//    tableName: STRING
    				//    numRecords: NUMERIC       
    				//    expectedRecordCount: NUMERIC 
    				//    dbName: STRING 
    				//    errors: ARRAY     
    				//  }

					// 
					// another table has been processed
					// 
					processedTableCount++; 

					// Increase step completion percentage number_of_processed_tables/total_tables) * 100)
    				// to allow for progress visualization in the UI.
					this.setPercentCompletion( processedTableCount == 0 ? 1 : ((processedTableCount/tables.length)*100).toFixed(1) );

					// locate the first result set
					var tableStats =  _.find( results, function( result ){	
							return (result != null); 
					});

					logger.info('copyFromStripeToCloudantStep.run(): ' + tableStats.numRecords + ' records for table ' + tableStats.tableName +' were copied from stripe to the Cloudant staging database.');
		
					// signal async.map that processing for a specific table has completed; return, if applicable, error information or the execution statistics 
					return callback(null, tableStats); 

				}.bind(this)); // async.series

			}.bind(this), function (err, statsArray) {
			
				// asynch.map callback is invoked after processing for all source objects has completed or if a fatal error ocurred

				// The statsArray results data structure is an array containing one entry for each processed source object (table)
    			//  [{ 
    			//    tableName: STRING
    			//    numRecords: NUMERIC       
    			//    expectedRecordCount: NUMERIC 
    			//    dbName: STRING 
    			//    errors: ARRAY     
    			//   }
    			//   ,...
    			//  ]
				
				logger.debug('copyFromStripeToCloudantStep.run() - aggregating statistics: ' + JSON.stringify(statsArray));	

				// Aggregate record count after async.map has finished and 
    			// determine wether processing of at least one source object resulted in an error
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
					stepStats.status = 'Aborted: ' + err; // fatal processing error
				}else if( hasErrors ){
					// processing of at least one source object ran into an issue
					stepStats.status = 'Completed with one or more errors.';
				}else{
					// processing for all source objects completed without issues
					stepStats.status = 'Completed.';
				}					
			
				logger.info('Copied ' + stepStats.numRecords + ' records from stripe.com to Cloudant staging area.');

				// update step message
				this.setStepMessage('Copied ' + stepStats.numRecords + ' records from stripe.com to Cloudant staging area.');

				return callback( err );

		}.bind(this)); // async.map

	}; // run

	/*
	* Creates an array of functions to be processed sequentially by async.series for the specified table
	*/
	var getProcessTableFunctions = function( logger, table, pipe, pipeRunStats, stripeHandle){
		
		// return array holds the functions which need to be invoked to copy data from the data source to Cloudant 
		var processTableFunctions = []; // return array

		// targetDb provides access to the Simple Data Pipe's storage API (server/storage.js)
		var targetDb = null; 

		// Function 1: create a Cloudant staging database for the source object (table)
		processTableFunctions.push( function( callback ){

			stripeConUtil.createCloudantDbForTable(logger, table, function( err, result){
				// callback function parameters:
            	//   err : error information, if applicable
            	// result: Simple Data Pipe's storage API handle	

				if(err) {
					// Instead of raising a fatal error ('return callback(err)') save the error information. 
					// The storage API handle is not valid, which will cause the next step to skip processing.
					targetDb = null;	

					// embed the error information in the results data structure
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
					// make the Simple Data Pipe's storage API handle available to 
                	// the next function
					targetDb = result; 
				}

            	// notify async.series that processing is complete
            	// (note that we don't return a result because the source object has not been processed yet)
				return callback(null);	
			}); // stripeConUtil.createCloudantDbForTable
		}); // processTableFunctions.push

		
 		// Function 2: copy all data for the source object (table) to Cloudant 
 		//             if the staging database was created successfully
		processTableFunctions.push( function( callback ){

				copyJob.run( logger, table.name, pipe, pipeRunStats, targetDb, stripeHandle, function( err, stats ){
					// callback function parameters:
        			//   err : fatal error information, if applicable
        			//  stats:
        			//          { 
        			//              tableName: STRING               // source object name
        			//              numRecords: NUMERIC             // number of records copied
        			//              expectedRecordCount: NUMERIC    // number of records expected (optional)
        			//              dbName: STRING                  // Cloudant staging database name
        			//              errors: ARRAY                   // if applicable, warning or non-fatal error messages
        			//          }

					if ( err ){
						// there was a fatal errorproblem reading data from stripe or writing data to Cloudant; signal async.series to abort
						return callback( err );
					}
					// Processing  for this table was successful, return stats for this copy operation
					return callback( null, stats );
				});
		});

		return processTableFunctions;
	}; // getProcessTableFunctions

	
} // copyFromStripeToCloudantStep

module.exports = copyFromStripeToCloudantStep;