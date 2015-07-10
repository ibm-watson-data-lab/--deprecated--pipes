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
	getHostName: function(){
		var url = this.appHost || "http://127.0.0.1";
		if ( url.indexOf("://") < 0 ){
			url = "https://" + this.appHost;
		}
		return url;
	},
	getHostUrl: function(){		
		var url = this.getHostName();
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
