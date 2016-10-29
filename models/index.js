'use strict';

var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');

var config = require('../config/config.json');
var sequelize = new Sequelize(config[process.env.NODE_ENV].database,
	config[process.env.NODE_ENV].username, config[process.env.NODE_ENV].password,
	{
		host: config[process.env.NODE_ENV].host,
		port: config[process.env.NODE_ENV].port,
		dialect: 'postgres'
	});
var db = {};

fs.readdirSync(__dirname).filter(function (file) {
	return (file.indexOf('.') !== 0) && (file !== 'index.js') && (file.substr(-3) === '.js');
}).forEach(function (file) {
	var model = sequelize.import(path.join(__dirname, file));
	db[model.name] = model;
});

Object.keys(db).forEach(function (modelName) {
	if ('associate' in db[modelName]) {
		db[modelName].associate(db);
	}
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
