'use strict';

/**
 * CDS Labs module
 * 
 *   Abstraction layer for providing configuration variable
 *   Supports multiple strategies:
 *   	-Environment variables (System.env)
 *   	-nconfig module
 * 
 * @author David Taieb
 */

var path = require('path');

function configManager(){
	
	if ( process.env.NODE_CONFIG ){
		//Load the nconfig
		var nconfig = require('nconfig')({
			path: require('path').resolve( __dirname, '..', process.env.NODE_CONFIG)
		});
		this.config = nconfig.loadSync('pipes', ['vcap']);
	}
	
	this.get = function( varName ){
		var retValue = process.env[varName ];
		if ( retValue ){
			return retValue;
		}
		
		//Check the nconfig
		if ( this.config ){
			return this.config[varName];
		}
		return null;
	}
}

module.exports = new configManager();