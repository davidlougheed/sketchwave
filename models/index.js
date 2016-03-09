var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');

var config = require('../config.json');
var sequelize = new Sequelize(config.database.name, config.database.username, config.database.password, {
	host: config.database.host,
	port: config.database.port,
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
