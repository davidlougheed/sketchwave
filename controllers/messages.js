module.exports.controller = function (objects) {
	objects.router.post('/message/', function (req, res) {
		//TODO: Handle errors properly

		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ error: 'not authenticated' }); // TODO: Handle non authentication
		}

		if (!req.body) {
			return res.send({ error: 'error no body' });
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
		// TODO: HOW TO AUTHENTICATE?

		socket.on('addUser', function (userID) {
			socket.userID = userID;
		});

		socket.on('newMessage', function (data) {
			objects.models.Message.create({
				imageData: [data.imageData],
				ConversationId: parseInt(data.conversationID),
				UserId: parseInt(socket.userID)
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
		});
	});
};
