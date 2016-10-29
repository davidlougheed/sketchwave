'use strict';

module.exports = {
	up: function (queryInterface, Sequelize) {
		return queryInterface.addColumn('Messages', 'metaData', {
			type: Sequelize.JSONB
		})
	},

	down: function (queryInterface) {
		return queryInterface.removeColumn('Messages', 'metaData');
	}
};
