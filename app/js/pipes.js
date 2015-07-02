'use strict';

var cachedPipes = [];	//cache of existing pipes
var newPipes = [];	//placeholder for newly created newPipe

angular.module('pipes', [],function() {

})

.factory('pipesService',function($q, $http){ 
	function cache(){
		return _.union( cachedPipes, newPipes )
	}
	
    return {
        listPipes: function(){        	
        	var deferred = $q.defer();
        	if ( cachedPipes.length > 0 ){
        		deferred.resolve( cache() );
        	}else{
	        	$http.get('/pipes')
	        		.success(function(data) {
	        			cachedPipes = data;
	        			deferred.resolve( cache() );
	        		})
	        		.error( function (data, status, headers, config ){
	        			deferred.reject( status );
	        		});
        	}        	
        	return deferred.promise;
        },
        findPipe: function( id ){
        	return _.find( cache(), function( conn ){
        		return conn._id === id;
        	});
        },
        removePipe: function( id ){
        	var deferred = $q.defer();
        	var conn = this.findPipe( id );
        	if ( !conn ){
        		return deferred.reject("Unable to find pipe for " + id );
        	}
        	
        	$http.delete('/pipes/' + id)
        		.success(function(data) {
        			deferred.resolve();
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( data.error || data );
        		});
        	
        	return deferred.promise;
        },
        createPipe: function(){
        	var deferred = $q.defer();
        	var seq = 1;
        	var name;
        	while ( true ){
        		name = "Pipe " + seq++;
        		if ( ! _.find( newPipes, function( conn ){
        			return conn.name == name;
        		})){
        			break;
        		}
        	}
        	
        	var newPipe = {
        		name: name,
        		_id: name,
        		loginUrl: "https://login.salesforce.com",
        		"new": true
        	};
        	
        	newPipes.push( newPipe );
        	deferred.resolve( newPipe );
        	return deferred.promise;
        },
        savePipe: function( pipe ){
        	var deferred = $q.defer();
        	$http.post('/pipes', pipe, {json: true})
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