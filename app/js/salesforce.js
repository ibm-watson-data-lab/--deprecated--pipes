'use strict';

angular.module('salesforce', [],function() {

})

.factory('salesforceService',function($q, $http){
	return {
        connect: function(connection){        	
        	var deferred = $q.defer();
        	$http.get('/sf/' + connection._id )
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