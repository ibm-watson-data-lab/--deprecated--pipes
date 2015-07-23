'use strict';

/**
*	Endpoints for managing data pipes
*	@Author: David Taieb
*/

var pipeDb = require( './pipeStorage');
var global = require('./global');
var webSocket = require('ws');
var webSocketServer = webSocket.Server;
var _  = require('lodash');

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
		var requiredFields = ['name', 'clientId', 'clientSecret'];
		
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
					{startkey: [{}, req.params.pipeid], endKey:[0, req.params.pipeid],'include_docs':true, 'limit': 10, descending:true},
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
	
	//Catch all for uncaught exceptions
	process.on("uncaughtException", function( err ){
		console.log("Unexpected exception: " + err );
		console.log(err.stack || "No stack available");
		//Something terribly wrong happen within the code, catch it here so we don't crash the app
		if ( global.currentRun ){
			global.currentRun.done(err);
		}		
	});
	
	//Returns a function that configure the webSocket server to push notification about runs
	return function(server){
		var wss = new webSocketServer({
			server: server,
			path:"/runs"
		});
		
		global.on("runEvent", function( runDoc ){
			_.forEach( wss.clients, function( client ){
				if ( client.readyState === webSocket.OPEN){
					client.send( JSON.stringify( runDoc ) );
				}
			});
		});
		
		wss.on('connection', function(ws) {
			//Send response with current run
			ws.send( global.currentRun && JSON.stringify(global.currentRun.runDoc ));

			ws.on('close', function() {
				console.log("Web Socket closed");
			});
		});
	}
};
