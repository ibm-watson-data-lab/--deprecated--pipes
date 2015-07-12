'use strict';

/**
*	Endpoints for managing data pipes
*	@Author: David Taieb
*/

var pipeDb = require( './pipeStorage');
var global = require('./global');

module.exports = function( app ){
	
	/**
	 * Get list of existing data pipes
	 */
	app.get('/pipes', function(req, res) {
		pipeDb.listPipes( function( err, pipes ){
			if ( err ){
				return global.jsonError( res, err );
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
			return global.jsonError( res, e );
		}
		pipeDb.savePipe( pipe, function( err, pipe ){
			if ( err ){
				return global.jsonError( res, err );
			}
			console.log("Pipe successfully saved: " + pipe.name );
			res.json( pipe );
		});
	});
	
	/**
	 * Delete
	 */
	app.delete('/pipes/:id', function( req, res ){
		pipeDb.removePipe( req.params.id, function( err, pipe ){
			if ( err ){
				return global.jsonError( res, err );
			}
			console.log( "Pipe successfully removed : " + JSON.stringify( pipe ) );
			res.json( pipe );
		});
	})
	
	/**
	 * Returns the last 10 runs
	 */
	app.get("/runs/:pipeid", function( req, res ){
		pipeDb.run( function( err, db ){
			db.view( 'application', "all_runs", 
					{startkey: [req.params.pipeid, 0], endKey:[req.params.pipeid, {}],'include_docs':true, 'limit': 10, descending:true},
				function(err, data) {
					if ( err ){
						console.log(err);
						//No runs yet, return empty array
						return res.json( [] );
					}
					return res.json( data.rows );
				}
			);
		});
	});
};
