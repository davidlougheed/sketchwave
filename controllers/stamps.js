'use strict';

var sanitizeHtml = require('sanitize-html');

var appError = require('../modules/app-error');

module.exports.controller = function (objects) {
	objects.router.get('/conversations/:id/stamps/', function (req, res) {
		if(!req.isAuthenticated()) {
			return appError.generate(req, res, appError.ERROR_FORBIDDEN, {}, appError.MESSAGE_NOT_AUTHENTICATED);
		}
		if (!req.params.id) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {}, appError.MESSAGE_PARAMETERS_REQUIRED);
		}

		res.setHeader('Content-Type', 'application/json');

		objects.models.Stamp.findAll({
			where: {
				ConversationId: req.params.id
			}
		}).then(function (stamps) {
			return res.send({ success: true, stamps: stamps });
		})
	});

	objects.io.on('connection', function (socket) {
		socket.on('stampAdd', function (data) {
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
							objects.models.Stamp.create({
								imageData: sanitizeHtml(data.imageData, {
									allowedTags: [],
									allowedAttributes: []
								}),
								UserId: parseInt(users[0].id),
								ConversationId: conversation.id
							}).then(function (stamp) {
								objects.io.to('conversation' + conversation.id.toString())
									.emit('stampAdd', stamp.toJSON());
							});
						}
					});
				});
			}
		});
		socket.on('stampRemove', function (data) {
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
						objects.models.Stamp.findOne({
							where: {
								id: parseInt(data.stampID)
							}
						}).then(function (stamp) {
							if(stamp.UserId === users[0].id) {
								objects.io.to('conversation' + conversation.id.toString())
									.emit('stampRemove', stamp.id);
								stamp.destroy();
							}
						});
					}
				});
			});
		});
	});
};
