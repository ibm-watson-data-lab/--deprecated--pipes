'use strict';

/**
*	Endpoints for managing data pipes
*	@Author: David Taieb
*/

var pipeDb = require( './pipeStorage');
var misc = require('./misc');

module.exports = function( app ){
	
	/**
	 * Get list of existing data pipes
	 */
	app.get('/pipes', function(req, res) {
		pipeDb.listPipes( function( err, pipes ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			return res.json( pipes );
		});
	});
	
	function validatePipePayload( pipe ){
		var requiredFields = ['name', 'loginUrl', 'clientId', 'clientSecret'];
		
		requiredFields.forEach( function( field ){
			if ( !pipe.hasOwnProperty( field ) ){
				throw new Error("Missing field " + field);
			}
		});
	}
	
	/**
	 * Create/Save a data pipe
	 */
	app.post('/pipes', function(req, res ){
		var pipe = req.body;
		try{
			validatePipePayload( pipe );
		}catch( e ){
			return misc.jsonError( res, e );
		}
		pipeDb.savePipe( pipe, function( err, pipe ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			console.log("Pipe successfully saved: " + JSON.stringify( pipe) );
			res.json( pipe );
		});
	});
	
	/**
	 * Delete
	 */
	app.delete('/pipes/:id', function( req, res ){
		pipeDb.removePipe( req.params.id, function( err, pipe ){
			if ( err ){
				return misc.jsonError( res, err );
			}
			console.log( "Pipe successfully removed : " + JSON.stringify( pipe ) );
			res.json( pipe );
		});
	})
};
