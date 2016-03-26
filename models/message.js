'use strict';

module.exports = function (sequelize, dataTypes) {
	var Message = sequelize.define('Message', {
		imageData: {type: dataTypes.ARRAY(dataTypes.TEXT)},
	}, {
		classMethods: {
			associate: function (models) {
				Message.belongsTo(models.User);
			}
		}
	});

	return Message;
};
