'use strict';

var appMessage = require('../modules/app-message');

module.exports.controller = function (objects) {
	objects.io.on('connection', function (socket) {
		socket.on('newMessage', function (data) {
			// If user is properly signed in

			if (socket.request.session.passport.user) {
                appMessage.create(objects, socket, data.conversationID, data.messageData, data.type);
			} else {
				// TODO: Handle socket non-auth error
			}
		});
	});
};
