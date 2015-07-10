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
function cloudantConnection(){
	connection.call(this);
}

module.exports = cloudantConnection;