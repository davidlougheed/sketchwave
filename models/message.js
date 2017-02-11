'use strict';

module.exports = function (sequelize, dataTypes) {
	var Message = sequelize.define('Message', {
		type: dataTypes.STRING(10),
		textData: dataTypes.TEXT,
		metaData: dataTypes.JSONB,
		imageData: {type: dataTypes.ARRAY(dataTypes.TEXT)},
		imageData2: {type: dataTypes.ARRAY(dataTypes.BLOB)}
	}, {
		classMethods: {
			associate: function (models) {
				Message.belongsTo(models.User);
				Message.belongsTo(models.Conversation);
			}
		}
	});

	return Message;
};
