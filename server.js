var fs = require('fs');

var express = require('express');
var jade = require('jade');

var passport = require('passport');
var bcrypt = require('bcrypt');

const APP_BASE_PATH = __dirname;

var app = express();
var appRouter = express.Router();

app.set('view engine', 'jade');
app.set('views', APP_BASE_PATH + '/views');

app.use(express.static(APP_BASE_PATH + '/public'));
app.use('/', appRouter);

var controllerDir = './controllers';

fs.readdirSync(controllerDir).filter(function (file) {
	return (file.indexOf('.') !== 0) && (file.substr(-3) === '.js');
}).forEach(function (file) {
	var route = require(controllerDir + '/' + file);
	route.controller({
		router: appRouter
	});
});

var server = app.listen(4321, 'localhost', function () {
	console.log('Server running...');
});
