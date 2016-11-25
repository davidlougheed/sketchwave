'use strict';

module.exports = {
    up: function (queryInterface, Sequelize) {
        return queryInterface.addColumn('Conversations', 'OwnerId', {
            type: Sequelize.INTEGER
        })
    },

    down: function (queryInterface, Sequelize) {
        return queryInterface.removeColumn('Conversations', 'OwnerId');
    }
};
