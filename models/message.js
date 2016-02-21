module.exports = function (sequelize, dataTypes) {
	var Message = sequelize.define('Message', {
		imageData: {type: dataTypes.ARRAY(dataTypes.TEXT)}
	});

	return Message;
};
