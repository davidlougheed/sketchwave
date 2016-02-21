module.exports.controller = function (objects) {
	objects.router.get('/conversations/', function (req, res) {
		//TODO: Handle errors properly
		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

		res.render('conversations', { user: req.user });
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
		names.push(req.user.username);

		objects.models.Conversation.create({
			name: req.body.name
		}).then(function (conversation) {
			objects.models.User.findAll({
				where: {
					username: {
						$in: names
					}
				}
			}).then(function (users) {
				conversation.setUsers(users).then(function () {
					return res.render('conversations', { user: req.user });
				});
			});
		});
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

        res.render('conversation', { user: req.user, conversationID: req.params.id });
    });
	objects.router.put('/conversation/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

		objects.models.Conversation.findOne({where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			conversation.name = req.body.name;
			conversation.save();

			return res.send({ success: true });
		});
	});
	objects.router.delete('/conversation/:id/', function (req, res) {
		//TODO: CONFIRM DELETE HAS CORRECT OWNER

		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

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
				for(var m in messages) {
					messages[m].destroy();
				}
			});

			conversation.destroy();

			return res.send({ success: true });
		});
	});
	objects.router.get('/conversation_users/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

		objects.models.Conversation.findOne({
			where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			conversation.getUsers().then(function (users) {
				var usersData = [];

				for(var u in users) {
					var userData = users[u].toJSON();
					delete userData['password'];
					usersData.push(userData);
				}

				return res.send({ conversationID: req.params.id, users: usersData });
			});
		});
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
