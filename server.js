'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

// Web-related resources
var express = require('express');
var jade = require('jade');

var redis = require('redis');
var socketIO = require('socket.io');
var connectRedis = require('connect-redis');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var flash = require('connect-flash');

// Security
var passport = require('passport');
var csurf = require('csurf');
var bcrypt = require('bcrypt');

const APP_BASE_PATH = __dirname;
const MODEL_DIR = path.join(APP_BASE_PATH, 'models');
const CONTROLLER_DIR = path.join(APP_BASE_PATH, 'controllers');

var models = require(MODEL_DIR);

var LocalStrategy = require('passport-local').Strategy;
passport.use(new LocalStrategy({ usernameField: 'username' }, function (username, password, done) {
	models.User.findOne({
		where: { username: username },
		attributes: { exclude: ['avatar'] }
	}).then(function (user) {
		if (user === null) {
			return done(null, false, { success: false, message: 'No user with that name' });
		}
		if (!bcrypt.compareSync(password, user.password)) {
			return done(null, false, { success: false, message: 'Incorrect password' });
		}

		return done(null, user);
	});
}));

var redisClient  = redis.createClient();
var redisStore = connectRedis(session);

var app = express();
var appServer = http.createServer(app);
var appRouter = express.Router();

var dbConfig = require('./config/config.json')[process.env.NODE_ENV];
var siteConfig = require('./config/site.json');

// Set up the session middleware with a Redis store (to allow for multiple app instances).
// NOTE: maxAge is in milliseconds!
var sessionMiddleware = session({
	store: new redisStore({
		host: dbConfig.redis.host,
		port: dbConfig.redis.port,
		client: redisClient,
		ttl: dbConfig.redis.ttl
	}),
	secret: siteConfig.sessionSecret,
	resave: false,
	saveUninitialized: false,

	cookie: { maxAge: 1800000 }
});

var csrfProtection = csurf({});

var io = socketIO.listen(appServer).use(function (socket, next) {
	sessionMiddleware(socket.request, {}, next);
});

app.set('view engine', 'jade');
app.set('views', APP_BASE_PATH + '/views');

// Keep these above passport and session initialization to prevent reload of user data
app.use('/bower_components', express.static(APP_BASE_PATH + '/bower_components'));
app.use(express.static(APP_BASE_PATH + '/public'));

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(sessionMiddleware);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use('/', appRouter);

app.use(function (req, res) {
	res.status(404);
	res.render('errors/404.jade', {});
});
app.use(function (req, res) {
	res.status(403);
	res.render('errors/403.jade', {});
});

// Convert a user object to its serialized form.
passport.serializeUser(function (user, done) {
	done(null, user.id);
});
// Convert a user's serialized form to an object.
passport.deserializeUser(function (id, done) {
	models.User.findOne({ where: { id: id }, attributes: { exclude: ['avatar'] } }).then(function (user) {
		done(null, user);
	});
});

// Load all JavaScript files in the controller directory as controller objects.
fs.readdirSync(CONTROLLER_DIR).filter(function (file) {
	return (file.indexOf('.') !== 0) && (file.substr(-3) === '.js');
}).forEach(function (file) {
	var route = require(path.join(CONTROLLER_DIR, file));
	// Pass an object containing shared instances needed for site function to each controller.
	route.controller({
		router: appRouter,
		io: io,
		redis: redisClient,
		passport: passport,
		csrfProtection: csrfProtection,
		models: models,
		dbConfig: dbConfig,
		siteConfig: siteConfig
	});
});

models.sequelize.sync().then(function () {
	// Once models are synced, server can be started!
	var server = appServer.listen(siteConfig.port, siteConfig.host, function () {
		console.log('Server running on ' + server.address().port);
	});
});
