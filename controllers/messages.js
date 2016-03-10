module.exports.controller = function (objects) {
	objects.router.post('/message/', function (req, res) {
		//TODO: Handle errors properly

		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return res.send({ error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		if (!req.body) {
			return res.send({ error: 'no_body' });
		}

		objects.models.Message.create({
			imageData: [req.body.imageData],
			ConversationId: parseInt(req.body.conversationID),
			UserId: parseInt(req.user.id)
		}).then(function (message) {
			objects.models.Conversation.findOne({
				where: {
					id: parseInt(req.body.conversationID)
				}
			}).then(function (conversation) {
				conversation.lastMessage = Date.now();
                conversation.save();

				res.send({ success: true });
			});
		});
	});

	objects.io.on('connection', function (socket) {
		socket.on('addUser', function (data) {
			// TODO: Send user connect message, handle online/offline stuff...
			// TODO: Cache conversation data FOR ALL APP!!! SO THAT NOT SO MANY DB REQUESTS ARE MADE

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
						socket.join('conversation' + data.conversationID.toString());

						socket.broadcast.to('conversation' + data.conversationID.toString())
							.emit('addUser', users[0].username);
					}
				});
			});
		});
		socket.on('removeUser', function (data) {
			// TODO: Send user disconnect message, handle online/offline stuff...

			socket.leave('conversation' + data.conversationID.toString());

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
						socket.broadcast.to('conversation' + data.conversationID.toString())
							.emit('removeUser', users[0].username);
					}
				});
			});
		});

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

								socket.broadcast.to('conversation' + data.conversationID.toString())
									.emit('newMessage', message.toJSON());
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
