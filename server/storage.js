'use strict';

/**
 * CDS Data Pipe Tool
 * 
 *   Abstracted storage API layer that uses Cloudant Service coming from either bluemix service or cloudant.com
 * 
 * @author David Taieb
 */

var cfEnv = require("cfenv");
var appEnv = cfEnv.getAppEnv();
var when = require('when');
var events = require('events');
var util = require('util');
var _ = require('lodash');
var async = require('async');

//Discover cloudant service info and initialize connection
var cloudantUrl = process.env.CLOUDANT_URL;
var storageServiceName = process.env.CLOUDANT_SERVICE_NAME || new RegExp(".*cloudant.*");
var cloudantService = cloudantUrl ? 
		{ 
			name : "Cloudant Url", 
			credentials: { url: cloudantUrl} 
		} 
		: appEnv.getService(storageServiceName);
if (!cloudantService) {
    console.log("Failed to find Cloudant service");
    throw new Error( "Failed to find Cloudant service" );
}

console.log("Using cloudant service \"" + cloudantService.name +"\"");
var couchDb = require('cloudant')({
	"url" : cloudantService.credentials.url, 
	"log" : function (id, args) {
		//console.log(id, args);
	}
});

//Define a storage class
function storage( serviceDbName, viewsManager ){
	//Call constructor from super class
	events.EventEmitter.call(this);	
	
	//this db name and handle
	this.serviceDbName = serviceDbName;	
	this.storageDb = null;
	
	var self = this;	
	this.initCouchDb = function( resolve, reject ){
		couchDb.db.get(self.serviceDbName, function(err, body) {
			if ( viewsManager && !_.isArray( viewsManager )){
				viewsManager = [viewsManager];
			}
			if (err ) {
				//Create it
				couchDb.db.create(self.serviceDbName,function(err,body){
					if ( err ){
						reject( "Unable to create db " + self.serviceDbName + ". Error is " + err );
					}else{
						self.storageDb = couchDb.use( serviceDbName );
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
				self.storageDb = couchDb.use( self.serviceDbName );
				
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
		
	when.promise( this.initCouchDb )
		.then( function() {
			console.log("Cloudant database successfully initialized");
			self.emit("cloudant_ready");
		})
		.otherwise( function(err) {
			console.log("Error initializing cloudant database " + err);
			self.emit("cloudant_error");
		});
	
	this.isDbInitialized = function(){
		return this.storageDb;
	};
	
	this.run = function( callback ){
		if ( !self.storageDb ){
			var err = "Storage has not been correctly initialized";
			console.log( err );
			return callback( err );
		}
		
		return callback( null, self.storageDb );
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
			db.get( docId, { include_docs: true }, function( err, body ){
				var id = body && body._id;
				var rev = body && body._rev;
				//Let caller modify doc if already exists, caller can replace with entirely new doc, however, doc id will be reestablished if doc
				//already exists
				body = callback( body );				
				if ( body ){
					if ( id && rev ){
						body._id = id;
						body._rev = rev;
					}
					
					db.insert( body, body._id, function( err, data ){
						if ( err ){
							return done(err);
						}
						return done( null, data );
					});
				}
			});
		});
	}
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
