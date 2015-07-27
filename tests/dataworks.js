'use strict';

/**
 * CDS Labs mocha tests for DataWorks module
 * 
 *   Test for the dataWorks js APIs
 * 
 * @author David Taieb
 */

var assert = require("assert"); // node.js core module
var dataworks = require("../server/dw/dataworks");

describe('testDataWorks', function() {
	var ACTIVITY_NAME = "test";
	var dwInstance = null;
	var testActivityId = null;
	before(function( done ) {
		//Create a DataWorks instance
		dwInstance = new dataworks();
		
		//delete activity name
		this.timeout(15000);
		dwInstance.getActivityByName( ACTIVITY_NAME, function( err, activity ){
			assert.equal( !!err, false, "Error retrieving activities from DataWorks " + err);
			if ( activity ){
				dwInstance.deleteActivity( activity.id, function( err ){
					assert.equal( !!err, false, "Unable to delete activity " + err );
					done(err);
				})
			}else{
				done();
			}
		});
	});
	
	describe('#createAndRunActivity()', function() {
		it('should create an activity', function(done) {
			this.timeout(15000);
			var srcConnection = dwInstance.newConnection("cloudant");
			srcConnection.setDbName( "test_source" );
			srcConnection.addTable( {
				name: "test_table".toUpperCase()
			});
			var targetConnection = dwInstance.newConnection("dashDB");
			targetConnection.setSourceConnection( srcConnection );
			dwInstance.createActivity({
				name: "test",
				desc: "Test instance",
				srcConnection: srcConnection,
				targetConnection: targetConnection
			}, function( err, activity ){
				if ( err ){
					return done( err );
				}
				testActivityId = activity.id;
				console.log("SuccessFully created a new activity: " + require('util').inspect( activity, { showHidden: true, depth: null } ) );
				return done();
			});
		});
		
		it('should run an activity', function( done ){
			assert.ok( testActivityId, "Didn't get a valid activity to run");
			dwInstance.runActivity( testActivityId, function( err, activityDoc ){
				if ( err ){
					return done(err);
				}
				return done();
			})
		});
	});
	
});