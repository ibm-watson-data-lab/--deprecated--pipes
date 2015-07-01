'use strict';

/**
*	Endpoints for managing data pipe connections 
*	@Author: David Taieb
*/

var pipeDb = require( './connectionStorage');
var misc = require('./misc');

module.exports = function( app ){
	
	/**
	 * Get list of existing data pipe connections
	 */
	app.get('/connections', function(req, res) {
		pipeDb.listConnections( function( err, connections ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			return res.json( connections );
		});
	});
	
	function validateConnectionPayload( connection ){
		var requiredFields = ['name', 'loginUrl', 'useOAuth', 'clientId', 'clientSecret'];
		
		requiredFields.forEach( function( field ){
			if ( !connection.hasOwnProperty( field ) ){
				throw new Error("Missing field " + field);
			}
		});
	}
	
	/**
	 * Create a new data pipe Connection
	 */
	app.post('/connections', function(req, res ){
		var connection = req.body;
		try{
			validateConnectionPayload( connection );
		}catch( e ){
			return misc.jsonError( res, e );
		}
		pipeDb.saveConnection( connection, function( err, connection ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			console.log("Connection successfully saved: " + JSON.stringify( connection) );
			res.json( connection );
		});
	});
	
	/**
	 * Delete
	 */
	app.delete('/connections/:id', function( req, res ){
		pipeDb.removeConnection( req.params.id, function( err, connection ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			console.log( "Connection successfully removed : " + JSON.stringify( connection ) );
			res.json( connection );
		});
	})
};
