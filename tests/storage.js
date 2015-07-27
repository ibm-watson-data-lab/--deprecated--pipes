'use strict';

/**
 * CDS Labs mocha tests for storage module
 * 
 *   Test for the storage APIs
 * 
 * @author David Taieb
 */

var assert = require("assert"); // node.js core module
var cloudant = require("../server/storage");
var async = require("async");
var configManager = require("../server/configManager");

describe('testStorage', function() {
	var pipeDb = null;
	var dbName =  configManager.get("CLOUDANT_DB_NAME");
	before(function( done ) {
		assert.ok(dbName, "No CLOUDANT_DB_NAME specified to run this test");
		var viewsManager = new cloudant.views('_design/application');
		viewsManager
		.addView( 
				"view1",
				{
					map: function(doc){
						if ( doc.type === "doc1" ){
							emit( doc._id, {'_id': doc._id} );
						}
					}
				}, 2 //Version
		)
		.addView( 
				"view2",
				{
					map: function(doc){
						if ( doc.type === "doc2" ){
							emit( doc._id, {'_id': doc._id} );
						}
					}
				}, 1 //Version
		)
		.addView( 
				"view3",
				{
					map: function(doc){
						if ( doc.type === "doc3" ){
							emit( doc._id, {'_id': doc._id} );
						}
					}
				}, 1 //Version
		)
		.addView( 
				"view4",
				{
					map: function(doc){
						if ( doc.type === "doc4" ){
							emit( [doc.startTime, doc.pipeId], doc._id );
						}
					}
				}, 4 //Version
		)
		
		//Create the test db
		pipeDb = new cloudant.db(dbName, viewsManager );
		
		pipeDb.on( "cloudant_ready", function(){
			done();
		});
		
		pipeDb.on("cloudant_error", function(){
			assert.fail("Error initializing Database", "Should initialize correctly", "Should have initialized correctly");
			done();
		})
	});
	
	after(function(done){
		//Destroy db
		pipeDb.destroy( function(err ){
			assert.equal( !!pipeDb.isDbInitialized(), false, "Test db has not been destroyed correctly");
			done();
		})
	});

	describe('#verifyDatabase()', function() {
		it('should create a brand new database', function() {
			assert.ok(pipeDb.isDbInitialized(), "Error initializing Cloudant database " + dbName );
		})
		
		it('should create the design docs', function(done){
			pipeDb.run( function( err, db ){
				assert.ok(!err, "unable to get db handle");
				db.get("_design/application", {}, function(err, body){
				if ( err ){
					done(err);
				}else{
					assert.ok( body.views.view1, "Missing view1" );
					assert.ok( body.views.view2, "Missing view2" );
					assert.ok( body.views.view3, "Missing view3" );
					assert.ok( body.views.view4, "Missing view4" );
					done();
				}
			});
			});
		});
	})
	
	describe("Populate Data", function() {
	});
});
