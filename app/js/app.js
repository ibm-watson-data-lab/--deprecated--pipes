'use strict';

/* Main App Module */
var mainApp = angular.module('dataMovingApp', [
  'pipes',
  'ui.router',
  'ui.bootstrap'
],function($locationProvider) {
    //$locationProvider.html5Mode({'enabled': true, 'requireBase': false});
})

.run( ['$rootScope', '$state', '$stateParams', '$http',
    function ($rootScope,   $state,   $stateParams, $http) {
    $rootScope.$state = $state;
    $rootScope.$stateParams = $stateParams;

    //Get the user id if security is enabled
    $http.get('/userid').success(function(data) {
      $rootScope.userid = data;
    })
    .error( function( data, status, headers, config){
      console.log("Running tool with security disabled");
    })
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
                templateUrl: "/templates/pipeDetails.about.html"
              },
              'pipeSidebar':{
                templateUrl: "/templates/pipeSidebar.html",
                  controller: 'pipesController'
              },
              'pipeSelector':{
            	  templateUrl: "/templates/pipeSelector.html",
            	  controller: function($scope, $controller, pipesService){
            		  //call Parent controller
            		  $controller('pipesController', {$scope: $scope});
            		  pipesService.getConnectors().then(
            				 function(connectors){
            					 $scope.connectors = connectors;
            				 },function( reason ){
            					 console.log("error getting connectors: " + reason );
            				 }
            		  );
            		  $('#pipeSelector.dropdown').hover(function() {
            			  $(this).find('.dropdown-menu').stop(true, true).delay(200).fadeIn(500);
            		  }, function() {
            			  $(this).find('.dropdown-menu').stop(true, true).delay(200).fadeOut(500);
            		  });
            	  }
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
        	},
        	onEnter: function($stateParams, pipesService){
        		if ( $stateParams.tab === 'monitoring' ){
        			pipesService.startMonitorCurrentRun();
        		}
        	},
        	onExit: function($stateParams, pipesService){
        		if ( $stateParams.tab === 'monitoring' ){
        			pipesService.stopMonitorCurrentRun( );
        		}
        		if ( pipesService.scope ){
        			delete pipesService.scope;
        		}
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
  
  //Create new pipe
  $('#createNewPipe').on('show.bs.modal', function (event) {
	  var sourceElt = $(event.relatedTarget);
	  $rootScope.creatingConnector = JSON.parse( JSON.stringify(pipesService.getConnector( sourceElt.data('connector')) ));
	  $rootScope.creatingConnector.connectorId = $rootScope.creatingConnector.id;
	  delete $rootScope.creatingConnector.id;
	  $rootScope.$apply();
  });
  
  $rootScope.createNewPipe = function( newPipe ){
	//Mark it as new so it passes validation
	newPipe['new'] = true;
    pipesService.savePipe( newPipe ).then(
      function(){
        console.log("Pipe " + newPipe._id + " successfully saved");
        setTimeout( function(){
        	$('#createNewPipe').modal('hide');
    		//TODO: show the page
        },500);
      },
      function( err ){
        var message = "Unable to save pipe: " + err;
        console.log(message);
        alert(message)
      }
    );
  }
 }]
)

.directive('displayUtcTime', function () {
  return {
    restrict: 'A',
    require: 'ngModel',
    scope:false,
    link: function (scope, element, attrs, ngModel) {
    	ngModel.$formatters.push(function(value) {
    		if ( !value || value === "" ){
    			return "";
    		}
    		return moment(value).format("hh:mm a");
    	});

    	ngModel.$parsers.push(function( value ){
    		if ( !value || value === "" ){
    			ngModel.$setValidity('parse', false);
    			if ( scope && scope.$parent && scope.$parent.error ){
    				delete scope.$parent.error;
    			}
    			return "";
    		}
    		var date = moment(value, "hh:mm a", true);
    		if ( !date.isValid() ){
    			ngModel.$setValidity('parse', true);
    			if ( scope && scope.$parent){
    				scope.$parent.error = "Invalid Date";
    			}
    			return;
    		}else{
    			ngModel.$setValidity('parse', false);
    			if ( scope && scope.$parent && scope.$parent.error ){
    				delete scope.$parent.error;
    			}
    		}
    		return date.format();
    	});
    }
  }
})

.controller('pipeDetailsController', ['$scope', '$http', '$location', '$state', '$stateParams','pipesService',
  function($scope, $http, $location, $state, $stateParams, pipesService) {
  $scope.selectedPipe = pipesService.findPipe( $stateParams.id);
  if ( $scope.selectedPipe.scheduleTime ){
    $scope.selectedPipe.scheduleTime = moment.utc( $scope.selectedPipe.scheduleTime ).toDate();
  }
  
  //Get info about the current connector, wait until the connectors are loaded
  pipesService.getConnectors().then(
	  function(connectors){
		  $scope.selectedConnector = pipesService.getConnector( $scope.selectedPipe );
	  },function( reason ){
		  console.log("error getting connectors: " + reason );
	  }
  );  

  var port = $location.port();
  $scope.oauthCallback=$location.protocol() + "://" + $location.host() + ( (port === 80 || port === 443) ? "" : (":" + port)) +"/authCallback";

  $scope.activateRun = function(run){ // simple toggle to show/hide run details on monitoring
    if($scope.activeRun && $scope.activeRun == run){
      delete $scope.activeRun;
    } else {
      $scope.activeRun = run;
    }
  };

  $scope.savePipe = function( Obj ){
    Obj = Obj || {};

    var connect = (Obj.connect === "true" || Obj.connect === true) ? true : false;
    var nextPageTab = Obj.nextPageTab;

    pipesService.savePipe( $scope.selectedPipe ).then(
      function(){
        console.log("Pipe " + $scope.selectedPipe._id + " successfully saved");
        if ( !connect ){
          setTimeout( function(){
            $('#savePipe').modal('hide');
            if(nextPageTab){
              $scope.goToNextPage(nextPageTab);
            }
          },500);
        }else{
          $scope.connect();
        }

      },
      function( err ){
        var message = "Unable to save pipe: " + err;
        console.log(message);
        if ( !connect ){
          $('#savePipeBody').html( message );
        }
      }
    );
  }

  $scope.openTableList = function(){
      $scope.tableMenuOpenClass = (!$scope.tableMenuOpenClass || $scope.tableMenuOpenClass === "") ? "open" : "";
  }

  $scope.connect = function(){
	  window.location.href = "/connect/" + $scope.selectedPipe._id + "?url=" + encodeURIComponent($location.absUrl());
	  return;
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

.directive('pageButtonBar', function(){
  return {
    restrict: 'E',
    scope: true,
    templateUrl: function( element, attr) {
      return "/templates/pageButtonBar.html";
    },
    link: function(scope, elem, attrs){
      scope.connect = attrs.connect;
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

.controller('pipeDetails.tab.monitoring.controller', ['$scope', '$http', '$location', '$state', '$stateParams','pipesService',
    function($scope, $http, $location, $state, $stateParams, pipesService) {
	pipesService.scope = $scope;
    $scope.tabName = $stateParams.tab;

    $scope.isPipeRunning = function(){
    	return $scope.selectedPipe && $scope.currentRun;
    }

    $scope.runNow = function(){
      pipesService.runPipe( $scope.selectedPipe ).then(
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
            $scope.disableRunNow = false; // re-enables the Run Now button on monitoring
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
