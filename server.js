'use strict';

/**
 * CDS Pipe Tool main module
 * 
 * @author David Taieb
 */

var express = require('express');
var fs = require('fs');
var path = require('path');
var https = require('https');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var morgan = require('morgan');

var cfEnv = require("cfenv");
var appEnv = cfEnv.getAppEnv();

var VCAP_APPLICATION = JSON.parse(process.env.VCAP_APPLICATION || "{}");
var VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES || "{}");

var app = express();

app.use(express.static(path.join(__dirname, 'app')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(errorHandler({ dumpExceptions:true, showStack:true }));

var env = app.get('env');
if ('production' === env) {
	app.use(morgan('dev'));
}

if ('development' === env || 'test' === env) {
	app.use(morgan('dev'));
	app.use(errorHandler()); // Error handler - has to be last
}

//Configure the endpoints
require("./server/sfAPI")(app);	//Saleforce
require("./server/pipeAPI")(app);	//Pipe configuration

var port = process.env.VCAP_APP_PORT || process.env.DEV_PORT;
var connected = function() {
	console.log("Data Moving Tool started on port %s : %s", port, Date(Date.now()));
};

var options = {
  key: fs.readFileSync('development/certs/server/my-server.key.pem'),
  cert: fs.readFileSync('development/certs/server/my-server.crt.pem')
};

if (process.env.VCAP_APP_HOST){
	https.createServer(options, app).listen(process.env.VCAP_APP_PORT,
                         process.env.VCAP_APP_HOST,
                         connected);
}else{
	https.createServer(options, app).listen(port,connected);
}