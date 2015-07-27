'use strict';

/**
 * CDS Labs module
 * 
 *   Test for the storage APIs
 * 
 * @author David Taieb
 */

var cloudant = require('../server/storage');
var dbName =  process.env.CLOUDANT_DB_NAME || "pipe_db";

var pipeDb = new cloudant.db(dbName );

pipeDb.on( "cloudant_ready", function(){
	console.log("Data Pipe Configuration database (" + dbName + ") ready");
	
	console.log("Removing all documents from all_runs view");
	pipeDb.deleteDocsFromView('application', "all_runs", function(err, results){
		if ( err ){
			return console.log("Error deleting documents from view %s", err );
		}
		console.log("Successfully removed all documents from view");
	})
});

pipeDb.on("cloudant_error", function(){
	throw new Error("Fatal error from Cloudant database: unable to initialize " + dbName);
});