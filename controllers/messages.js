'use strict';

var appError = require('../modules/app-error');
var appMessage = require('../modules/app-message');

module.exports.controller = function (objects) {
	objects.router.get('/messages/:id/image/', function (req, res) {
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/messages/' + req.params.id));
		}
		if (!parseInt(req.params.id)) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {}, appError.MESSAGE_INVALID_ID);
		}

		objects.models.Message.findOne({
			where: {
				id: parseInt(req.params.id)
			},
			attributes: ['id', 'type', 'imageData2', 'ConversationId']
		}).then(function (message) {
			if (message) {
				message.getConversation().then(function (conversation) {
					if (conversation) {
						return conversation.getUsers({
							where: {
								id: req.user.id
							}
						});
					} else {
						appError.generate(req, res, appError.ERROR_INTERNAL_SERVER, {});
					}
				}).then(function (users) {
					if (users != null && users.length > 0) {
						res.header('Content-Type', 'image/png');

						if (message.imageData2 !== null && message.type == 'image') {
							return res.send(message.imageData2[0]);
						}

						return res.send(null);
					} else {
						appError.generate(req, res, appError.ERROR_FORBIDDEN, {});
					}
				});
			} else {
				appError.generate(req, res, appError.ERROR_NOT_FOUND, {});
			}
		});
	});

	objects.io.on('connection', function (socket) {
		socket.on('newMessage', function (data) {
			// If user is properly signed in

			if (socket.request.session.passport.user) {
                appMessage.create(objects, socket, data.conversationID, data.messageData, data.type, {}, false);
			} else {
				// TODO: Handle socket non-auth error
			}
		});
	});
};
