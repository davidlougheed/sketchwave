module.exports.controller = function (objects) {
	objects.router.get('/conversations/', function (req, res) {
		res.render('conversations');
	});
	objects.router.post('/conversations/', function (req, res) {
		//TODO: Handle errors properly
		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

		if (!req.body) {
			return res.send('error no body');
		}

		var names = req.body.names.split(',');
		for(var n in names) {
			names[n] = names[n].trim();
		}

		objects.models.Conversation.create({
			name: req.body.name
		}).then(function (conversation) {
			objects.models.User.findAll({
				username: {
					$in: names
				}
			}).then(function (users) {
				conversation.setUsers(users).then(function () {
					return res.render('conversations');
				});
			});
		});

		return res.send('error creating conversation');
	});
	objects.router.get('/conversations_data/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

		objects.models.User.findOne({
			where: {
				id: req.user.id
			}
		}).then(function (user) {
			user.getConversations().then(function (conversations) {
				return res.send({ conversations: conversations });
			});
		});
	});

    objects.router.get('/conversation/:id/', function (req, res) {
		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

        res.render('conversation', { conversationID: req.params.id });
    });
	objects.router.get('/conversation_data/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send(''); // TODO: Handle non authentication
		}

		//TODO: Fetch conversations from database
		//TODO: MAKE IT SPECIFIC ON PERSON/OWNER!!!
		objects.models.Conversation.findOne({
			where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			objects.models.Message.findAll({
				where: {
					ConversationId: conversation.id
				}
			}).then(function (messages) {
				return res.send({ conversation: conversation, messages: messages });
			});
		});
	});
};
