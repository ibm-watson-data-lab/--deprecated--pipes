'use strict';

/**
*	Endpoints for managing data pipes
*	@Author: David Taieb
*/

var pipeDb = require( './pipeStorage');
var global = require('bluemix-helper-config').global;
var webSocket = require('ws');
var webSocketServer = webSocket.Server;
var _  = require('lodash');
var pipeRunner = require("./pipeRunner");
var connectorAPI = require("./connectorAPI");

module.exports = function( app ){
	
	//Private APIs
	var getPipe = function( pipeId, callback, noFilterForOutbound ){
		pipeDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return callback( err );
			}
			
			callback( null, pipe );			
		}.bind(this), noFilterForOutbound || false);
	}.bind(this);
	
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
		var requiredFields = null;
		if ( pipe.hasOwnProperty("new") ){
			requiredFields = ['name', 'connectorId'];
			delete pipe['new'];
		}else{
			requiredFields = ['name', 'clientId', 'clientSecret', 'connectorId'];
		}
		
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
	app.get("/runs", function( req, res ){
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
	
	/**
	 * Returns the last 10 runs for given pipe
	 */
	app.get("/runs/:pipeid", function( req, res ){
		pipeDb.run( function( err, db ){
			db.view( 'application', "all_runs_for_pipe", 
					{key: req.params.pipeid,'include_docs':true, 'limit': 10, descending:true},
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
	
	/**
	 * Private API for running a pipe
	 * @param pipeId: id of the pipe to run
	 * @param callback(err, pipeRun)
	 */
	var runPipe = function( pipeId, callback ){
		getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return callback(err);
			}
			console.log( "Running pipe using : " + pipe.name );			
			var doRunInstance = function(){
				var pipeRunnerInstance = new pipeRunner( pipe );			
				pipeRunnerInstance.newRun( function( err, pipeRun ){
					if ( err ){
						//Couldn't start the run
						return callback(err);
					}
					return callback( null, pipeRun );
				});
			};
			
			if ( pipe.run ){
				//Check if the run is finished, if so remove the run
				pipeDb.getRun( pipe.run, function( err, run ){
					if ( err || run.status ){
						console.log("Pipe has a reference to a run that has already completed. OK to proceed...");
						//Can't find the run or run completed, ok to run
						return doRunInstance();
					}
					//Can't create a new run while a run is in progress
					var message = "Error: a run is already in progress for pipe " + pipe.name;
					console.log( message );
					return callback( message );
				});
			}else{
				doRunInstance();
			}
			
		}, true);
	}
	
	/**
	 * Start a new pipe run
	 * @param pipeId: id of the pipe to run
	 */
	app.post("/runs/:pipeId", function( req, res ){
		runPipe( req.params.pipeId, function( err, pipeRunDoc){
			if ( err ){
				return global.jsonError( res, err );
			}
			//Return a 202 accepted code to the client with information about the run
			return res.status( 202 ).json( pipeRunDoc.getId() );
		});
	});
	
	/**
	 * Connect to connector data source
	 */
	app.get("/connect/:id", function( req, res){
		getPipe( req.params.id, function( err, pipe ){
			if ( err ){
				return global.jsonError( res, err );
			}
			var connector = connectorAPI.getConnector( pipe );
			if ( !connector ){
				return global.jsonError("Unable to get Connector for " + pipe.connectorId );
			}
			connector.connectDataSource( req, res, pipe._id, req.query.url, function( err, results ){
				if ( err ){
					return global.jsonError( res, err );
				}
				return res.json( results );
			});
		});
	});
	
	/**
	 * authCallback: url for OAuth callback
	 */
	app.get("/authCallback", function( req, res ){
		var code = req.query.code || req.query.oauth_verifier;
		var pipeId = null;
		var state = null;
		
		if (req.query.state) {
			state = JSON.parse(req.query.state);
		}
		else if (req.session && req.session.state) {
			state = JSON.parse(req.session.state);
		}
		
		if (state) {
			pipeId = state.pipe;
		}
		
		console.log("AuthCallback called with return url : " + state.url );
		
		if ( !code || !pipeId ){
			return global.jsonError( res, "No code or state specified in OAuth callback request");
		}
		
		console.log("OAuth callback called with pipe id: " + pipeId );
		
		getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return global.jsonError( res, err );
			}
			var connector = connectorAPI.getConnector( pipe );
			if ( !connector ){
				return global.jsonError( res, "Unable to find connector for " + pipeId)
			}
			
			connector.authCallback( code, pipeId, function( err, pipe ){
				if ( err ){
					return res.type("html").status(401).send("<html><body>" +
						"Authentication error: " + err +
						"</body></html>");
				}
				
				//Save the pipe
				pipeDb.savePipe( pipe, function( err, data ){
					if ( err ){
						return global.jsonError( res, err );
					}

					res.redirect(state.url);
				})
				
			}, state);
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
	
	//Listen to scheduled event runs
	global.on("runScheduledEvent", function( pipeId){
		runPipe( pipeId, function( err, run ){
			if ( err ){
				return console.log("Unable to execute a scheduled run for pipe %s", pipeId);
			}
			console.log('New Scheduled run started for pipe %s', pipeId);
		});
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
