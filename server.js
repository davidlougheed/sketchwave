'use strict';

var http = require('http');
var fs = require('fs');

var express = require('express');
var jade = require('jade');

var redis = require('redis');
var socketIO = require('socket.io');
var connectRedis = require('connect-redis');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var flash = require('connect-flash');

var passport = require('passport');
var bcrypt = require('bcrypt');

const APP_BASE_PATH = __dirname;

var models = require('./models');

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

// Note: maxAge is in milliseconds!
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

passport.serializeUser(function (user, done) {
	done(null, user.id);
});
passport.deserializeUser(function (id, done) {
	models.User.findOne({ where: { id: id }, attributes: { exclude: ['avatar'] } }).then(function (user) {
		done(null, user);
	});
});

var controllerDir = './controllers';

fs.readdirSync(controllerDir).filter(function (file) {
	return (file.indexOf('.') !== 0) && (file.substr(-3) === '.js');
}).forEach(function (file) {
	var route = require(controllerDir + '/' + file);
	route.controller({
		router: appRouter,
		io: io,
		redis: redisClient,
		passport: passport,
		models: models,
		dbConfig: dbConfig,
		siteConfig: siteConfig
	});
});

models.sequelize.sync().then(function () {
	var server = appServer.listen(siteConfig.port, siteConfig.host, function () {
		console.log('Server running on ' + server.address().port);
	});
});
