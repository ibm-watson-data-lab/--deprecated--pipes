'use strict';

var cachedConnections = [];	//cache of existing connections
var newConnections = [];	//placeholder for newly created connections

angular.module('connections', [],function() {

})

.factory('connectionsService',function($q, $http){ 
	function cache(){
		return _.union( cachedConnections, newConnections )
	}
	
    return {
        listConnections: function(){        	
        	var deferred = $q.defer();
        	if ( cachedConnections.length > 0 ){
        		deferred.resolve( cache() );
        	}else{
	        	$http.get('/connections')
	        		.success(function(data) {
	        			cachedConnections = data;
	        			deferred.resolve( cache() );
	        		})
	        		.error( function (data, status, headers, config ){
	        			deferred.reject( status );
	        		});
        	}        	
        	return deferred.promise;
        },
        findConnection: function( id ){
        	return _.find( cache(), function( conn ){
        		return conn._id === id;
        	});
        },
        removeConnection: function( id ){
        	var deferred = $q.defer();
        	var conn = this.findConnection( id );
        	if ( !conn ){
        		return deferred.reject("Unable to find connection for " + id );
        	}
        	
        	$http.delete('/connections/' + id)
        		.success(function(data) {
        			deferred.resolve();
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( data.error || data );
        		});
        	
        	return deferred.promise;
        },
        createConnection: function(){
        	var deferred = $q.defer();
        	var seq = 1;
        	var name;
        	while ( true ){
        		name = "Connection " + seq++;
        		if ( ! _.find( newConnections, function( conn ){
        			return conn.name == name;
        		})){
        			break;
        		}
        	}
        	
        	var newConnection = {
        		name: name,
        		_id: name,
        		loginUrl: "https://login.salesforce.com",
        		"new": true
        	};
        	
        	newConnections.push( newConnection );
        	deferred.resolve( newConnection );
        	return deferred.promise;
        },
        saveConnection: function( connection ){
        	var deferred = $q.defer();
        	$http.post('/connections', connection, {json: true})
        		.success(function(data) {
        			deferred.resolve();
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( data.error || data );
        		});
        	
        	return deferred.promise;
        }
    }
 });