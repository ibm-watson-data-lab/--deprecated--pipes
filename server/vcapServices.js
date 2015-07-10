'use strict';

/**
 * CDS Labs module
 * 
 *   Helpers for managing VCAP_SERVICES
 * 
 * @author David Taieb
 */

function vcapServices(){
	
	var cfOptions = {};
	if ( process.env.DEV_VCAP_PATH ){
		//User has specified the path of a properties file to load the vcap services from
		cfOptions.vcap = {"services" : require("jsonfile").readFileSync( process.env.DEV_VCAP_PATH )};
	}
		
	//Parse the services
	var appEnv = require("cfenv").getAppEnv(cfOptions);
	
	this.getService = function( serviceName ){
		return appEnv.getService( new RegExp(".*" + serviceName +".*", "i") );
	}
}

module.exports = new vcapServices();