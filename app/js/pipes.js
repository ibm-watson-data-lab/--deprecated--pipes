'use strict';

var cachedPipes = [];	//cache of existing pipes
var newPipes = [];	//placeholder for newly created newPipe
var connectors = null;

angular.module('pipes', [],function() {

})

.factory('pipesService',function($q, $http, $location){ 
	function cache(){
		return _.union( cachedPipes, newPipes )
	}
	
    return {
    	allTables: {
    		labelPlural: "All Tables",
    		name: null
    	},
    	
    	getConnectors: function(){
    		var deferred = $q.defer();
    		if ( connectors ){
    			deferred.resolve( connectors );
    		}else{
    			$http.get('/connectors')
	        		.success(function(data) {
	        			connectors = data;
	        			deferred.resolve( connectors );
	        		})
	        		.error( function (data, status, headers, config ){
	        			deferred.reject( status );
	        		});
    		}
    		return deferred.promise;
    	},
    	getConnectorForPipeId: function(pipeId){
    		var pipe = this.findPipe( pipeId );
    		return pipe ? this.getConnector(pipe):null;
    	},
    	getConnector: function( id ){
    		var connectorId = _.isString( id ) ? id : (id && id.connectorId);
    		if ( !connectorId ){
    			return null;
    		}
    		return _.find( connectors, function( connector ){
    			return connector.id === connectorId;
    		})
    	},
        listPipes: function(){        	
        	var deferred = $q.defer();
        	if ( cachedPipes.length > 0 ){
        		deferred.resolve( cache() );
        	}else{
	        	$http.get('/pipes')
	        		.success(function(data) {
	        			cachedPipes = data;
	        			newPipes = []; //clear placeholder
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
        			_.remove( newPipes, conn );
        			_.remove( cachedPipes, conn );
        			deferred.resolve();
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( data.error || data );
        		});
        	
        	return deferred.promise;
        },
        createPipe: function(pipe) {
        	var deferred = $q.defer();
        	$http.post('/pipes', pipe, {json: true})
        		.success(function(data) {
        			if ( ! _.find( newPipes, function( conn ) {
            			return conn.name == data.name;
            		})) {
        				newPipes.push(data);
        			}
        			deferred.resolve(data);
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( data.error || data );
        		});
        	
        	return deferred.promise;
        },
        savePipe: function( pipe ){
        	var deferred = $q.defer();
        	$http.post('/pipes', pipe, {json: true})
        		.success(function(data) {
        			deferred.resolve(data);
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( data.error || data );
        		});
        	
        	return deferred.promise;
        },
        runPipe: function( pipe ){
        	var deferred = $q.defer();
        	$http.post('/runs/' + pipe._id )
        		.success(function(data) {
        			deferred.resolve( data );
        		})
        		.error( function (data, status, headers, config ){
        			deferred.reject( (data && data.error) || status );
        		});
        	
        	return deferred.promise;
        },
        getLastRuns: function(pipe){
        	var deferred = $q.defer();
        	var url = "/runs";
        	if (pipe) {
        		url += ("/" + pipe._id);
        	}
        	$http.get(url)
        		.success(function( data ){
        			var runs = _.map( data, function( row ){
        				var doc = row.doc;
        				doc.startTime = moment( doc.startTime ).format("dddd, MMMM Do YYYY, h:mm:ss a");
        				return doc;
        			});
        			deferred.resolve(runs);
        		})
        		.error( function( data, status, headers, config){
        			deferred.reject( data.error || data );
        		});
        	return deferred.promise;
        },
        startMonitorCurrentRun: function(){
        	if ( this.ws ){
        		return;	//WebSocket already created
        	}
        	
        	this.isMonitoring = true;
        	var wsProtocol = $location.protocol() === "https" ? "wss" : "ws";
        	var ws = this.ws = new WebSocket(wsProtocol + "://" + $location.host() + ($location.port()? ":" + $location.port() : "") +"/runs");
        	var that = this;
        	ws.onopen = function(){
        		console.log("WebSocket pipes run monitoring opened");
        	};
        	ws.onerror = function(evt){
        		console.log("Error establishing web socket: " + evt.reason);
        	};

        	ws.onclose = function(evt){
        		console.log("WebSocket pipes run monitoring closed");
        		if ( that.isMonitoring ){
        			//May be timeout
        			//console.log( JSON.stringify(evt) );
        			console.log("Restarting WebSocket pipes run monitoring...");
        			delete that.ws;
        			return that.startMonitorCurrentRun();
        		}
        	}

        	ws.onmessage = function(message) {
        		if ( !that.scope ){
        			console.log("Invalid state, reference to scope doesn't exist");
        			return;
        		}
        		
        		var run = null;
        		if ( message.data && message.data != "" ){
        			try{
        				run = JSON.parse(message.data);
        			}catch(e){
        				console.log("Unable to parse ws message: " + e);
        				run = null;
        			}
        		}

        		if ( !that.scope.currentRun && run ){
        			that.scope.runningAnchor = true;  //So we can stay on the running page after it's done
        		}
        		that.scope.currentRun = run;
        		//Recompute the steps
        		if ( that.scope.currentRun ){
        			that.scope.steps = [];
        			_.forOwn( that.scope.currentRun, function( value, key ){
        				if ( key.indexOf('step') == 0 ){
        					that.scope.steps.push( value );
        				}
        			});
        		}

        		if(!that.scope.$$phase){
        			that.scope.$apply();
        		}
        	}
        },
        stopMonitorCurrentRun: function( scope ){
        	if ( this.ws ){
        		this.isMonitoring = false;
        		console.log("Closing WebSocket pipes run monitoring");
        		this.ws.close();
        		delete this.ws;
        	}        	
        }
    }
 });