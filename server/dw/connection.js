'use strict';

/**
 * CDS Labs module
 * 
 *   Library to dataWorks APIs
 * 
 * @author David Taieb
 */

var bluemixHelperConfig = require("bluemix-helper-config");
var vcapServices = bluemixHelperConfig.vcapServices;
var _ = require("lodash");

/**
 * abstract connection class
 */
function connection( dwInstance, type ){
	
	//Parent datawork instance
	this.dwInstance = dwInstance;
	
	//Connector type
	this.type = type;
	
	//Table definition
	this.tableDefs = [];
	
	//Source connection
	this.srcConnection = null;
	
	//Public APIs
	/**
	 * Return CF service for this connection based on type
	 * Pattern is to look for a service that has the type in the name
	 */
	this.getService = function(){
		var service = vcapServices.getService(this.type);
		if ( !service ){
			throw new Error("Unable to find service for connecto type: " + this.type );
		}
		return service;
	}
	
	/**
	 * Validate the current connection defintion
	 * @return null if no error, error message string if not
	 */
	this.validate = function(){
		return null;
	}
	
	/**
	 * Get Connection Options
	 */
	this.getOptions = function(){
		return {};	//Nothing by default, subclasses can override
	}
	
	/**
	 * Get connection details
	 * @return JSON payload with connection details specific to the connector
	 */
	this.getConnectionDetails = function(){
		return null;
	}
	
	/**
	 * addTable
	 * @param tableDef
	 * 	{ 	name: table Name
	 * 		columns: Array of column definition
	 *  }
	 *  @return this object (for chaining)
	 */
	this.addTable = function( tableDef ){
		this.tableDefs.push( tableDef );
		tableDef.id = ("S" + this.tableDefs.length);	//auto-generated unique id
		return this;
	}
	
	/**
	 * Return true if this connection is a source
	 */
	this.isSourceConnection = function(){
		return this.srcConnection == null;
	}
	
	/**
	 * set the source connection corresponding to this connection
	 */
	this.setSourceConnection = function( srcConnection ){
		this.srcConnection = srcConnection;
	}
	
	/**
	 * Return JSON for the tables
	 */
	this.getTablesDetails = function(){
		var payload = [];
		if ( this.isSourceConnection() ){
			_.forEach( this.tableDefs, function( tableDef ){
				payload.push( 
					{
						id: tableDef.id,
						name: tableDef.name.toLowerCase()
					}
				);
			});
		}else{	
			//This is a target connection		
			_.forEach( this.srcConnection.tableDefs, function( tableDef ){
				payload.push( 
						{ 
							name: tableDef.name.toLowerCase(),
							sourceIds : [tableDef.id]
						}
				);
			});
		}
		console.log( "target Tables: " + require("util").inspect( payload ));
		return payload;
	}
}

module.exports = connection;