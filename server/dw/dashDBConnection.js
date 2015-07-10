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
 * DataWorks connection to dashDB
 */
function dashDBConnection(dwInstance){
	connection.call(this, dwInstance, "dashdb");
	
	//Public APIs overrides
	/**
	 * Get Connection Options Override
	 */
	this.getOptions = function(){
		if ( this.isSourceConnection ){
			return {};
		}
		
		return {
			existingTablesAction : "replace"		        	
    	};
	}
	
	/**
	 * Get connection details
	 * @return JSON payload with connection details specific to the connector
	 * Note: assumption is that the target schema is the same as the user name
	 */
	this.getConnectionDetails = function(){
		var service = this.getService();
		var connection = {
				database : service.credentials.db,
				user : service.credentials.username,
				password : service.credentials.password,
				schema : service.credentials.username.toUpperCase(),
				host : service.credentials.host,
				port: service.credentials.port,
				type : "dashdb"
		};
		console.log("DashDb Connection: " + require("util").inspect(connection) );
		return connection;
	}
}

module.exports = dashDBConnection;