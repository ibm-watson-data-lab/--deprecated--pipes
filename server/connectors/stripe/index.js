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
var stripeConn = require('./stripeConUtil.js');

/**
 * stripe connector
 */
function stripe( parentDirPath ){
	//Call constructor from super class
	connector.call(this);
	
	//Set the id
	this.setId('stripe');
	this.setLabel('Stripe');
	
	//Set the steps
	this.setSteps([      
	    new (require('./copyFromStripeToCloudantStep.js'))(),			// copy data from stripe to cloudant staging databases
	    new (require('../../run/cloudantToDashActivitiesStep'))(),
	    new (require('../../run/activitiesMonitoringStep'))()               
    ]);
	
	/**
	 * authCallback: callback for OAuth authentication protocol
	 * Collects OAuth information from the OAuth server and retrieves list of available 'tables' (stripe objects) that can be moved by the pipe
	 * @param oAuthCode the authenticaion code that was sent by the OAuth server
	 * @param pipeId the pipe for which oAuth and data source information is collected
	 * @param callback(err, pipe )
	 */
	this.authCallback = function( oAuthCode, pipeId, callback ){
				
		console.log('authCallback('+ oAuthCode + ',' + pipeId +') Entry');
				
		// retrieve pipe from the data store
		// TODO do we need to specify third input parm (noFilterForOutbound) ?
		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				console.log('connectDataSource() - exit (lookup error for pipe ' + pipeId + ')');
				return callback( err );
			}

			var oAuthConfig = stripeConn.getOAuthConfig(pipe);

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
	    			console.log('authCallback() - FFDC: ' + JSON.stringify(authTokenRequest));
	    			console.log('authCallback() - exit (access token request error)');
					return(callback(err, null));
	    		}

		        var accessToken = JSON.parse(body).access_token;
	
	    		// save the code (should we save the token instead?)
				// TODO refreshToken?
				pipe.oAuth = { accessToken : accessToken };

				// determine which stripe object types can be retrieved
				pipe.tables = stripeConn.getTableList();

				console.log('authCallback() - exit (pipe)');
				callback( null, pipe );			
			});
		});		
	};
	
	/**
	 * connectDataSource: connect to the backend data source
	 * @param req
	 * @param res
	 * @param pipeId
	 * @param url: login url
	 * @param callback(err, results)
	 */
	this.connectDataSource = function( req, res, pipeId, url, callback ){
		
		console.log('connectDataSource(' + pipeId +') - entry');

		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				console.log('connectDataSource() - exit (lookup error for pipe ' + pipeId + ')');
				return callback( err );
			}

			var oAuthConfig = stripeConn.getOAuthConfig(pipe);

			console.log('connectDataSource() - FFDC: ' + oAuthConfig.loginUrl + '?' + qs.stringify({response_type: 'code',
																   scope: 'read_only',
																   stripe_landing : 'login',
	       														   client_id: oAuthConfig.clientId,
																   state: JSON.stringify( {pipe: pipe._id, url: url })}));	

			// send request for an access code to stripe.com (the response will be processed by authCallback above)
			res.redirect(oAuthConfig.loginUrl + '?' + qs.stringify({response_type: 'code',
														  				 scope: 'read_only',
														  				 stripe_landing : 'login',
														  				 client_id: oAuthConfig.clientId,
														  				 state: JSON.stringify( {pipe: pipe._id, url: url })})); 


		}); // pipeDb.getPipe
	}; // connectDataSource
} 

//Extend event Emitter
require('util').inherits(stripe, connector);

module.exports = new stripe();