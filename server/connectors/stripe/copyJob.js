//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

var stripeConUtil = require('./stripeConUtil.js');
var _ = require('lodash');

/*
 * @param logger an instance of the pipe run logger
 * @param tableName name of the source object (table) that is processed during this run
 * @param pipe stripe data pipe (configuration)
 * @param pipeRunStats 
 * @param storageHandle storage manager handle for the associated Cloudant staging database
 * @param stripe stripe API handle, which is associated with the pipe's oAuth credentials
 */
function run(logger, tableName, pipe, pipeRunStats, storageHandle, stripe, callback) {
	
	logger.trace('copyJob.run(' + tableName + ') - Entry');

	var bulkSavesPendingCount = 0;	// if non-zero, indicates that data still needs to be saved to the staging database
	var lastFetchSubmitted = false;	// indicates whether additional records need to be fetched
	var maxBatchSize = 100;			// defines how many records will be fetched from stripe; max supported is 100

	var subscriptionHasMoreCount = 0; // indicates the total number of incomplete fetches for subscriptions; used only if tableName == 'customer'
	var sourceHasMoreCount = 0;		  // indicates the total number of incomplete fetches for payment sourcess; used only if tableName == 'customer'	

	// initialize data copy statistics 
	var stats = {
			tableName : tableName,			// table name
			numRecords: 0,					// total number of records written to Cloudant
			expectedRecordCount: 0,			// expected number of records to be written to Cloudant
			dbName : stripeConUtil.getCloudantDatabaseName(tableName),
			errors: []						// non fatal errors or warnings, if applicable
	};

	if(!storageHandle) {
		stats.errors.push({message : 'The staging database is unavailable. No data was copied to dashDB.'});
		pipeRunStats.addTableStats(stats);
		return callback(null, stats);	// nothing to do. the staging database is not available
	}
	else {
		// save initial runstats for this table	
		pipeRunStats.addTableStats(stats);
	}

	/*
	 * Logs a warning message, if it was detected that not all subscriptions or payment sources were copied for at least one customer. 
	 */
	var issueTruncationWarning = function() {

		if(tableName != 'customer') {
			return; // no truncation can occur for stripe objects pther than customer
		}

		var messageText = '';		

		if(subscriptionHasMoreCount > 0) {
			// subscriptionHasMoreCount customers hold more subscriptions than were fetched
			messageText = 'Only 10 subscriptions were copied for ' + subscriptionHasMoreCount + ' customer(s). ';
		}		
		if(sourceHasMoreCount > 0) {
			// sourceHasMoreCount customers have more payment sources than were fetched
			messageText += 'Only 10 payment sources were copied for ' + sourceHasMoreCount + ' customer(s).';			
		}		

		if(messageText.length > 0) {
				logger.warn(messageText);
				stats.errors.push({message: messageText});
				pipeRunStats.addTableStats(stats);
		}

	}; // issueTruncationWarning

	/*
	 * Invoked if an error occurred while an attempt was made to fetch data from stripe.
	 * @param err an error object, which must include the mandatory message property 
	 */
	var processStripeRetrievalErrors = function (err) {

		logger.trace('copyJob.processStripeRetrievalErrors() - Entry');

		logger.error('A fatal error occurred while trying to retrieve data from stripe.com');

		// message property is mandatory
		logger.error('Error message: ' + err.message);
		
		if(err.hasOwnProperty('type')) {
			logger.error('Error type: ' + err.type);
		}
		if(err.hasOwnProperty('rawType')) {
			logger.error('Error raw type: ' + err.rawType);
		}
		if(err.hasOwnProperty('code')) {
			logger.error('Error code: ' +err.code);
		}
		if(err.hasOwnProperty('param')) {
			logger.error('Error parameters: ' + err.param);
		}
		if(err.hasOwnProperty('detail')) {
			logger.error('Error detail: ' + err.detail);
		}

		// save error information
		stats.errors.push(err);
		pipeRunStats.addTableStats(stats);

		if(bulkSavesPendingCount < 1) {
			// there is no more data that needs to be processed; signal to the parent (copyFromStripeToCloudantStep.run) that the job is done
			logger.debug('processStripeRetrievalErrors() - Aborting. The are no more pending document save operations: ' + JSON.stringify(stats));
			return callback(null, stats); 
		}

		// Do not invoke the callback from the copyFromStripeToCloudantStep.run() method with err set. It would cause all processing to be aborted.
		// return callback(err);

		logger.trace('copyJob.processStripeRetrievalErrors() - Exit');

	}; // processStripeRetrievalErrors

	/*
	 * @param objectList result set returned by Stripe in response to a fetch request
	 */
	var saveStripeObjectListInCloudant = function (objectList) {

		// objectLists contains a "data" property (an array), which contains the records
		// that were returned in response to the API call identified by the "url" property 

		logger.trace('copyJob.saveStripeObjectListInCloudant('+ objectList.url + ') - Entry');
		logger.debug('saveStripeObjectListInCloudant fetch list FFDC: src_url:' + objectList.url + ' data_count:' + objectList.data.length);

		// don't proceed if no data was fetched
		if(objectList.data.length === 0)  {
			bulkSavesPendingCount--;
			if(bulkSavesPendingCount < 1) {
				// there is no more data that needs to be processed; signal to the parent (copyFromStripeToCloudantStep.run) that the job is done
				if(stats.expectedRecordCount !== stats.numRecords) {
					logger.warn('Records available from ' + objectList.url + ' (' + stats.numRecords + ') does not match saved record count (' + stats.numRecords + ').');
				}

				issueTruncationWarning(); // customer object only

				// processing is complete. all data has been copied. return control to the caller	
				return callback(null, stats);
			}
			else {
				// nothing to do for this save operation but others are still pending; return to caller
				return;
			}
		}
	
		// assemble the bulk-save document
		var jsonDoc = {docs: objectList.data}; 

		// storageHandle is an instance of server/storage.js, which was created by stripeConUtil.createCloudantDbForTable.
		// Its run method provides a handle for the staging database that was assigned to tableName.
		storageHandle.run(function(err, db) {

			// the callback function returns an error if a problem was encountered or
    		// a handle to the cloudant staging database (Refer to https://github.com/cloudant/nodejs-cloudant)

			if(err) {
				logger.error('saveStripeObjectListInCloudant() - Cloudant returned error ' + err + ' in response to a connection request.'); 
				// save error information
				stats.errors.push(err);
				pipeRunStats.addTableStats(stats);
				// treat this as a non-fatal error; abort processing
				return callback(null, stats);
			}
			// bulk insert (maxBatchSize rows max)
			db.bulk(
					jsonDoc, 
					function(err, body, header){
						if(err) {
							// signal to the parent (copyFromStripeToCloudantStep.run) that an error was encountered during processing 
							logger.error('saveStripeObjectListInCloudant() - Cloudant returned error ' + err + ' while storing data fetched from ' + objectList.url + '. Processing aborted.'); 
							stats.errors.push(err);
							// treat this as a non-fatal error; abort processing
							return callback(null, stats);
						}
						else {
							logger.debug('saveStripeObjectListInCloudant(): Saved ' + objectList.data.length + ' documents fetched from ' + objectList.url);
							
							// update numRecords to reflect the number of records that were stored in the staging database
							stats.numRecords = stats.numRecords + objectList.data.length;

							// update the statistics
							pipeRunStats.addTableStats(stats);

							// decrease the number of pending bulk save operations
							bulkSavesPendingCount--;

							// consistency checking for customer object, which is a compound object
							if(tableName == 'customer') {
								/*
									 For each customer in this list check whether there are 
									 subscriptions or payment sources that were not fetched by default.
								*/
								_.forEach(objectList.data, function(customer) {
										if((customer.subscriptions.hasOwnProperty('has_more')) && (customer.subscriptions.has_more)) {
											subscriptionHasMoreCount++;											
										}
										if((customer.sources.hasOwnProperty('has_more')) && (customer.sources.has_more)) {
											sourceHasMoreCount++;											
										}
								});	
							}


							if((lastFetchSubmitted)&&(bulkSavesPendingCount < 1)) {
								// there is no more data that needs to be processed; signal to the parent (copyFromStripeToCloudantStep.run) that the job is done
								if(stats.expectedRecordCount !== stats.numRecords) {
									logger.warn('Records available from ' + objectList.url + ' (' + stats.numRecords + ') does not match saved record count (' + stats.numRecords + ').');
								}

								issueTruncationWarning(); // customer objects only

								// processing is complete. all data has been copied. return control to the caller	
								return callback(null, stats);
							}
						}
					});	
		});

		logger.trace('copyJob.saveStripeObjectListInCloudant('+ objectList.url + ') - Exit');

	}; // saveStripeObjectListInCloudant 

	/*
	* Save a batch of records and fetch next batch, if available.
	* @param objectList data structure {has_more: <boolean>, data:[<object> , ... , <object> ]}, with <object> defined as {id : <identifier>, object : <objectType>, ...}
	*/
	var processStripeObjectList = function(objectList) {

		logger.trace('copyJob.processStripeObjectList('+ objectList.url + ') - Entry');
		logger.debug('processStripeObjectList fetch list FFDC: src_url:' + objectList.url + ' data_count:' + objectList.data.length + ' has_more:' + objectList.has_more);
		
		if(objectList.hasOwnProperty('total_count')) {
			// this property is only retrieved by the first fetch operation and indicates the total number of available records
			logger.info('A total of ' + objectList.total_count + ' records will be retrieved from ' + objectList.url);
			stats.expectedRecordCount = objectList.total_count;
			pipeRunStats.addTableStats(stats);
		}

		if(! objectList.has_more) {
			// There are no more fetch operations pending at this point. 
			lastFetchSubmitted = true;
		} 

		// save the list of objects in Cloudant
		bulkSavesPendingCount++;
		saveStripeObjectListInCloudant(objectList);
		
		// if there's more data to fetch ...
		if(objectList.has_more) {	

			// retrieve the OAuth access token, which grants us read-only access to the customer's data 
			var accessToken = pipe.oAuth.accessToken;

			logger.debug('copyJob.processStripeObjectList() - fetching more records using API call ' + objectList.url + ' and offset "' + objectList.data[objectList.data.length - 1].id + '". Batch size: ' + maxBatchSize);

			var promise; // returned by stripe.[object].list (all calls are asynchronous)
			
			switch (tableName) {		
			 case 'account':
			 	 // retrieve list of accounts (a maximum of maxBatchSize records will be returned by stripe, starting with the record follow the last one that was retrieved)
			 	 // if no problem was encountered, method processStripeObjectList is invoked, method processStripeRetrievalErrors otherwise
				 promise = stripe.acounts.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	
			 case 'application_fee':
				 // provide number of objects to be returned and the offset
				 promise = stripe.applicationFees.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'balance_transaction':
				 // provide number of objects to be returned and the offset
				 promise = stripe.balance.listTransactions({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	
			case 'bitcoin_receiver':
			 	 // provide number of objects to be returned and the offset
				 promise = stripe.bitcoinReceivers.list({ limit:maxBatchSize, 'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 	 break;				 	 
			 case 'charge':
				 // provide number of objects to be returned and the offset
				 promise = stripe.charges.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'coupon':
				 // provide number of objects to be returned and the offset
				 promise = stripe.coupons.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'customer':
				 // provide number of objects to be returned and the offset
				 promise = stripe.customers.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'dispute':
				 // provide number of objects to be returned and the offset
				 promise = stripe.disputes.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;		
			 case 'event':
				 // provide number of objects to be returned and the offset
				 promise = stripe.events.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;			 
			 case 'invoice':
				 // provide number of objects to be returned and the offset
				 promise = stripe.invoices.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	 
			 case 'invoiceitem':
				 // provide number of objects to be returned and the offset
				 promise = stripe.invoiceItems.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	 		 
			 case 'plan':
				 // provide number of objects to be returned and the offset
				 promise = stripe.plans.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'recipient':
				 // provide number of objects to be returned and the offset
				 promise = stripe.recipients.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	
			 case 'refund':
				 // provide number of objects to be returned and the offset
				 promise = stripe.refunds.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;					 
			 case 'transfer':
				 // provide number of objects to be returned and the offset
				 promise = stripe.transfers.list({ limit:maxBatchSize,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;			 		
			 default:
		 	 	// unrecoverable error - a request was made to fetch data for an object type that is currently not supported
				logger.error('copyJob.transferStripeObjectListToCloudant(): Data copy for stripe objects of type ' + tableName + ' is not supported.');
				processStripeRetrievalErrors({
					message : 'Data copy for stripe objects of type ' + tableName + ' is not supported.',
					detail : 'Reported by processStripeObjectList'
				});

			}
		} 

		logger.trace('copyJob.processStripeObjectList('+ objectList.url + ') - Exit');

	}; // processStripeObjectList

	/*
	 * Fetch the first batch of records from stripe. This method is only called once. As part of this request, the total number of records is requested
	 * which represents stats.expectedRecordCount.
	 *
	 */
	var copyStripeObjectsToCloudant = function() {

		logger.trace('copyJob.copyStripeObjectsToCloudant() processing object type: ' + tableName);

		logger.debug('copyJob.copyStripeObjectsToCloudant() - fetching initial batch of records for ' + tableName + ' Batch size: ' + maxBatchSize);

		// retrieve the OAuth access token, which grants us read-only access to the customer's data 
		var accessToken = pipe.oAuth.accessToken;
		var promise; // from stripe.[object].list
		
		switch (tableName) {
		 case 'account':
			 // retrieve list of accounts (a maximum of maxBatchSize records will be returned by stripe)
			 // if no problem was encountered, method processStripeObjectList is invoked, method processStripeRetrievalErrors otherwise
			 // stripe.*.list API calls are asynchronous
			 promise = stripe.accounts.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList , processStripeRetrievalErrors);
			 break;	
		 case 'application_fee':
			 // see above
			 promise = stripe.applicationFees.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'balance_transaction':
			 // see above
			 promise = stripe.balance.listTransactions({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;		 
		case 'bitcoin_receiver':
			 // see above
			 promise = stripe.bitcoinReceivers.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;		 
		 case 'charge':
			 // see above
			 promise = stripe.charges.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'coupon':
			 // see above
			 promise = stripe.coupons.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'customer':
			 // see above
			 promise = stripe.customers.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'dispute':
			 // see above
			 promise = stripe.disputes.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;		
		 case 'event':
			 // see above
			 promise = stripe.events.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;			 
		 case 'invoice':
			 // see above
			 promise = stripe.invoices.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;	 
		 case 'invoiceitem':
			 // see above
			 promise = stripe.invoiceItems.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;	 		 
		 case 'plan':
			 // see above
			 promise = stripe.plans.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'recipient':
			 // see above
			 promise = stripe.recipients.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;	
		 case 'refund':
			 // see above
			 promise = stripe.refunds.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;				 
		 case 'transfer':
			 // see above
			 promise = stripe.transfers.list({ limit:maxBatchSize,'include[]':'total_count'}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;			 
		default:
		 	// unrecoverable error - a request was made to fetch data for an object type that is currently not supported
			logger.error('copyJob.transferStripeObjectListToCloudant(): Data copy for stripe objects of type ' + tableName + ' is not supported.');

			processStripeRetrievalErrors({
					message : 'Data copy for stripe objects of type ' + tableName + ' is not supported.',
					detail : 'Reported by copyStripeObjectsToCloudant'
			});

		}

		logger.trace('copyJob.copyStripeObjectsToCloudant(' + tableName + ') - Exit');	

	}; // copyStripeObjectsToCloudant

 // start data copy for the selected table
 copyStripeObjectsToCloudant();

 logger.trace('copyJob.run(' + tableName + ') - Exit');

} // run

module.exports.run = run; 
