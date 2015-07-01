'use strict';

/* Main App Module */
var mainApp = angular.module('dataMovingApp', [
  'connections',
  'salesforce',
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ui.router',
  'ui.bootstrap'
],function($locationProvider) {
    //$locationProvider.html5Mode({'enabled': true, 'requireBase': false});
})

.run( ['$rootScope', '$state', '$stateParams',
    function ($rootScope,   $state,   $stateParams) {
		$rootScope.$state = $state;
		$rootScope.$stateParams = $stateParams; 
	}
])

.config(function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');
    
    $stateProvider
        .state('home', {
            url:'',
            views: {
	            'connectionList': {
	                templateUrl: '/templates/connectionList.html',
	                controller: 'connectionsController'
	            },
	            'connectionDetails':{
	            	templateUrl: "/templates/home.html"
	            }
	        }
        })
        .state('home.connectionDetails', {
            url:'/:id',
            resolve:{
            	//Return a promise that will be resolved before the controller is instantiated
		        connectionList:  function(connectionsService){
		           return connectionsService.listConnections();
		        }
            },
            views: {
            	'connectionDetails@' : {
            		templateUrl: '/templates/connectionDetails.html',
            	   	controller: 'connectionDetailController'
            	}
            }
        })
        .state('home.connectionDetails.tab',{
        	parent: 'home.connectionDetails',
    		url:'/tab/:tab',
			templateUrl: function (stateParams){
				if ( !stateParams.tab ){
					return '/templates/home.html';
				}
				return '/templates/connectionDetails.' + stateParams.tab + '.html';
            },
			controller: ['$scope', '$stateParams', function($scope, $stateParams){
				$scope.tabName = $stateParams.tab;
			}]
    	})
})

.controller('dataMovingModel', ['$scope', '$http', '$location',
  function($scope, $http, $location) {
	$scope.goSalesforce = function(){
		$http.get('/sf').success(function(data) {
			console.log( data );
		})
		.error( function( data, status, headers, config){
			console.log( "error: " + data + " Status: " + status);
		})
	};	
 }]
)

.controller('connectionsController', ['$scope', '$rootScope', '$http', '$location', 'connectionsService',
  function($scope, $rootScope, $http, $location, connectionsService) {
	
	function listConnections(){
		connectionsService.listConnections().then( 
			function(connections){
				$scope.connections = connections;
			},function( reason ){
				console.log("error reading list of connections: " + reason );
			}
		);
	}
	
	listConnections();
	
	$scope.createNewConnection = function(){
		connectionsService.createConnection()
		.then( function( connection ){
			listConnections();
			$scope.$apply();
		}, function( reason ){
			alert("Unable to create new connection: " + reason );
		});
	}
	
	$scope.removeConnection = function(){
		if ( !$rootScope.$stateParams.id ){
			alert("No Connection selected");
		}else{
			connectionsService.removeConnection( $rootScope.$stateParams.id ).then(
				function(){
					console.log("Connection " + $rootScope.$stateParams.id + " successfully removed");
				},
				function( err ){
					alert("Unable to remove the connection: " + err );
				}
			);
		}
	}
 }]
)

.controller('connectionDetailController', ['$scope', '$http', '$location', '$stateParams','connectionsService', 'salesforceService',
  function($scope, $http, $location, $stateParams, connectionsService, salesforceService) {
	$scope.selectedConnection = connectionsService.findConnection( $stateParams.id);
	
	$scope.saveConnection = function(){
		connectionsService.saveConnection( $scope.selectedConnection ).then(
			function(){
				console.log("Connection " + $scope.selectedConnection._id + " successfully saved");
			},
			function( err ){
				alert("Unable to save connection: " + err );
			}
		);
	}
	
	$scope.openTableList = function(){
    	$scope.tableMenuOpenClass = (!$scope.tableMenuOpenClass || $scope.tableMenuOpenClass === "") ? "open" : "";
	}
	
	$scope.connect = function(){
		var loginWindow = window.open("/sf/" + $scope.selectedConnection._id);
		if ( loginWindow ){
			var timer = setInterval( function(){
				if ( loginWindow.closed ){
					$('#OAuthWaitLogin').modal('hide');
					clearInterval( timer );
				}
			}, 500);
		}else{
			alert("Unable to start login process");
		}
	}
	
	$scope.selectTable = function(table){
		$scope.selectedConnection.selectedTableName = table.name;
		$scope.selectedConnection.selectAllTables = false;
	}
 }]
)
