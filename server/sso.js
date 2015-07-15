'use strict';

/**
 * CDS Pipe Tool sso module
 * 
 * @author David Taieb
 */

var express = require('express');
var passport = require('passport');
var session = require('express-session');
var openIDConnectStrategy = require('./idaas/strategy');
var global = require('./global');

/**
 * Configure the app to add security based on the ssoService
 */
module.exports = function( app, ssoService ){
	app.use(session({ secret: 'keyboard cat' }));
	app.use(passport.initialize());
	app.use(passport.session()); 
	
	passport.serializeUser(function(user, done) {
		done(null, user);
	}); 

	passport.deserializeUser(function(obj, done) {
		done(null, obj);
	});

	var strategy = new openIDConnectStrategy({
		authorizationURL : ssoService.credentials.authorizationEndpointUrl,
		tokenURL : ssoService.credentials.tokenEndpointUrl,
		clientID : ssoService.credentials.clientId,
		scope: 'openid',
		response_type: 'code',
		clientSecret : ssoService.credentials.secret,
		callbackURL : global.getHostUrl() + "/auth/sso/callback",
		skipUserProfile: true,
		issuer: ssoService.credentials.issuerIdentifier
		}, function(accessToken, refreshToken, profile, done) {
			process.nextTick(function() {
				profile.accessToken = accessToken;
				profile.refreshToken = refreshToken;
				done(null, profile);
			})
		}
	);

	passport.use(strategy); 
	app.get('/login', passport.authenticate('openidconnect', {})); 

	function ensureAuthenticated(req, res, next) {
		if(!req.isAuthenticated()) {
			req.session.originalUrl = req.originalUrl;
			res.redirect('/login');
		} else {
			return next();
		}
	}
	
	//Authenticate all requests
	app.use(ensureAuthenticated);
	
}