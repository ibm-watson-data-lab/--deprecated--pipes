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
function dashDBConnection(){
	connection.call(this);
}

module.exports = dashDBConnection;