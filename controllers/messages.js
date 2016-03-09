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
		socket.on('addUser', function (userID) {
			// TODO: Send user connect message, handle online stuff...
		});

		socket.on('newMessage', function (data) {
			// If user is properly signed in
			// TODO: Check part of conversation that conversationID specifies

			if (socket.request.session.passport.user) {
				objects.models.Message.create({
					imageData: [data.imageData],
					ConversationId: parseInt(data.conversationID),
					UserId: parseInt(socket.request.session.passport.user)
				}).then(function (message) {
					objects.models.Conversation.findOne({
						where: {
							id: parseInt(data.conversationID)
						}
					}).then(function (conversation) {
						conversation.lastMessage = Date.now();
						conversation.save();

						socket.broadcast.emit('newMessage', message.toJSON());
					});
				});
			} else {
				// TODO: Handle socket non-auth error
			}
		});
	});
};
