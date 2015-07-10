'use strict';

/**
 * CDS Labs module
 * 
 *   Library to dataWorks APIs
 * 
 * @author David Taieb
 */

var connection = require('./connection');

/**
 * DataWorks connection to cloudant
 */
function cloudantConnection(dwInstance){
	connection.call(this, dwInstance, "cloudant");
	
	//Public APIs
	/**
	 * Set the cloudant database name
	 */
	this.setDbName = function( dbName ){
		this.dbName = dbName;
	}
	
	/**
	 * Validate the current connection defintion
	 * @return null if no error, error message string if not
	 */
	this.validate = function(){
		if ( !this.dbName ){
			return "Cloudant database name not set";
		}
		return null;
	}
	
	/**
	 * Get Connection Options Override
	 */
	this.getOptions = function(){
		return {	
			batchSize: 2000	
		};
	}
	
	/**
	 * Get connection details
	 * @return JSON payload with connection details specific to the connector
	 */
	this.getConnectionDetails = function(){
		var service = this.getService();
		var connection = {
			database : this.dbName,
			createDatabase : false,
			ssl : true,
			user : service.credentials.username,
			password : service.credentials.password,
			host : service.credentials.host,
			port: service.credentials.port,
			type : this.type
		};
		console.log("Cloudant Connection: " + require("util").inspect(connection) );
		return connection;
	}
}

module.exports = cloudantConnection;