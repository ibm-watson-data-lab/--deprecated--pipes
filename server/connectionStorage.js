'use strict';

/**
*	Endpoints for managing data pipe connections 
*	@Author: David Taieb
*/

var cloudant = require('./storage');
var _ = require('lodash');

var dbName =  process.env.CLOUDANT_DB_NAME || "pipe_db";
var allConnectionsView = "all_connections";

var pipeDb = new cloudant(dbName, {
	views:{
		 allConnectionsView:{
			 map: function(doc){
				 emit( doc._id, {'_id': doc._id} );
			 }
		  }
	},
	designName: '_design/application'
});

pipeDb.on( "cloudant_ready", function(){
	console.log("Data Pipe Configuration database (" + dbName + ") ready");
});

pipeDb.on("cloudant_error", function(){
	throw new Error("Fatal error from Cloudant database: unable to initialize " + dbName);
});

//Get Connection by Id
pipeDb.getConnection = function( id, callback, noFilterForOutbound ){
	noFilterForOutbound = noFilterForOutbound || false;
	this.run( function( err, db ){
		if ( err ){
			return callback(err);
		}
		db.get( id, { include_docs: true }, function( err, body ){
				if ( err ){
					return callback( err );
				}
				return callback( null, noFilterForOutbound ? body : outboundPayload( body ) );
			})
		});		
};

/**
 * Return a filtered down version of the connection for outbound purposes
 * @param connection
 */
function outboundPayload( connection ){
	//Clone first
	var result = JSON.parse(JSON.stringify( connection ) );
	if ( result.hasOwnProperty("tables")){
		//Filtered down the table object as the info it contains is too big to be transported back and forth
		result.tables = _.map( result.tables, function( table ){
			return { name: table.name, label: table.label, labelPlural: table.labelPlural };
		});
	}
	
	if ( result.hasOwnProperty( "sf ") ){
		delete result.sf;
	}
	return result;
}

/**
 * Merge the connection with the stored value, restoring any fields that have been filtered during outbound
 */
function inboundPayload( storedConnection, connection ){
	if ( storedConnection.hasOwnProperty( "tables" ) ){
		connection.tables = storedConnection.tables;
	}
	if ( storedConnection.hasOwnProperty( "sf" ) ){
		connection.sf = storedConnection.sf;
	}
	return connection;
}

pipeDb.saveConnection = function( conn, callback ){
	//If new connection, then _id is just a placeholder, new to remove it before saving it
	if ( conn.hasOwnProperty("new") ){
		conn._id = null;
		delete conn["new"];
	}
	this.getConnection( conn._id, function( err, connection ){
		if ( !err ){
			//Connection already exist, fetch the revision
			conn.rev = connection._rev;
			conn._id = connection._id;
			
			conn = inboundPayload( connection, conn );
		}
		
		this.run( function( err, db ){
			if ( err ){
				return callback(err);
			}
			db.insert( conn, conn._id, function( err, data ){
				if ( err ){
					return callback(err);
				}
				return callback( null, outboundPayload(data) );
			});
		});
	}.bind( this ), true);
}

pipeDb.listConnections = function( callback ){
	this.run( function( err, db ){
		db.view('application', allConnectionsView, {'include_docs':true},
			function(err, data) {
				if ( err ){
					return callback( err );
				}
				return callback( null, _.map( data.rows, function( row ){
					return outboundPayload(row.doc);
				}));
			}
		);
	});
}

pipeDb.removeConnection = function( id, callback ){
	this.getConnection( id, function( err, connection ){
		if ( err ){
			return callback( err );
		}
		
		this.run( function( err, db ){
			if ( err ){
				return callback(err);
			}
			db.destroy( connection._id, connection['_rev'], function( err, data ){
				if ( err ){
					return callback( err );
				}
				return callback( null, data );
			});
		});
	}.bind( this ));
}

module.exports = pipeDb;