'use strict';

/**
*	Endpoints for managing data pipes connectors
*	@Author: David Taieb
*/

var fs = require('fs');
var global = require('bluemix-helper-config').global;
var pipesSDK = require('pipes-sdk');
var connector = pipesSDK.connector;
var _ = require('lodash');
var path = require("path");
var pipesDb = pipesSDK.pipesDb;

function connectorAPI(){
	
	var connectors = null;
	
	/**
	 * loadConnector: private API for loading a connector from a specified path
	 */
	var loadConnector = function( connectorPath ){
		try{
			var connector = require( connectorPath );
			//Determine the path for the connector which is the parent directory of the module main js file
			connector.path = path.join( require.resolve( connectorPath ), "..");
			//Read any custom tab controller provided by the connector
			readCustomControllers( path.join(connector.path, "controllers"), connector );
			return connector;
		}catch(e){
			console.log("Invalid connector found at location %s. Make sure to export an object that inherit from connector object", connectorPath );
			console.log(e.stack);
			return null;
		}
	}
	
	/**
	 * readCustomController: private API for reading controllers provided by a custom connector
	 */
	var readCustomControllers = function( controllersPath, connector ){
		var customControllers = connector.getOption("customControllers") || {};
		if ( fs.existsSync(controllersPath) ){
			var files = fs.readdirSync( controllersPath);
			files = _.chain( files )
			.filter( function( file ){
				var ret = fs.lstatSync( path.join( controllersPath, file ) ).isFile() && _.endsWith(file, ".js");
				return ret;
			})
			.map(function(file){
				//Extract the tab name from the file name. convention is <<tab>.js
				var tabName = file.substring(0, file.length - ".js".length );
				customControllers[tabName] = fs.readFileSync(path.join( controllersPath, file ), "utf8" );
			})
			.value()
			
			connector.setOption("customControllers", customControllers);
		}
	}
	
	//load connectors with source installed within the main app
	var connectorPath = path.join( __dirname, "connectors" );
	fs.readdir( connectorPath, function(err, files){
		if ( err ){
			throw new Error( err );
		}

		connectors = _.chain( files )
		.filter( function(file){
			return fs.lstatSync(path.join(connectorPath, file)).isDirectory();
		})
		.map( function( file ){
			//Load the connector
			var connector = loadConnector( path.join(connectorPath, file) );
			if ( connector ){
				console.log("Loaded built-in connector", connector.getId());
			}
			return connector;
		})
		.filter( function( connector ){
			//One more pass to remove any invalid connector
			return connector != null;
		})
		.value();
		
		//Load connectors installed as node modules
		var npm = require("npm");
		npm.load({ parseable: true, depth:0 }, function (err, npm) {
			if (err) {
				return console.log("Unable to load npm programmatically: ", err);
			}
			npm.commands.ls([], true, function( err, data, lite){
				if (err) {
					return console.log("Error running npm ls: ", err);
				}
				//console.log("ls data: ", data)
				_.forEach(data.dependencies, function(value, key ){
					if ( value.hasOwnProperty("pipes-connector-name") ){
						//Found a pipe connector module, load it now
						var connector = loadConnector( value.path );
						if ( connector ){						
							console.log("Loaded npm dependency connector", connector.getId());
							connectors.push( connector );
						}
					}				
				})
			})
		});
	});
	
	//Public APIs
	/**
	 * InitEndPoints
	 * @param app: express app
	 */
	this.initEndPoints = function( app ){
		/**
		 * return list of registered connectors
		 */
		app.get('/connectors', function(req, res) {
			if ( !connectors ){
				return global.jsonError( res, "Unable to load registered connectors");
			}
			return res.json( connectors );
		});
	};
	
	/**
	 * getConnectorForPipeId: return the connector for the pipe identified by its id
	 * @param pipeId: id for the pipe
	 * @param callback(err, connector)
	 */
	this.getConnectorForPipeId = function( pipeId, callback ){
		pipesDb.getPipe( pipeId, function( err, pipe ){
			if ( err ){
				return callback(err);
			}
			var connector = this.getConnector( pipe );
			if ( !connector ){
				return callback( "Unable to get Connector for " + pipeId );
			}
			return callback( null, connector );
		}.bind(this));
	}
	
	/**
	 * getConnector: return the connector associated with a pipe
	 */
	this.getConnector = function(pipe){
		var connectorId = _.isString( pipe ) ? pipe : pipe.connectorId;
		return _.find( connectors, function( connector ){
			return connector.getId() === connectorId;
		});
	};
}

//Singleton
module.exports = new connectorAPI();