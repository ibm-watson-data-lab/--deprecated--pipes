'use strict';

angular.module('salesforce', [],function() {

})

.factory('salesforceService',function($q, $http){
	return {
        connect: function(pipe){        	
        	var deferred = $q.defer();
        	$http.get('/sf/' + pipe._id )
        		.success(function(data) {
        			deferred.resolve( data );
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( status );
        		});
        	
        	return deferred.promise;
        },
        
        runPipe: function( pipe ){
        	var deferred = $q.defer();
        	$http.post('/sf/' + pipe._id )
        		.success(function(data) {
        			deferred.resolve( data );
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( status );
        		});
        	
        	return deferred.promise;
        }
    }
 });