'use strict';

/* Main App Module */
var mainApp = angular.module('dataMovingApp', [
  'pipes',
  'salesforce',
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ui.router',
  'ui.bootstrap',
  'fm.components'
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
	            'pipeList': {
	                templateUrl: '/templates/pipeList.html',
	                controller: 'pipesController'
	            },
	            'pipeDetails':{
	            	templateUrl: "/templates/home.html"
	            }
	        }
        })
        .state('home.pipeDetails', {
            url:'/:id',
            resolve:{
            	//Return a promise that will be resolved before the controller is instantiated
		        pipeList:  function(pipesService){
		           return pipesService.listPipes();
		        }
            },
            views: {
            	'pipeDetails@' : {
            		templateUrl: '/templates/pipeDetails.html',
            	   	controller: 'pipeDetailController'
            	}
            }
        })
        .state('home.pipeDetails.tab',{
        	parent: 'home.pipeDetails',
    		url:'/tab/:tab',
			templateUrl: function (stateParams){
				if ( !stateParams.tab ){
					return '/templates/home.html';
				}
				return '/templates/pipeDetails.' + stateParams.tab + '.html';
            },
			controller: ['$scope', '$stateParams', function($scope, $stateParams){
				$scope.tabName = $stateParams.tab;
				
				if ( $stateParams.tab === 'scheduling'){
					//Configure time picker
					// Our main parameters for the time picker.
					// These will primarily be used to populate the scope of this demonstration.
					$scope.style = "dropdown";
					$scope.timeFormat = "HH:mm";
					$scope.startTime = "9:00";
					$scope.endTime = "18:00";
					$scope.intervalMinutes = 10;
					$scope.largeIntervalMinutes = 60;

					// Parameters that will actually be passed into the timepicker.
					$scope.time = moment( "15:01", $scope.timeFormat );
					$scope.start = moment( $scope.startTime, $scope.timeFormat );
					$scope.end = moment( $scope.endTime, $scope.timeFormat );

					// Watch parameters in our local scope and update the parameters in the timepicker as needed.
					$scope.$watchCollection( "[startTime, timeFormat]", function( newValues ) {
						$scope.start = moment( newValues[ 0 ], newValues[ 1 ] );
					} );
					$scope.$watchCollection( "[endTime, timeFormat]", function( newValues ) {
						$scope.end = moment( newValues[ 0 ], newValues[ 1 ] );
					} );
					$scope.$watch( "intervalMinutes", function( newInterval ) {
						$scope.interval = moment.duration( parseInt( newInterval ), "minutes" );
					} );
					$scope.$watch( "largeIntervalMinutes", function( newInterval ) {
						$scope.largeInterval = moment.duration( parseInt( newInterval ), "minutes" );
					} );
				}
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

.controller('pipesController', ['$scope', '$rootScope', '$http', '$location', 'pipesService',
  function($scope, $rootScope, $http, $location, pipesService) {
	
	function listPipes(){
		pipesService.listPipes().then( 
			function(pipes){
				$scope.pipes = pipes;
			},function( reason ){
				console.log("error reading list of pipes: " + reason );
			}
		);
	}
	
	listPipes();
	
	$scope.createNewPipe = function(){
		pipesService.createPipe()
		.then( function( pipe ){
			listPipes();
			$scope.$apply();
		}, function( reason ){
			alert("Unable to create new pipe: " + reason );
		});
	}
	
	$scope.removePipe = function(){
		if ( !$rootScope.$stateParams.id ){
			alert("No Pipe selected");
		}else{
			pipesService.removePipe( $rootScope.$stateParams.id ).then(
				function(){
					console.log("Pipe " + $rootScope.$stateParams.id + " successfully removed");
				},
				function( err ){
					alert("Unable to remove the pipe: " + err );
				}
			);
		}
	}
 }]
)

.controller('pipeDetailController', ['$scope', '$http', '$location', '$stateParams','pipesService', 'salesforceService',
  function($scope, $http, $location, $stateParams, pipesService, salesforceService) {
	$scope.selectedPipe = pipesService.findPipe( $stateParams.id);
	
	$scope.savePipe = function(){
		pipesService.savePipe( $scope.selectedPipe ).then(
			function(){
				console.log("Pipe " + $scope.selectedPipe._id + " successfully saved");
			},
			function( err ){
				alert("Unable to save pipe: " + err );
			}
		);
	}
	
	$scope.openTableList = function(){
    	$scope.tableMenuOpenClass = (!$scope.tableMenuOpenClass || $scope.tableMenuOpenClass === "") ? "open" : "";
	}
	
	$scope.connect = function(){
		var loginWindow = window.open("/sf/" + $scope.selectedPipe._id);
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
	
	$scope.getTablesList = function(){
		var tables = [ pipesService.allTables ];
		_.forEach( $scope.selectedPipe.tables, function( table ){
			tables.push( table );
		});
		return tables;
	}
	
	$scope.selectTable = function(table){
		$scope.selectedPipe.selectedTableName = table.labelPlural;
		$scope.selectedPipe.selectedTableId = table.name;
	}
	
	$scope.runNow = function(){
		salesforceService.runPipe( $scope.selectedPipe ).then(
			function(){
				console.log("Pipe " + $scope.selectedPipe._id + " successfully started");
			},
			function( err ){
				alert("Error while running pipe: " + err );
			}
		);
	}
 }]
)

