'use strict';

module.exports = function (sequelize, dataTypes) {
    var User = sequelize.define('User', {
        username: {type: dataTypes.STRING, unique: true, allowNull: false},
        password: {type: dataTypes.STRING, allowNull: false},

        avatar: {type: dataTypes.BLOB}
    }, {
        classMethods: {
            associate: function (models) {
                User.belongsToMany(models.Conversation, { through: 'UserConversation' });
            }
        }
    });

    return User;
};
