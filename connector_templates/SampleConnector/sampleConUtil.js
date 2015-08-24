//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

var cloudant = require('../../storage');
var _ = require('lodash');

/*
* Returns the database name for the specified stripe object type (aka table)
*/
var getCloudantDatabaseName = function(tableName) {
	return 'sample_' + tableName.toLowerCase(); 
};

/*
*   Private 
*   
*/
	var genViewsManager = function(table){
		var tables = table || this.getPipeRunner().getSourceTables();
		if ( !_.isArray( tables ) ){
			tables = [tables];
		}
		var viewsManager = [];
		_.forEach( tables, function( table ){
			var manager = new cloudant.views( '_design/' + table.name );
			manager.addView(
					table.labelPlural || table.label || table.name,
					JSON.parse("{"+
							"\"map\": \"function(doc){" +
							"if ( doc.pt_type === '" + table.name + "'){" +
							"emit( doc._id, {'_id': doc._id, 'rev': doc._rev } );" +
							"}" +
							"}\"" +
							"}"
					), 2 //Version
			);
			viewsManager.push( manager );
		});
		return viewsManager;

	}.bind( this );

	var createCloudantDbForTable = function( logger, table, callback ){
		//One database per table, create it now
		var dbName = getCloudantDatabaseName(table.name);

		var targetDb = new cloudant.db(dbName, genViewsManager( table ));
		var ready = null;
		targetDb.on( 'cloudant_ready', ready = function(){
			logger.info('Data Pipe Configuration database (' + dbName + ') ready');
			logger.info('Delete all documents for table %s in database %s', table.name, dbName);
			//Remove listener to avoid using the callback again in case we have downstream errors
			targetDb.removeListener('cloudant_ready', ready );
			var called = false;
			targetDb.destroyAndRecreate( function( err ){
				if ( called ){
					return;
				}
				called = true;
				if ( err ){
					logger.error('Unable to recreate db : ' + err );
					return callback(err);
				}
				return callback( null, targetDb);
			});
		});

		targetDb.on('cloudant_error', function(){
			var message = 'Fatal error from Cloudant database: unable to initialize ' + dbName;
			logger.error( message );
			return callback( message );
		});
	};

	/*
	 * Dummy sample implementation only.
	 * @param logger
	 * @param tableName table from which data should be fetched
	 * @param pipe
	 * @param pipeRunStats
	 * @param targetDb
	 * @param callback(err, stats)
	 */
	var copyData = function( logger, tableName, pipe, pipeRunStats, targetDb, callback ) {

		logger.trace('copyData() - copying data from the sample data source to Cloudant' );

		// runstats for this table (this information is persisted in a run document in cloudant)
		var stats = {
			tableName : tableName,			// table name
			numRecords: 0,					// total number of records written to Cloudant
			dbName : getCloudantDatabaseName(tableName),
			errors: []						// list of errors
		};

		// save initial runstats for this table	
		pipeRunStats.addTableStats(stats);

		var dummyData = [{name:'myname', age: 21},{name:'yourname', age : 27}];

		// dummyDoc
		var jsonDoc = {docs: dummyData}; 

		// use the storage utility funtion to perform the bulk insert
		targetDb.run(function(err, db) {
			if(err) {
				// signal to the parent that an error was encountered during processing 
				return callback(err);
			}
			// bulk insert (100 rows max)
			db.bulk(
					jsonDoc, 
					function(err, body, header){
						if(err) {
							// signal to the parent that an error was encountered during processing 
							stats.errors.push(err);
							return callback(err);
						}
						else {
								// update the statistics
								stats.numRecords = stats.numRecords + dummyData.length;
								pipeRunStats.addTableStats(stats);
								// done
								return callback(null, stats);
						}
					});	
		});

	}; // copyData


// exports
module.exports.getCloudantDatabaseName = getCloudantDatabaseName;
module.exports.createCloudantDbForTable = createCloudantDbForTable;
module.exports.copyData = copyData;