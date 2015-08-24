'use strict';

/**
*	Endpoints for managing data pipes connectors
*	@Author: David Taieb
*/

var fs = require('fs');
var global = require('bluemix-helper-config').global;
var connector = require('./connectors/connector.js');
var _ = require('lodash');
var path = require("path");

function connectorAPI(){
	
	var connectors = null;
	
	//Preload list of registered connectors
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
			var parentDirPath = path.join(connectorPath, file);
			try{
				var connector = require( parentDirPath );				
				console.log("Loaded connector %s", connector.getId());
				return connector;
			}catch( e ){
				console.log("Invalid connector found at location %s. Make sure to export an object that inherit from connector object", parentDirPath );
				console.log(e.stack);
				return null;
			}
		})
		.filter( function( connector ){
			//One more pass to remove any invalid connector
			return connector != null;
		})
		.value();
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