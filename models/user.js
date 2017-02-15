'use strict';

module.exports = function (sequelize, dataTypes) {
    var User = sequelize.define('User', {
        username: {type: dataTypes.STRING, unique: true, allowNull: false},
        email: {type: dataTypes.STRING, allowNull: true},
        password: {type: dataTypes.STRING, allowNull: false},

        avatar: {type: dataTypes.BLOB},
        avatarThumb: {type: dataTypes.BLOB}
    }, {
        classMethods: {
            associate: function (models) {
                User.belongsToMany(models.Conversation, { through: 'UserConversation' });
            }
        }
    });

    return User;
};
