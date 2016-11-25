'use strict';

module.exports = {
	up: function (queryInterface, Sequelize, done) {
		return queryInterface.addColumn('Stamps', 'imageData2', {
			type: Sequelize.BLOB
		}).then(function () {
			queryInterface.sequelize.query('UPDATE "Stamps" SET "imageData2"=decode(' +
				'replace("imageData", \'data:image/png;base64,\', \'\'), \'BASE64\')').then(function () {
				done();
			});
		});
	},

	down: function (queryInterface) {
		return queryInterface.removeColumn('Stamps', 'imageData2');
	}
};
