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

.run( ['$rootScope', '$state', '$stateParams', '$http',
    function ($rootScope,   $state,   $stateParams, $http) {
		$rootScope.$state = $state;
<<<<<<< HEAD
		$rootScope.$stateParams = $stateParams;
=======
		$rootScope.$stateParams = $stateParams; 
		
		//Get the user id if security is enabled
		$http.get('/userid').success(function(data) {
			$rootScope.userid = data;
		})
		.error( function( data, status, headers, config){
			console.log("Running tool with security disabled");
		})
>>>>>>> origin/master
	}
])

.config(function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');

    $stateProvider
        .state('about', {
            url:'',
            views: {
	            'pipeList': {
	                templateUrl: '/templates/pipeList.html',
	                controller: 'pipesController'
	            },
	            'pipeDetails':{
	            	templateUrl: "/templates/pipeDetails.about.html"
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
					return '/templates/pipeDetails.about.html';
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
	if ( $scope.selectedPipe.scheduleTime ){
		$scope.selectedPipe.scheduleTime = moment( $scope.selectedPipe.scheduleTime ).toDate();
	}

	$scope.oauthCallback=$location.protocol() + "://" + $location.host() + ($location.port()? ":" + $location.port() : "") +"/authCallback";

	$scope.isPipeRunning = function(){
		return $scope.selectedPipe && $scope.currentRun;
	}

	$scope.savePipe = function(){
		pipesService.savePipe( $scope.selectedPipe ).then(
			function(){
				console.log("Pipe " + $scope.selectedPipe._id + " successfully saved");
				setTimeout( function(){
					$('#savePipe').modal('hide');
				},500);
			},
			function( err ){
				$('#savePipeBody').html("Unable to save pipe: " + err);
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

	var wsProtocol = $location.protocol() === "https" ? "wss" : "ws";
	var ws = new WebSocket(wsProtocol + "://" + $location.host() + ($location.port()? ":" + $location.port() : "") +"/runs");
    ws.onopen = function(){
        console.log("WebSocket connection established");
    };

    ws.onmessage = function(message) {
    	var run = null;
    	if ( message.data && message.data != "" ){
    		try{
    			run = JSON.parse(message.data);
    		}catch(e){
    			console.log("Unable to parse ws message: " + e);
    			run = null;
    		}
    	}

    	if ( !$scope.currentRun && run ){
    		$scope.runningAnchor = true;	//So we can stay on the running page after it's done
    	}
    	$scope.currentRun = run;
    	//Recompute the steps
		if ( $scope.currentRun ){
		   	$scope.steps = [];
			_.forOwn( $scope.currentRun, function( value, key ){
				if ( key.indexOf('step') == 0 ){
					$scope.steps.push( value );
				}
			});
		}

    	if(!$scope.$$phase){
			$scope.$apply();
		}

    };
 }]
)

.directive('pageButtonBar', function(){
	return {
		restrict: 'E',
		scope: true,
		templateUrl: function( element, attr) {
			return "/templates/pageButtonBar.html";
		},
		link: function(scope, elem, attrs){
			scope.nextPageTab = attrs.nextpagetab;
		}
	};
})

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
					},
					function( err ){
						alert("Error while running pipe: " + err );
					}
			);
		}

		//Get the list of runs
		$scope.fetchRuns = function(){
			pipesService.getLastRuns($scope.selectedPipe).then(
					function( runs ){
						$scope.runs = runs;
						if(!$scope.$$phase){
							$scope.$apply();
						}
					},function(err){
						alert("Unable to query the activity history: " + err);
					}
			);
		}

		$scope.fetchRuns();
	}]
)

