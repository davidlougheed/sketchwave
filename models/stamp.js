module.exports = function (sequelize, dataTypes) {
    var Stamp = sequelize.define('Stamp', {
        imageData: {type: dataTypes.ARRAY(dataTypes.TEXT)},
    }, {
        classMethods: {
            associate: function (models) {
                Stamp.belongsTo(models.User);
            }
        }
    });

    return Stamp;
};
