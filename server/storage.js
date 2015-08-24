'use strict';

/**
 * CDS Data Pipe Tool
 * 
 *   Abstracted storage API layer that uses Cloudant Service coming from either bluemix service or cloudant.com
 * 
 * @author David Taieb
 */

var when = require('when');
var events = require('events');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var configManager = require('bluemix-helper-config').configManager;

//Discover cloudant service info and initialize connection
var cloudantUrl = configManager.get( "CLOUDANT_URL" );
var cloudantService = cloudantUrl ? 
		{ 
			name : "Cloudant Url", 
			credentials: { url: cloudantUrl} 
		} 
		: require("bluemix-helper-config").vcapServices.getService( configManager.get( "CLOUDANT_SERVICE_NAME" ) || "cloudant" );
if (!cloudantService) {
    console.log("Failed to find Cloudant service");
    throw new Error( "Failed to find Cloudant service" );
}

console.log("Using cloudant service \"" + cloudantService.name +"\"");
var cloudant = require('cloudant')({
	"url" : cloudantService.credentials.url, 
	"log" : function (id, args) {
		//console.log(id, args);
	}
});

/**
 * Define a storage class
 * @param serviceDbName: dbName
 * @param viewsManager
 */
function storage( serviceDbName, viewsManager ){
	//Call constructor from super class
	events.EventEmitter.call(this);	
	
	//this db name and handle
	this.serviceDbName = serviceDbName;	
	this.storageDb = null;
	
	this.getDbName = function(){
		return serviceDbName;
	};	
	
	var self = this;	
	this.initCloudant = function( resolve, reject ){
		cloudant.db.get(self.serviceDbName, function(err, body) {
			if ( viewsManager && !_.isArray( viewsManager )){
				viewsManager = [viewsManager];
			}
			if (err ) {
				//Create it
				cloudant.db.create(self.serviceDbName,function(err,body){
					if ( err ){
						reject( "Unable to create db " + self.serviceDbName + ". Error is " + err );
					}else{
						self.storageDb = cloudant.use( serviceDbName );
						if ( viewsManager ){
							var bFound = false;
							_.forEach( viewsManager, function( manager ){
								//Create the design doc
								bFound = true;
								console.log("inserting design doc " + manager.designName );
								self.storageDb.insert( {'views' : manager.getViewsJson() }, manager.designName, function(err,b) {
									if (err) {
										reject( "Failed to create view: "+err);
									}else{
										resolve();
									}
								});
							});
							if ( !bFound ){
								//Nothing to do
								resolve();
							}
						}
					}
				});
			}else{
				self.storageDb = cloudant.use( self.serviceDbName );
				
				//Make sure that the design docs exists, if not create them now
				if ( viewsManager ){
					async.each( viewsManager, function( manager, callback ){
						self.storageDb.get( manager.designName, function( err, body){
							var rev = null;
							var recreateDesignDoc = false;
							if ( err ){
								recreateDesignDoc = true;
							}else{
								//Grab the design doc and check version
								var views = body.views;
								rev = body._rev;
								_.forEach( manager.viewDefs, function( viewDef ){
									if ( views.hasOwnProperty( viewDef.viewName) ){
										var version = views[viewDef.viewName ].version || 0;
										if ( version < viewDef.version ){
											recreateDesignDoc = true;
										}
									}else{
										recreateDesignDoc = true;
									}
								});
							}						
							if ( recreateDesignDoc ){
								var designDoc = {'views' : manager.getViewsJson() };
								if ( rev ){
									designDoc._rev = rev;
								}

								self.storageDb.insert( designDoc , manager.designName, function(err,b) {
									if (err) {
										callback( err );
									}else{
										callback();
									}
								});
							}else{
								callback();
							}
						});
					}, function(err){
						if ( err ){
							reject( "Failed to create view: "+err);
						}else{
							resolve();
						}
					});
				}else{
					resolve();
				}
			}
		});
	};
		
	when.promise( this.initCloudant )
		.then( function() {
			console.log("Cloudant database %s successfully initialized", self.serviceDbName);
			self.emit("cloudant_ready");
		})
		.otherwise( function(err) {
			console.log("Error initializing cloudant database " + err);
			self.emit("cloudant_error");
		});
	
	/**
	 * Return true if db is correctly initialized
	 */
	this.isDbInitialized = function(){
		return !!this.storageDb;
	};
	
	/**
	 * Destroy the current db
	 */
	this.destroy = function( callback ){
		this.run( function( err, db ){
			if ( err ){
				return callback(err);
			}
			cloudant.db.destroy( serviceDbName, function(err){
				if ( err ){
					return callback(err);
				}
				//Set as not initialized
				delete this.storageDb;
				return callback();
			}.bind(this));
		}.bind(this));
	}
	
	/**
	 * Destroy and recreate the database
	 * @param callback(err)
	 */
	this.destroyAndRecreate = function(callback){
		this.run( function( err, db ){
			if ( err ){
				return callback( err );
			}
			cloudant.db.destroy( serviceDbName, function( err ){
				if ( err ){
					return callback(err);
				}
				
				//Reinit
				when.promise( this.initCloudant )
				.then( function() {
					return callback( null );
				})
				.otherwise( function(err) {
					return callback( err );			
				})
			}.bind(this));
		}.bind(this));
	}
	
	this.run = function( callback ){
		if ( !self.storageDb ){
			var err = "Storage has not been correctly initialized";
			console.log( err );
			return callback( err );
		}
		
		return callback( null, self.storageDb );
	};
	
	this.savesInProgress = {};
	
	/**
	 * getDoc: helper function that fetch a document from the database
	 * @param docId: documentId
	 * @param callback(err, doc)
	 */
	this.getDoc = function( docId, callback ){
		this.run( function( err, db ){
			if ( err ){
				return callback(err);
			}
			db.get( docId, { include_docs: true }, callback );
		})
	};
	
	/**
	 * Update doc if exists, insert a new one if not
	 * @param: docId
	 * @param: callback(doc), return updated document
	 * @param: done( err, doc ) status callback
	 */
	this.upsert = function( docId, callback, done ){
		this.run( function( err, db ){
			if ( err ){
				return callback(err);
			}
			
			var insert = function( body ){
				//Let caller modify doc if already exists, caller can replace with entirely new doc, however, doc id will be reestablished if doc already exists
				var id = body && (body._id || body.id);
				var rev = body && (body._rev || body.rev);
				body = callback( body );				
				if ( body ){
					body._id = id || body._id || undefined;
					body._rev = rev || body._rev || undefined;
					
					db.insert( body, body._id, function( err, data ){
						if ( id && this.savesInProgress.hasOwnProperty( id )){
							delete this.savesInProgress[id];
						}
						if ( err ){
							console.log( "Error while saving doc: " + err + ".Doc id: " + body._id + " Doc rev: " + body._rev);
							return done(err);
						}
						//always set the id and rev if available
						body._id = (data && (data.id || data._id)) || body._id;
						body._rev = (data && (data.rev || data._rev)) || body._rev;
						return done( null, body );
					}.bind( this ));
				}else{
					//Caller didn't give us the data, return error
					return done("Error during upsert: Caller didn't return a valid document");
				}
			}.bind( this );
			
			if ( !docId ){
				return insert( null );
			}
			
			if ( this.savesInProgress.hasOwnProperty( docId ) ){
				this.savesInProgress[docId]++;
				//console.log("Deferring save of document: " + docId + " :::: " + this.savesInProgress[docId]);
				//Wait for the other save to finish
				return setTimeout( function(){
					return this.upsert( docId, callback, done );
				}.bind(this), this.savesInProgress[docId] * 500 );
			}

			//Mark this document as being saved
			this.savesInProgress[docId] = 1;
			
			//We have a docId, load it
			db.get( docId, { include_docs: true }, function( err, body ){				
				return insert( body );
			});
		}.bind(this));
	};
	
	/**
	 * Delete all docs in a view
	 */
	this.deleteDocsFromView = function( designName, viewName, callback ){
		//console.log("Deleting all docs in view: " + designName + " / " + viewName );
		this.run( function( err, db ){
			if ( err ){
				return callback( err );
			}
			async.waterfall([
                function( callback ){
                	db.view(designName, viewName, function(err, data) {
						if ( err ){
							return callback( err );
						}
						var docs = _.map( data.rows, function( row ){
							return {id: row.id || row.value._id, rev: row.value.rev||row.value._rev};
						});					
						return callback( null, docs );
                	});
                },
                function( docs, callback ){
                	if ( docs.length == 0 || docs[0].rev ){
                		//We either have no docs to delete, or rev is already retrieved
                		return callback( null, docs );
                	}
                	
                	//Call bulk api to fetch revs
                	db.fetchRevs( { keys: _.map( docs, function(doc){
                			return doc.id;
                		})}, function( err, body ){
                			if ( err ){
                				return callback( err );
                			}
                			return callback( null, _.map(body.rows, function( row ){
                					return {id:row.id, rev: row.value.rev};
                				}) 
                			);
                		}
                	);
                },
                function( docs, callback ){
                	//Delete all docs one by one
                	async.each( docs, function( doc, callback ){
                		db.destroy( doc.id, doc.rev, callback );
                	}, function( err ){
                		return callback( err );
                	});
                }],
                function( err, results ){
					return callback( err, results );
				}
			);
		});
	};
}

//Extend event Emitter
util.inherits(storage, events.EventEmitter);

function viewsManager( designName ){
	this.designName = designName;
	this.viewDefs = [];
	this.addView = function( viewName, viewCode, version ){
		viewCode.version = version || 1;
		this.viewDefs.push( {
			viewName: viewName,
			viewCode: viewCode,
			version: viewCode.version
		});
		return this;
	}
	this.getViewsJson = function(){
		var json = {};
		_.forEach( this.viewDefs, function( viewDef ){
			json[viewDef.viewName ] = viewDef.viewCode;
		});
		return json;
	}
};

//Exports
module.exports.db = storage;
module.exports.views = viewsManager;
