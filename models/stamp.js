'use strict';

module.exports = function (sequelize, dataTypes) {
	var Stamp = sequelize.define('Stamp', {
		imageData: { type: dataTypes.TEXT },
		imageData2: { type: dataTypes.BLOB }
	}, {
		classMethods: {
			associate: function (models) {
				Stamp.belongsTo(models.User);
				Stamp.belongsTo(models.Conversation);
			}
		}
	});

	return Stamp;
};
