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

/**
 * 
 *  Sample connector stub. 
 * 
 * 
 */

var connector = require('../connector');
var pipeDb = require('../../pipeStorage');

/**
 * sample connector
 */
function sample( parentDirPath ){
	//Call constructor from super class
	connector.call(this);
	
	// TODO: Assign an internal ID to this connector. This ID is used to
	// uniquely identify pipes for this connector. 
	this.setId('sampleConnector');

	// TODO: Assign a display label to this connector. 
	this.setLabel('Sample data source');
	
	//Set the steps
	this.setSteps([    
		// TODO customize sampleDataCopyStep.js as needed to copy data from your data source to the Cloudant data staging area.
	    new (require('./sampleDataCopyStep.js'))(),	
	    // TODO: add additional processing steps, if needed by adding 		
	    // new (require('path/to/additional_js_file.js'))(),
	    // Do not remove these steps. They copy data from the staging area to dashDB
	    new (require('../../run/cloudantToDashActivitiesStep'))(),  
	    new (require('../../run/activitiesMonitoringStep'))()               
    ]);
	
	/**
	 * authCallback: callback for OAuth authentication protocol
	 * Collects OAuth information from the OAuth server and retrieves list of available 'tables' (stripe objects) that can be moved by the pipe
	 * @param oAuthCode the authenticaion code that was sent by the OAuth server
	 * @param pipeId the pipe for which oAuth and data source information is collected
	 * @param callback(err, pipe ) error information in case of a problem or the updated pipe
	 */
	this.authCallback = function( oAuthCode, pipeId, callback ){
				
		console.log('authCallback('+ oAuthCode + ',' + pipeId +') Entry');
				
		// retrieve pipe from the data store using the unique pipe ID
		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				console.log('authCallback() - exit (lookup error for pipe ' + pipeId + ')');
				return callback( err );
			}

			/************************************************* 
			 The pipe object contains the following mandatory properties:

				{
				  type: "pipe",
				  label: "Sample data source",			        			// see TODO above: this.setLabel('Sample data source');
				  steps: [
				    {
				      label: "Copy data from Sample data source to Cloudant"	// see TODO in ./sampleDataCopyStep.js (this.label = '...';)
				    }
				  ],
				  connectorId: "sampleConnector",			        			// see TODO above: this.setId('sampleConnector');
				  name: "my first pipe",	                        			// pipe name (provided by the user)
				  description: "my first sample connector pipe",  			// pipe description (provided by the user)
				  clientId: "hfvhd76d667hdsjds7sd6sdfsh323jg3g23gj",			// OAuth consumer ID (provided by the user)							
  				  clientSecret: "skjdjdskjshdsdhsuhdsdusdysyuysns2"			// OAuth consumer secret (provided by the user)							
				}

			*/

			// TODO: implement OAuth callback logic, which retrieves the authorization token from the OAuth provider
			var accessToken = 'MySampleAccessToken';
			// ...
			// 

	   		// save the access token for later use
			pipe.oAuth = { accessToken : accessToken };

			// TODO: Implement functionality that returns an array of tables for which data can be copied from the 
			// source. The properties name and labelPlural are mandatory. Other properties can be added if desired.
			pipe.tables = [{name : 'sampletable', labelPlural : 'sampletable', description : 'a virtual sample table'}];

			/************************************************* 
			 The pipe object must now contain the following mandatory properties:

				{
				  type: "pipe",
				  label: "Sample data source",			        			// see TODO above: this.setLabel('Sample data source');
				  steps: [
				    {
				      label: "Copy data from Sample data source to Cloudant"	// see TODO in ./sampleDataCopyStep.js (this.label = '...';)
				    }
				  ],
				  connectorId: "sampleConnector",			        			// see TODO above: this.setId('sampleConnector');
				  name: "my first pipe",	                        			// pipe name (provided by the user)
				  description: "my first sample connector pipe",  			    // pipe description (provided by the user)
				  clientId: "hfvhd76d667hdsjds7sd6sdfsh323jg3g23gj",			// OAuth consumer ID (provided by the user)							
  				  clientSecret: "skjdjdskjshdsdhsuhdsdusdysyuysns2"			    // OAuth consumer secret (provided by the user)								
  				  oAuth : {accessToken : "MySampleAccessToken"},			    // Temporary OAuth access token for the data source
				  tables : [													// tables for which data can be fetched from the data source
				  			{name : 'sampletable', 
				  			 labelPlural : 'sampletable', 
				  			 description : 'a virtual sample table'
				  			},
				  			...
				  		   ]
				}

			*/

			console.log('authCallback() - exit (pipe)');
			
			// TODO: if no errors occurred, return control to the callback, passing along the pipe, which now includes
			// the OAuth access token and the list of tables for which data can be copied.
			// in case of an error invoke callback(err);		
			callback( null, pipe );			

			
		});	// pipeDb.getPipe	
	}; // this.authCallback
	
	/**
	 * This function is invoked after the user has provided an OAuth consumer key and consumer secret.
	 * The main purpose of this function is to contact the OAuth provider and request the OAuth access token.
	 * If the request is approved, the OAuth provider will invoke the pipe's callback and provide the access token (see above). 
	 * @param req
	 * @param res
	 * @param pipeId
	 * @param url: the value of this parameter must be sent to the OAuth provider using the state property.
	 * @param callback(err, results)
	 */
	this.connectDataSource = function( req, res, pipeId, url, callback ){
		
		console.log('connectDataSource(' + pipeId +') - entry');

		// retrieve the pipe object
		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				console.log('connectDataSource() - exit (lookup error for pipe ' + pipeId + ')');
				return callback( err );
			}
			/******************************************************************** 
			 The pipe object contains the following mandatory properties:

				{
				  type: "pipe",
				  label: "Sample data source",			        			// see TODO above: this.setLabel('Sample data source');
				  steps: [
				    {
				      label: "Copy data from Sample data source to Cloudant"	// see TODO in ./sampleDataCopyStep.js (this.label = '...';)
				    }
				  ],
				  connectorId: "sampleConnector",			        			// see TODO above: this.setId('sampleConnector');
				  name: "my first pipe",	                        			// pipe name (provided by the user)
				  description: "my first sample connector pipe",  			// pipe description (provided by the user)
				  clientId: "hfvhd76d667hdsjds7sd6sdfsh323jg3g23gj",			// OAuth consumer ID (provided by the user)							
  				  clientSecret: "skjdjdskjshdsdhsuhdsdusdysyuysns2"			// OAuth consumer secret (provided by the user)					
				}

			*/

			// TODO: call OAuth Provider and request an OAuth token, which we'll need to fetch data from the data source  
			// res.redirect();

			console.log('**** REQ: ' + req);
			console.log('************************************'); 


		}); // pipeDb.getPipe
	}; // connectDataSource
} 

//Extend event Emitter
require('util').inherits(sample, connector);

module.exports = new sample();