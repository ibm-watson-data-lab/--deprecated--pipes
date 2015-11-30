'use strict';

/* Main App Module */
var mainApp = angular.module('dataMovingApp', [
  'pipes',
  'ui.router',
  'ui.bootstrap'
],function($locationProvider) {
    //$locationProvider.html5Mode({'enabled': true, 'requireBase': false});
})

.run( ['$rootScope', '$state', '$stateParams', '$http', '$timeout',
    function ($rootScope,   $state,   $stateParams, $http, $timeout) {
    $rootScope.$state = $state;
    $rootScope.$stateParams = $stateParams;
    $rootScope.$timeout = $timeout;

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
              'pipeCreateDialog':{
            	  templateUrl: "/templates/pipeCreateDialog.html",
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
            	  }
              },
              'pipeDeleteDialog':{
            	  templateUrl: "/templates/pipeDeleteDialog.html"
              }
          }
        })
        .state('about', {
        	parent: 'home',
        	url:'/about',
        	views: {
        		'pipeDetails@': {
        			templateUrl: '/templates/pipeDetails.about.html'
        		}
        	}
        })
        .state('faq', {
        	parent: 'home',
        	url:'/faq',
        	views: {
        		'pipeDetails@': {
        			templateUrl: '/templates/pipeDetails.faq.html'
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
        	resolve:{
            	//Return a promise that will be resolved before the controller is instantiated
	            connectorList:  function(pipesService){
	               return pipesService.getConnectors();
	            }
            },
        	templateUrl: function ($stateParams){
        		if ( !$stateParams.tab ){
        			return '/templates/pipeDetails.about.html';
        		}
        		//Redirect to the template proxy that will load the correct page for this connector
        		return '/template/' + $stateParams.id + '/' + $stateParams.tab;
        	},
        	controllerProvider: function($stateParams, pipesService) {
        		if ( $stateParams.tab && $stateParams.tab === 'monitoring' ){
        			return 'pipeDetails.tab.' + $stateParams.tab + '.controller';
        		}
        		//Ask the connector if it has a custom controller for this page
        		var connector = pipesService.getConnectorForPipeId( $stateParams.id);
        		if ( connector && connector.options && connector.options.customControllers ){
        			var customControllerOption = connector.options.customControllers;
        			if ( customControllerOption.hasOwnProperty($stateParams.tab) ){
        				var code = customControllerOption[$stateParams.tab]
        				try{
        					var fn = eval( "(" + code + ")" );
        					return fn;
        				}catch(e){
        					console.log("Invalid custom controller provided for this connector", code, e );
        				}
        			}
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

  $rootScope.$on('$stateChangeSuccess', 
		  function(event, toState, toParams, fromState, fromParams) {
	  //expand the pipename menu
	  $rootScope.$timeout(function() {
		  if (toParams.id) {
			  if (!$rootScope.selectedPipe || $rootScope.selectedPipe._id != toParams.id) {
				  $rootScope.selectedPipe = pipesService.findPipe(toParams.id);
			  }
			  //expand the pipename menu
			  if (toParams.id != fromParams.id) {
				  $rootScope.expandPipeNavMenu(toParams.id);
			  }
			  //default to connection page
			  if (!toParams.tab) {
				  $rootScope.$state.go("home.pipeDetails.tab", {tab:'connection', id: $scope.selectedPipe._id });
			  }
			  
			  $rootScope.selectedPage = toParams.tab || 'connection';
			  $("#"+toParams.id).parent().addClass("active");
		  }
		  
		  if (fromParams.id && (toParams.id != fromParams.id)) {
			  $("#"+fromParams.id).parent().removeClass("active");
		  }
	  },1);
  });
  
  listPipes();

  $rootScope.createNewPipe = function(newPipe){
	  if (newPipe) {
			//Mark it as new so it passes validation
			newPipe['new'] = true;
		    pipesService.createPipe( newPipe ).then(
		      function(response){
		        console.log("Pipe " + response._id + " successfully saved");
		        setTimeout( function(){
		        	pipesService.listPipes();
		        	$('#createNewPipe').modal('hide');
		        	$rootScope.$state.go("home.pipeDetails.tab", {tab:"connection", id: response._id }, { reload: true });
		        },500);
		      },
		      function( err ){
		        var message = "Unable to save pipe: " + err;
		        console.log(message);
		        alert(message)
		      }
		    );
	  } else {
	      alert("Unable to create new pipe: Missing required parameters.");
	  }
  }
  
  $rootScope.createNewPipeNameSet = function() {
	  var name = newPipeForm.name.value;
	  if (_.find($scope.pipes, function(pipe) {
		  return pipe.name == name;
	  })) {
		  $scope.newPipeForm.name.$setValidity("exists", false);
	  }
	  else {
		  $scope.newPipeForm.name.$setValidity("exists", true);
	  }
  }

  $rootScope.collapsePipeNavMenu = function(pipeId) {
	  var collapsible = null;
	  if (pipeId) {
		  collapsible = $("#" + eltId);
	  }
	  else {
		  collapsible = $("li.panel > ul.collapse.in");
	  }
	  if (collapsible) {
		  collapsible.collapse("hide");
		  if (collapsible.get(0)) {
			  var menu = $("#" + collapsible.get(0).id + "_collapse");
			  if (menu) {
				  menu.addClass("collapsed");
			  }
		  }
	  }
  }

  $rootScope.expandPipeNavMenu = function(pipeId) {
	  if (pipeId) {
		  var collapsible = $("#" + pipeId);
		  if (collapsible) {
			  $("#" + pipeId + "_collapse").trigger("click");
			  collapsible.collapse("show");
			  if (collapsible.get(0)) {
				  var menu = $("#" + collapsible.get(0).id + "_collapse");
				  if (menu) {
					  menu.focus();
				  }
			  }
		  }
	  }
  }

  $rootScope.removePipe = function(pipeId){
	var pipeid = pipeId || $rootScope.$stateParams.id;
    if ( !pipeid ){
      alert("No Pipe selected");
    }else{
      pipesService.removePipe( pipeid ).then(
        function(){
          console.log("Pipe " + pipeid + " successfully removed");
          setTimeout( function(){
        	pipesService.listPipes();
        	$('#deletePipe').modal('hide');
        	$rootScope.$state.go("about", null, { reload: true });
          },500);
        },
        function( err ){
          alert("Unable to remove the pipe: " + err );
        }
      );
    }
  }
  
  //delete pipe
  $('#deletePipe').on('show.bs.modal', function (event) {
	  var sourceElt = $(event.relatedTarget);
	  $rootScope.pipeToDelete = JSON.parse( JSON.stringify( pipesService.findPipe(sourceElt.data('pipeid')) ));
	  $rootScope.$apply();
  });
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
    		if (!date.isValid()) {
    			date = moment(value, "h:mm a", true);
    		}
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
  if ($scope.selectedPipe) {
	  if ( $scope.selectedPipe.scheduleTime ){
	    $scope.selectedPipe.scheduleTime = moment.utc( $scope.selectedPipe.scheduleTime ).toDate();
	  }
	  //expand the pipename menu
	  $scope.$timeout(function() {
//		  $("#" + $scope.selectedPipe._id + "_collapse").trigger("click");
		  $scope.expandPipeNavMenu($scope.selectedPipe._id);
		  if ($state.params && $state.params.tab) {
			  $scope.selectedPage = $state.params.tab;
			  $("li.active").removeClass("active");
			  $("#"+$scope.selectedPipe._id).parent().addClass("active");
		  }
	  }, 1);
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
    var tables = [];
    var connector = pipesService.getConnector( $scope.selectedPipe );
    if ( !connector || !connector.options.useCustomTables ){
    	tables.push( pipesService.allTables);
    }
    _.forEach( $scope.selectedPipe.tables, function( table ){
      tables.push( table );
    });
    
    if (!$scope.selectedPipe.selectedTableId && tables.length > 0 ) {
    	$scope.selectTable(tables[0]);
    }
    
    return tables;
  }

  $scope.selectTable = function(table){
    $scope.selectedPipe.selectedTableName = table.labelPlural || table.name;
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
      if (attrs.savebuttondisabled == true || attrs.savebuttondisabled == "true") {
    	  $(".buttonBarSave").prop("disabled",true);
      }
      if (attrs.skipbuttondisabled == true || attrs.skipbuttondisabled == "true") {
    	  $(".buttonBarSkip").prop("disabled",true);
      }
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

.directive('pipesLoadingDirective', function() {
  return function(scope, element, attrs) {
    if (scope.$last){
    	$(".pipes-loading-sidebar").addClass("ng-hide");
    }
    else if (scope.$first) {
    	$(".pipes-loading-sidebar").removeClass("ng-hide");
    }
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

    $scope.getPipeName = function(run) {
    	var name = null;
    	if (run && run.pipeId) {
    		var pipe = pipesService.findPipe(run.pipeId);
    		if (pipe) {
    			name = pipe.name;
    		}
    	}
    	return name;
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
    $scope.fetchRuns = function(allPipes){
      pipesService.getLastRuns(allPipes ? null : $scope.selectedPipe).then(
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

    $scope.fetchRuns(false);
  }]
)
