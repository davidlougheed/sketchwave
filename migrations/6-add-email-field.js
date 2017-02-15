'use strict';

module.exports = {
	up: function (queryInterface, Sequelize, done) {
		return queryInterface.addColumn('Users', 'email', {
			type: Sequelize.STRING
		}).then(function () {
			done();
		});
	},

	down: function (queryInterface) {
		return queryInterface.removeColumn('Users', 'email');
	}
};
