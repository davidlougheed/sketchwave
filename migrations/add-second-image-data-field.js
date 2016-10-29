'use strict';

module.exports = {
	up: function (queryInterface, Sequelize, done) {
		return queryInterface.addColumn('Messages', 'imageData2', {
			type: Sequelize.ARRAY(Sequelize.BLOB)
		}).then(function () {
			queryInterface.sequelize.query('UPDATE "Messages" SET "imageData2"=ARRAY[decode(' +
				'replace("imageData"[1], \'data:image/png;base64,\', \'\'), \'BASE64\')]').then(function () {
				done();
			});
		});
	},

	down: function (queryInterface) {
		return queryInterface.removeColumn('Messages', 'imageData2');
	}
};
