module.exports = function (sequelize, dataTypes) {
	var Stamp = sequelize.define('Stamp', {
		imageData: {type: dataTypes.TEXT},
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
