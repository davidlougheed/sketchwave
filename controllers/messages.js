'use strict';

var sanitizeHtml = require('sanitize-html');

module.exports.controller = function (objects) {
	objects.io.on('connection', function (socket) {
		socket.on('newMessage', function (data) {
			// If user is properly signed in

			if (socket.request.session.passport.user) {
				objects.models.Conversation.findOne({
					where: {
						id: parseInt(data.conversationID)
					}
				}).then(function (conversation) {
					conversation.getUsers({
						where: {
							id: socket.request.session.passport.user
						}
					}).then(function (users) {
						if (users != null && users.length > 0) {
							objects.models.Message.create({
								imageData: [data.imageData],
								ConversationId: parseInt(data.conversationID),
								UserId: parseInt(socket.request.session.passport.user)
							}).then(function (message) {
								conversation.lastMessage = Date.now();
								conversation.save();

								var messageData = message.toJSON();
								messageData['imageData'] = sanitizeHtml(messageData['imageData'], {
									allowedTags: [],
									allowedAttributes: []
								});

								socket.broadcast.to('conversation' + data.conversationID.toString())
									.emit('newMessage', messageData);
							});
						}
					});
				});
			} else {
				// TODO: Handle socket non-auth error
			}
		});
	});
};
