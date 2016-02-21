module.exports = function (sequelize, dataTypes) {
    var Conversation = sequelize.define('Conversation', {
        name: {type: dataTypes.STRING}
    }, {
        classMethods: {
            associate: function (models) {
                Conversation.belongsToMany(models.User, {through: 'UserConversation'});
            }
        }
    });

    return Conversation;
};
