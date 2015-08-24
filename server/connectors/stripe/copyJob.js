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

// var cloudant = require('../../storage');
var stripeConUtil = require('./stripeConUtil.js');

//function run(that, tableName, dbHandle, stripeHandle) {
function run(logger, tableName, pipe, pipeRunStats, dbHandle, stripeHandle, callback) {
	
	logger.trace('copyJob.run() - Entry');

	var cloudantDB = dbHandle;
	var stripe = stripeHandle;

	var bulkSavesPendingCount = 0;
	var lastFetchSubmitted = false;

	// runstats for this table (this information is persisted in a run document in cloudant)
	var stats = {
			tableName : tableName,			// table name
			numRecords: 0,					// total number of records written to Cloudant
			dbName : stripeConUtil.getCloudantDatabaseName(tableName),
			errors: []						// list of errors
	};

	// save initial runstats for this table	
	pipeRunStats.addTableStats(stats);

	/*
	 * Invoked if an error occurred while an attempt was made to fetch data from stripe.
	 * @param err a stripe error object 
	 */
	var processStripeRetrievalErrors = function (err) {

		logger.error('A fatal error occurred while trying to retrieve data from stripe.com');
		logger.error('Error message: ' + err.message);
		logger.error('Error type: ' + err.type);
		logger.error('Error raw type: ' + err.rawType);
		logger.error('Error code: ' +err. code);
		logger.error('Error parameters: ' + err.param);
		logger.error('Error detail: ' + err.detail);
		
		// save error information
		stats.errors.push(err);
		pipeRunStats.addTableStats(stats);

		// Invoke the callback the copyFromStripeToCloudantStep.run() method. By returning an error processing for this tabe will be aborted.
		return callback(err);

	}; // processStripeRetrievalErrors

	/*
	 *
	 */
	var saveStripeObjectListInCloudant = function (objectList) {

		logger.trace('copyJob.saveStripeObjectListInCloudant() - Entry: ' + objectList.data.length + ' records need to be persisted.');

		// don't proceed if no data was fetched
		if(objectList.data.length === 0)  {
			bulkSavesPendingCount--;
			if(bulkSavesPendingCount < 1) {
				// there is no more data that needs to be processed; signal to the parent (copyFromStripeToCloudantStep.run) that the job is done
				logger.debug('copyJob.saveStripeObjectListInCloudant() No more data needs to be saved.');
				return callback(null, stats);
			}
			else {
				// nothing to do for this save operation but others are still pending; return to caller
				return;
			}
		}
	
		var jsonDoc = {docs: objectList.data}; 

		// use the storage utility funtion to perform the bulk insert
		cloudantDB.run(function(err, db) {
			if(err) {
				// signal to the parent (copyFromStripeToCloudantStep.run) that an error was encountered during processing 
				return callback(err);
			}
			// bulk insert (100 rows max)
			db.bulk(
					jsonDoc, 
					function(err, body, header){
						if(err) {
							// signal to the parent (copyFromStripeToCloudantStep.run) that an error was encountered during processing 
							stats.errors.push(err);
							return callback(err);
						}
						else {
							logger.debug('saveStripeObjectListInCloudant(): Inserted ' + objectList.data.length + ' objects into the ' + objectList.data[0].object + ' database');
							// update the statistics
							stats.numRecords = stats.numRecords + objectList.data.length;
							pipeRunStats.addTableStats(stats);

							// decrease the number of pending bulk save operations
							bulkSavesPendingCount--;
							if((lastFetchSubmitted)&&(bulkSavesPendingCount < 1)) {
								// there is no more data that needs to be processed; signal to the parent (copyFromStripeToCloudantStep.run) that the job is done
								return callback(null, stats);
							}
						}
					});	
		});

		logger.trace('copyJob.saveStripeObjectListInCloudant() - Exit');

	}; // saveStripeObjectListInCloudant 

	/*
	* Save a batch of records and fetch next batch, if available.
	* @param objectList data structure {has_more: <boolean>, data:[<object> , ... , <object> ]}, with <object> defined as {id : <idenitfier>, object : <objectType>, ...}
	*/
	var processStripeObjectList = function(objectList) {

		logger.trace('copyJob.processStripeObjectList() - Entry: ' + objectList.data.length + ' records need to be persisted.');

		logger.debug('copyJob.processStripeObjectList() ' + JSON.stringify(objectList));
		
		if(objectList.has_more === false) {
			// There are no more fetch operations pending at this point. 
			lastFetchSubmitted = true;
		} 

		// save the list of objects in Cloudant
		bulkSavesPendingCount++;
		saveStripeObjectListInCloudant(objectList);
		
		// if there's more data to fetch ...
		if(! lastFetchSubmitted) {	

			// retrieve the OAuth access token, which grants us read-only access to the customer's data 
			var accessToken = pipe.oAuth.accessToken;

			var promise; // returned by stripe.[object].list (all calls are asynchronous)
			
			switch (tableName) {		
			 case 'account':
			 	 // retrieve list of accounts (a maximum of 100 records will be returned by stripe, starting with the record follow the last one that was retrieved)
			 	 // if no problem was encountered, method processStripeObjectList is invoked, method processStripeRetrievalErrors otherwise
				 promise = stripe.acounts.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	
			 case 'application_fee':
				 // provide number of objects to be returned and the offset
				 promise = stripe.applicationFees.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'balance_transaction':
				 // provide number of objects to be returned and the offset
				 promise = stripe.balance.listTransactions({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;		 
			 case 'charge':
				 // provide number of objects to be returned and the offset
				 promise = stripe.charges.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'coupon':
				 // provide number of objects to be returned and the offset
				 promise = stripe.coupons.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'customer':
				 // provide number of objects to be returned and the offset
				 promise = stripe.customers.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'dispute':
				 // provide number of objects to be returned and the offset
				 promise = stripe.disputes.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;		
			 case 'event':
				 // provide number of objects to be returned and the offset
				 promise = stripe.events.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;			 
			 case 'invoice':
				 // provide number of objects to be returned and the offset
				 promise = stripe.invoices.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	 
			 case 'invoiceitem':
				 // provide number of objects to be returned and the offset
				 promise = stripe.invoiceItems.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	 		 
			 case 'plan':
				 // provide number of objects to be returned and the offset
				 promise = stripe.plans.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;
			 case 'recipient':
				 // provide number of objects to be returned and the offset
				 promise = stripe.recipients.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;	
			 case 'transfer':
				 // provide number of objects to be returned and the offset
				 promise = stripe.transfers.list({ limit:100,'starting_after' : objectList.data[objectList.data.length - 1].id}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
				 break;			 		
			 default:
		 	 	// unrecoverable error - a request was made to fetch data for an object type that is currently not supported
			 	logger.error('copyJob.transferStripeObjectListToCloudant(): Data copy for stripe objects of type ' + tableName + ' is not supported.');
			 	return callback('Data copy for stripe objects of type ' + tableName + ' is not supported.');
			}

		} 

		logger.trace('copyJob.processStripeObjectList() - Exit');

	}; // processStripeObjectList

	/*
	 * Fetch the first batch of records from stripe. This method is only called once
	 *
	 */
	var copyStripeObjectsToCloudant = function() {

		logger.trace('copyJob.copyStripeObjectsToCloudant() processing object type: ' + tableName);

		// retrieve the OAuth access token, which grants us read-only access to the customer's data 
		var accessToken = pipe.oAuth.accessToken;
	
		var promise; // from stripe.[object].list
		
		switch (tableName) {
		 case 'account':
			 // retrieve list of accounts (a maximum of 100 records will be returned by stripe)
			 // if no problem was encountered, method processStripeObjectList is invoked, method processStripeRetrievalErrors otherwise
			 // stripe.*.list API calls are asynchronous
			 promise = stripe.accounts.list({ limit:100}, accessToken).then(processStripeObjectList , processStripeRetrievalErrors);
			 break;	
		 case 'application_fee':
			 // see above
			 promise = stripe.applicationFees.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'balance_transaction':
			 // see above
			 promise = stripe.balance.listTransactions({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;		 
		case 'bank_account':
			 // see above
			 promise = stripe.accounts.listExternalAccounts({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'charge':
			 // see above
			 promise = stripe.charges.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'coupon':
			 // see above
			 promise = stripe.coupons.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'customer':
			 // see above
			 promise = stripe.customers.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'dispute':
			 // see above
			 promise = stripe.disputes.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;		
		 case 'event':
			 // see above
			 promise = stripe.events.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;			 
		 case 'invoice':
			 // see above
			 promise = stripe.invoices.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;	 
		 case 'invoiceitem':
			 // see above
			 promise = stripe.invoiceItems.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;	 		 
		 case 'plan':
			 // see above
			 promise = stripe.plans.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;
		 case 'recipient':
			 // see above
			 promise = stripe.recipients.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;	
		 case 'transfer':
			 // see above
			 promise = stripe.transfers.list({ limit:100}, accessToken).then(processStripeObjectList, processStripeRetrievalErrors);
			 break;			 
		 default:
		 	 // unrecoverable error - a request was made to fetch data for an object type that is currently not supported
			 logger.error('copyJob.transferStripeObjectListToCloudant(): Data copy for stripe objects of type ' + tableName + ' is not supported.');
			 return callback('Data copy for stripe objects of type ' + tableName + ' is not supported.');
		}

		logger.trace('copyJob.copyStripeObjectsToCloudant() - Exit');	

	}; // copyStripeObjectsToCloudant

 // start the data copy
 copyStripeObjectsToCloudant();

} // run

module.exports.run = run; 
