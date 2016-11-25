'use strict';

module.exports = {
	up: function (queryInterface, Sequelize, done) {
		return queryInterface.addColumn('Users', 'avatarThumb', {
			type: Sequelize.BLOB
		}).then(function () {
			done();
		});
	},

	down: function (queryInterface) {
		return queryInterface.removeColumn('Users', 'avatarThumb');
	}
};
