var fs = require('fs');

var express = require('express');
var jade = require('jade');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

var sequelize = require('sequelize');

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

var app = express();
var appRouter = express.Router();

var config = require('./config.json');

app.set('view engine', 'jade');
app.set('views', APP_BASE_PATH + '/views');

app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({secret: config.sessionSecret, resave: false, saveUninitialized: false}));
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
		passport: passport,
		models: models
	});
});

models.sequelize.sync().then(function () {
	var server = app.listen(4321, 'localhost', function () {
		console.log('Server running on ' + server.address().port);
	});
});
