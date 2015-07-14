'use strict';

/* Main App Module */
var mainApp = angular.module('dataMovingApp', [
  'pipes',
  'salesforce',
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
	            'pipeList': {
	                templateUrl: '/templates/pipeList.html',
	                controller: 'pipesController'
	            },
	            'pipeDetails':{
	            	templateUrl: "/templates/home.html"
	            },
	            'pipeSidebar':{
	            	templateUrl: "/templates/pipeSidebar.html",
	                controller: 'pipesController'
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
            	   	controller: 'pipeDetailsController'
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
            controllerProvider: function($stateParams) {
            	if ( $stateParams.tab && $stateParams.tab === 'monitoring' ){
            		return 'pipeDetails.tab.' + $stateParams.tab + '.controller';
            	}
            	//Default
            	return 'pipeDetails.tab.controller';
            }
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

.controller('pipeDetailsController', ['$scope', '$http', '$location', '$state', '$stateParams','pipesService', 'salesforceService',
  function($scope, $http, $location, $state, $stateParams, pipesService, salesforceService) {
	$scope.selectedPipe = pipesService.findPipe( $stateParams.id);
	
	$scope.isPipeRunning = function(){
		var selectedPipe = $scope.selectedPipe || null;
		return selectedPipe && selectedPipe.run;
	}
	
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
	
	$scope.goToNextPage = function( tab ){
		$state.go("home.pipeDetails.tab", {tab:tab, id: $scope.selectedPipe._id });
	}
 }]
)

.directive('repeatRunDetailsDirective', function() {
  return function(scope, element, attrs) {
	  $(element).popover({ 
		  html : true,
		  trigger: 'manual',
		  placement: function (context, source) {
			  var get_position = $(source).position();
			  if (get_position.left > 515) {
				  return "left";
			  }
			  if (get_position.left < 515) {
				  return "right";
			  }
			  if (get_position.top < 110){
				  return "bottom";
			  }
			  return "top";
		  },
		  content: function() {
			  return $( element ).find("." + attrs.repeatRunDetailsDirective).html();   
		  }
	  }).on("click", function(e) {
		  e.preventDefault();
	  }).on("mouseenter", function() {
		  var _this = this;
		  $(this).popover("show");
		  $(this).siblings(".popover").on("mouseleave", function() {
			  $(_this).popover('hide');
		  });
	  }).on("mouseleave", function() {
		  var _this = this;
		  setTimeout(function() {
			  if (!$(".popover:hover").length) {
				  $(_this).popover("hide")
			  }
		  }, 100);
	  });
  };
})

.controller('pipeDetails.tab.controller', ['$scope', '$http', '$location', '$stateParams','pipesService',
    function($scope, $http, $location, $stateParams, pipesService) {
		$scope.tabName = $stateParams.tab;
	}]
)

.controller('pipeDetails.tab.monitoring.controller', ['$scope', '$http', '$location', '$state', '$stateParams','pipesService', 'salesforceService',
    function($scope, $http, $location, $state, $stateParams, pipesService, salesforceService) {
		$scope.tabName = $stateParams.tab;

		$scope.runNow = function(){
			salesforceService.runPipe( $scope.selectedPipe ).then(
					function(){
						console.log("Pipe " + $scope.selectedPipe._id + " successfully started");
						//Reload the view
						setTimeout( function( callback ){
							$state.go($state.current.name, {}, {reload: true});
							location.reload();
						}, 5000);
					},
					function( err ){
						alert("Error while running pipe: " + err );
					}
			);
		}
		
		//Get the list of runs
		var fetchRuns = function(){
			pipesService.getLastRuns($scope.selectedPipe).then(
					function( runs ){
						$scope.runs = runs;

						if ( $scope.selectedPipe.run ){
							var currentRun = _.find( $scope.runs, function(r){
								return r._id === $scope.selectedPipe.run;
							});

							if ( currentRun ){
								$scope.steps = [];
								_.forOwn( currentRun, function( value, key ){
									if ( key.indexOf('step') == 0 ){
										$scope.steps.push( value );
									}
								});

								//Monitor progress
								setTimeout( fetchRuns, 1000 );
							}
						}

						if(!$scope.$$phase){
							$scope.$apply();
						}
					},function(err){
						alert("Unable to query the activity history: " + err);
					}
			);
		}
		
		fetchRuns();
	}]
)

