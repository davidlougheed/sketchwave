'use strict';

module.exports = function (sequelize, dataTypes) {
    var Conversation = sequelize.define('Conversation', {
        name: {type: dataTypes.STRING},
        lastMessage: {type: dataTypes.DATE}
    }, {
        classMethods: {
            associate: function (models) {
                Conversation.belongsToMany(models.User, { through: 'UserConversation' });
                Conversation.belongsToMany(models.User, { as: 'Moderators', through: 'ModeratorConversation' });
                Conversation.belongsTo(models.User, { as: 'Owner' });
                Conversation.hasMany(models.Message);
            }
        }
    });

    return Conversation;
};
