'use strict';

/**
 * CDS Labs module
 * 
 *   Helpers for managing VCAP_SERVICES
 * 
 * @author David Taieb
 */

var configManager = require('./configManager');

function vcapServices(){
	
	var cfOptions = {};
	if ( configManager.get( "DEV_VCAP_PATH" )){
		//User has specified the path of a properties file to load the vcap services from
		cfOptions.vcap = {"services" : require("jsonfile").readFileSync( configManager.get("DEV_VCAP_PATH") )};
	}else if ( configManager.get( "DEV_VCAP_CONFIG") ){
		//User has specified dev vcap via nconfig
		cfOptions.vcap = {"services" : configManager.get("DEV_VCAP_CONFIG") };
	}
		
	//Parse the services
	var appEnv = require("cfenv").getAppEnv(cfOptions);
	
	this.getService = function( serviceName ){
		return appEnv.getService( new RegExp(".*" + serviceName +".*", "i") );
	}
}

module.exports = new vcapServices();