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
 * CDS Labs module
 * 
 *   Connector implementation for stripe.com
 * 
 * 
 */

var connector = require('../connector');
var pipeDb = require('../../pipeStorage');
var qs = require('querystring');
var request = require('request');
var stripeConUtil = require('./stripeConUtil.js');

/**
 * stripe connector
 */
function stripe( parentDirPath ){
	//Call constructor from super class
	connector.call(this);
	
	//Set the id
	this.setId(stripeConUtil.getMetaInfo().id);
	this.setLabel(stripeConUtil.getMetaInfo().label);
	
	//Set the steps
	this.setSteps([      
	    new (require('./copyFromStripeToCloudantStep.js'))(),			// copy data from stripe to cloudant staging databases
	    new (require('../../run/cloudantToDashActivitiesStep'))(),
	    new (require('../../run/activitiesMonitoringStep'))()               
    ]);
	
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

		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return callback( err );
			}

			var oAuthConfig = stripeConUtil.getOAuthConfig(pipe);

			// send request for an access code to stripe.com (the response will be processed by authCallback above)
			res.redirect(oAuthConfig.loginUrl + '?' + qs.stringify({response_type: 'code',
														  				 scope: 'read_only',
														  				 stripe_landing : 'login',
														  				 client_id: oAuthConfig.clientId,
														  				 redirect_uri : oAuthConfig.redirectUri,
														  				 state: JSON.stringify( {pipe: pipe._id, url: url })})); 


		}); // pipeDb.getPipe
	}; // connectDataSource

	/**
	 * authCallback: callback for OAuth authentication protocol
	 * Collects OAuth information from the OAuth server and retrieves list of available 'tables' (stripe objects) that can be moved by the pipe
	 * @param oAuthCode the authenticaion code that was sent by the OAuth server
	 * @param pipeId the pipe for which oAuth and data source information is collected
	 * @param callback(err, pipe ) error information in case of a problem or the updated pipe
	 */
	this.authCallback = function( oAuthCode, pipeId, callback ){
				
		// retrieve pipe from the data store
		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return callback( err );
			}

			var oAuthConfig = stripeConUtil.getOAuthConfig(pipe);

			// request an access token from the stripe.com OAuth provider
            var authTokenRequest = {
	    			url: oAuthConfig.tokenUrl,
	    			form: {
	      				grant_type: 'authorization_code',
	      				client_id: oAuthConfig.clientId,             // CLIENT_ID (in stripe lingo)
	      				code: oAuthCode,							 // this code was requested in connectDataSource
	      				client_secret: oAuthConfig.clientSecret      // API_KEY (in stripe lingo)
	      			}
	    		};

			// request an access token	
		    request.post(authTokenRequest, function(err, response, body) {

	    		if(err) {
					return(callback(err, null));
	    		}

	    		err = JSON.parse(body).error_description;

	    		if(err) {
					return(callback(err, null));	
		    	}

		        var accessToken = JSON.parse(body).access_token;
	
	    		// save the code (should we save the token instead?)
				pipe.oAuth = { accessToken : accessToken };

				// determine which stripe object types can be retrieved
				pipe.tables = stripeConUtil.getTableList();

				// store connector metadata
				pipe.connector = { 'id' : stripeConUtil.getMetaInfo().id, 'version' : stripeConUtil.getMetaInfo().version};

				console.log('authCallback() - exit (pipe)');
				callback( null, pipe );			
			});
		});		
	};
	
} // stripe

//Extend event Emitter
require('util').inherits(stripe, connector);

module.exports = new stripe();