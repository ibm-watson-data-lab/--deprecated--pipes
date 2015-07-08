'use strict';

/**
 * CDS Labs module
 * 
 *   Global singleton object
 * 
 * @author David Taieb
 */

var _ = require('lodash');

module.exports = {
	appHost: null,
	appPort: 0,
	getHostUrl: function(){
		if ( this.appHost == null ){
			return null;
		}
		
		var url = this.appHost;
		if ( this.appHost.indexOf("://") < 0 ){
			url = "https://" + this.appHost;
		}
		if ( this.appPort > 0 ){
			url += ":" + this.appPort;
		}
		return url;
	},
	gc: function(){
		if ( global.gc ){
			//Check the memory usage to decide whether to invoke the gc or not
			var mem = process.memoryUsage();
			if ( (mem.heapUsed / mem.heapTotal) * 100 > 80 ){	//Heap is 80% or more filled
				global.gc();
			}			
		}
	},
	jsonError : function( res, code, err ){		
		if ( !err ){
			err = code;
		}
		if ( !_.isFinite( code ) ){
			code = 500;
		}
		
		var message = err.message || err.statusMessage || err;
		if ( res.headersSent ){
			console.log("Error could not be sent because response is already flushed: " + message );
			return;
		}
		
		res.status( code ).json({'error': message} );
		return message;
	}
};
