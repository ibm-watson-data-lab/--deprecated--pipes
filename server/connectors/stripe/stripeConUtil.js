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

var pipesSDK = require('pipes-sdk');
var cloudant = pipesSDK.cloudant;
var global = require('bluemix-helper-config').global;
var _ = require('lodash');

var connectorMetaInfo = {
							id : 'stripe',
							version : '0.2.0',
							label : 'Stripe'
						};

var getMetaInfo = function() {
	return connectorMetaInfo;
};

/*
* Returns the OAuth configuration information for the specifid stripe 
* @param pipe 
*/
var getOAuthConfig = function (pipe){

	// make sure the parameter identifies a valid stripe pipe 
	if((pipe === null) || (pipe.connectorId !== connectorMetaInfo.id)) {
		return null;
	}

	return {
		 // stripe oAuth endpoint
		 loginUrl: 'https://connect.stripe.com/oauth/authorize',
		 // stripe oAuth endpoint
		 tokenUrl: 'https://connect.stripe.com/oauth/token',
		 // oAuth callback URI 
		 redirectUri: global.getHostUrl() + '/authCallback',
		 // CLIENT_ID: issued by stripe and entered by the user as "consumer key"
		 clientId: pipe.clientId,								
		 // API_KEY: issued by stripe and entered by the user as as "consumer secret"
	     clientSecret: pipe.clientSecret						
	};
}; // getOAuthConfig

/*
* Returns list of stripe tables (object types) that can be retrieved.
* Refer to https://stripe.com/docs/api for details
*/
var getTableList = function() {

	// Note: Stripe provides an API with object type specific methods. Therefore
	// each object type ('table') listed here must be backed by a dedicated stripe 
	// API call in copyJob.js
	// Not yet supported because multiple fetches may be required to retrieve the information: 
	//   - card (requires customer ID)
	//   - subscription (requires customer ID)
	//   - transfer_reversal (requires transfer ID)
	//   - fee_refund (requires application fee ID)
	// Intentionally not supported:
	//   - token (no list API call) 
	//
	return([{name : 'account', labelPlural : 'account', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'application_fee', labelPlural : 'application_fee', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'balance_transaction', labelPlural : 'balance_transaction', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'bitcoin_receiver', labelPlural : 'bitcoin_receiver', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'charge', labelPlural : 'charge', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'customer', labelPlural : 'customer', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'coupon', labelPlural : 'coupon', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'dispute', labelPlural : 'dispute', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'event', labelPlural : 'event', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'invoice', labelPlural : 'invoice', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'invoiceitem', labelPlural : 'invoiceitem', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'plan', labelPlural : 'plan', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'recipient', labelPlural : 'recipient', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'refund', labelPlural : 'refund', description : 'See https://stripe.com/docs/api#intro for details'},
			{name : 'transfer', labelPlural : 'transfer', description : 'See https://stripe.com/docs/api#intro for details'}
    ]);

}; // getTableList

/*
* Returns the database name for the specified stripe object type (aka table)
*/
var getCloudantDatabaseName = function(tableName) {
	return 'st_' + tableName.toLowerCase(); 
}; // getCloudantDatabaseName

/*
*   
*/
	var genViewsManager = function(table){
		var tables = table || this.getPipeRunner().getSourceTables();
		if ( !_.isArray( tables ) ){
			tables = [tables];
		}
		var viewsManager = [];
		_.forEach( tables, function( table ){
			var manager = new cloudant.views( '_design/' + table.name );
			manager.addView(
					table.labelPlural || table.label || table.name,
					JSON.parse('{'+
							'"map": "function(doc){' +
							'if ( doc.object === \'' + table.name + '\'){' +
							'emit( doc._id, {\'_id\': doc._id, \'rev\': doc._rev } );' +
							'}' +
							'}"' +
							'}'
					), 2 //Version
			);
			viewsManager.push( manager );
		});
		return viewsManager;

	}.bind( this );

	var createCloudantDbForTable = function( logger, table, callback ){
		//One database per table, create it now
		var dbName = getCloudantDatabaseName(table.name);

		var targetDb = new cloudant.db(dbName, genViewsManager( table ));
		var ready = null;
		targetDb.on( 'cloudant_ready', ready = function(){
			logger.info('Data Pipe Configuration database (' + dbName + ') ready');
			logger.info('Delete all documents for table %s in database %s', table.name, dbName);
			//Remove listener to avoid using the callback again in case we have downstream errors
			targetDb.removeListener('cloudant_ready', ready );
			var called = false;
			targetDb.destroyAndRecreate( function( err ){
				if ( called ){
					return;
				}
				called = true;
				if ( err ){
					logger.error('Unable to recreate db : ' + err );
					return callback(err);
				}
				return callback( null, targetDb);
			});
		});

		targetDb.on('cloudant_error', function(){
			var message = 'Fatal error from Cloudant database: unable to initialize ' + dbName;
			logger.error( message );
			return callback( message );
		});
	};

// exports
module.exports.getMetaInfo = getMetaInfo;
module.exports.getOAuthConfig = getOAuthConfig;
module.exports.getTableList = getTableList;
module.exports.getCloudantDatabaseName = getCloudantDatabaseName;
module.exports.createCloudantDbForTable = createCloudantDbForTable;
