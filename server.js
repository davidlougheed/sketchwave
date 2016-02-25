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

var passport = require('passport');
var bcrypt = require('bcrypt');

const APP_BASE_PATH = __dirname;

var models = require('./models');

var LocalStrategy = require('passport-local').Strategy;
passport.use(new LocalStrategy({ usernameField: 'username' }, function (username, password, done) {
	models.User.findOne({where: {username: username}}).then(function (user) {
		if(user === null) {
			return done(null, false, {message: 'noUser'});
		}
		if(!bcrypt.compareSync(password, user.password)) {
			return done(null, false, {message: 'incorrectPassword'});
		}

		return done(null, user);
	});
}));

var redisClient  = redis.createClient();
var redisStore = connectRedis(session);

var app = express();
var appServer = http.createServer(app);
var appRouter = express.Router();
var io = socketIO.listen(appServer);

var config = require('./config.json');

app.set('view engine', 'jade');
app.set('views', APP_BASE_PATH + '/views');

app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}));
app.use(session({
	store: new redisStore({host: 'localhost', port: 6379, client: redisClient, ttl: 400}),
	secret: config.sessionSecret,
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(APP_BASE_PATH + '/public'));
app.use('/', appRouter);

passport.serializeUser(function(user, done) {
	done(null, user.id);
});
passport.deserializeUser(function(id, done) {
	models.User.findById(id).then(function (user) {
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
		passport: passport,
		models: models,
		config: config
	});
});

models.sequelize.sync().then(function () {
	var server = appServer.listen(config.port, config.host, function () {
		console.log('Server running on ' + server.address().port);
	});
});
