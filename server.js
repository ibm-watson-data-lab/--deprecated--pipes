'use strict';

/**
 * CDS Pipe Tool main module
 * 
 * @author David Taieb
 */

var express = require('express');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require("express-session");
var errorHandler = require('errorhandler');
var morgan = require('morgan');
var bluemixHelperConfig = require('bluemix-helper-config');
var global = bluemixHelperConfig.global;
var configManager = bluemixHelperConfig.configManager;

var VCAP_APPLICATION = JSON.parse(process.env.VCAP_APPLICATION || "{}");
var VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES || "{}");

var app = global.app = express();

//Enforce https on Bluemix
app.use( function( req, res, next ){
	if ( req.headers && req.headers.$wssc === 'http'){
		console.log("Automatically redirecting to https...");
		return res.redirect('https://' + req.get('host') + req.url);
	}
	return next();
});

if ( process.env.START_PROXY ){
	//Development only, creates a proxy server to enable local environment access to dw servers
	var dataworks = require("nodejs-dataworks").dataload;
	var dwInstance = new dataworks();
}

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(errorHandler({ dumpExceptions:true, showStack:true }));

app.use(expressSession({
	secret: "simple_data_pipe"
}));

var env = app.get('env');
if ('production' === env) {
	app.use(morgan('dev'));
}

if ('development' === env || 'test' === env) {
	app.use(morgan('dev'));
	app.use(errorHandler()); // Error handler - has to be last
}

var port = process.env.VCAP_APP_PORT || configManager.get("DEV_PORT");
if (!process.env.VCAP_APP_HOST){
	//Running locally. Salesforce requires authCallbacks to use SSL by default
	global.appHost = "https://127.0.0.1";
	global.appPort = port;
}

//Configure security if we are bound to an SSO service
var ssoService = bluemixHelperConfig.vcapServices.getService( "pipes-sso" );
if ( ssoService ){
	console.log("INFO: Security is enabled");
	require('bluemix-helper-sso')(app, {
		ssoService: ssoService,
		relaxedUrls:[
		    "/js", "/img", "/css", "/bower_components", "templates"
		],
		createSessionStore: function( session ){
			//Create a session store based on redis if available, if not, use the default in-memory store
			var redisService = bluemixHelperConfig.vcapServices.getService("pipes-redis");
			if ( redisService ){
				var redisStore = require('connect-redis')(session);
				return new redisStore({
					host: redisService.credentials.hostname,
					port: redisService.credentials.port,
					pass: redisService.credentials.password
				});
			}
			return null;
		}
	});
}else{
	app.get("/userid", function( req, res, next ){
		res.status(200).end();
	})
}

app.use(express.static(path.join(__dirname, 'app')));

//Configure the endpoints
require("./server/connectorAPI").initEndPoints(app);	//Pipe connector API
var wssConfigurator = require("./server/pipeAPI")(app);	//Pipe configuration

var connected = function() {
	console.log("Pipes Tool started on port %s : %s", port, Date(Date.now()));
};

var options = {
  key: fs.readFileSync('development/certs/server/my-server.key.pem'),
  cert: fs.readFileSync('development/certs/server/my-server.crt.pem')
};

var server = null;
if (process.env.VCAP_APP_HOST){
	server = require('http').createServer(app);
	server.listen(port,
                 process.env.VCAP_APP_HOST,
                 connected);
}else{
	server = require('https').createServer(options, app);
	server.listen(port,connected);
}

if ( wssConfigurator && server ){
	wssConfigurator( server );
}

require("cf-deployment-tracker-client").track();
