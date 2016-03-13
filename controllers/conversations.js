var async = require('async');
var appError = require('../modules/app-error');

module.exports.controller = function (objects) {
	objects.router.get('/conversations/', function (req, res) {
		if (!req.isAuthenticated()) {
			// TODO: Handle non-authentication more gracefully, perhaps with a login form + redirect
			return appError.generate(req, res, 403, {});
		}

		res.render('conversations', { user: req.user });
	});
	objects.router.post('/conversations/', function (req, res) {
		//TODO: Handle errors properly
		if (!req.isAuthenticated()) {
			return appError.generate(req, res, 403, {});
		}
		if (!req.body) {
			return res.send('error no body');
		}

		var names = req.body.names || [];
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
			return appError.generate(req, res, 403, {}); // TODO: Handle non authentication
		}

		objects.models.User.findOne({
			where: {
				id: req.user.id
			}
		}).then(function (user) {
			user.getConversations().then(function (conversations) {
				conversations.sort(function (a, b) {
					if(a['lastMessage'] < b['lastMessage']) return 1;
					if(a['lastMessage'] > b['lastMessage']) return -1;

					return 0;
				});

				var usersList = [];

				async.eachSeries(conversations, function(conversation, callback) {
					conversation.getUsers().then(function (users) {
						var userList = [];
						for(var u in users) {
							if (users.hasOwnProperty(u)) {
								var userJSON = users[u].toJSON();
								delete userJSON['password'];
								userList.push(userJSON);
							}
						}
						usersList.push(userList);
						callback();
					});
				}, function (err) {
					return res.send({ conversations: conversations, users: usersList });
				});
			});
		});
	});

    objects.router.get('/conversation/:id/', function (req, res) {
		if (!req.isAuthenticated()) {
			// TODO: Handle non-authentication more gracefully, perhaps with a login form + redirect
			return appError.generate(req, res, 403, {});
		}

		objects.models.Conversation.findOne({where: {
			id: req.params.id
		}
		}).then(function (conversation) {
			objects.models.User.findOne({
				where: {
					id: req.user.id
				}
			}).then(function (user) {
				conversation.getUsers().then(function (users) {
					var permission = false;
					for(var u in users) {
						if(user.id == (users[u].toJSON())['id']) {
							permission = true;
						}
					}

					if(!permission) {
						return res.send('no permission');
					} else {
						res.render('conversation', {
							user: req.user,
							conversationID: req.params.id,
						});
					}
				});
			});
		});
    });
	objects.router.put('/conversation/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return appError.generate(req, res, 403, {});
		}
		if (!req.body) {
			return res.send('error no body');
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
	objects.router.put('/conversation_users/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return appError.generate(req, res, 403, {});
		}
		if (!req.body) {
			return res.send({error: 'no-body'});
		}

		objects.models.Conversation.findOne({where: {
			id: req.params.id
		}
		}).then(function (conversation) {
			objects.models.User.findOne({
				where: {
					username: req.body.username
				}
			}).then(function (user) {
				if(user) {
					conversation.addUser(user);

					return res.send({success: true});
				} else {
					return res.send({success: false});
				}
			});
		});
	});
	objects.router.delete('/conversation_users/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return res.send({error: 'not_authenticated'}); // TODO: Handle non authentication
		}
		if (!req.body) {
			return res.send({error: 'no_body'});
		}

		objects.models.Conversation.findOne({
			where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			objects.models.User.findOne({
				where: {
					username: req.body.username
				}
			}).then(function (user) {
				if(user) {
					conversation.removeUser(user);

					return res.send({ success: true });
				} else {
					return res.send({ success: false });
				}
			});
		});
	});
	objects.router.delete('/conversation/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return appError.generate(req, res, 403, {});
		}

		objects.models.Conversation.findOne({
			where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			if(conversation == null) {
				return res.send({ success: false });
			}

			conversation.getUsers({
				where: {
					id: req.user.id
				}
			}).then(function (users) {
				if (users != null && users.length > 0) {
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
				} else {
					// User is not part of the conversation and should not be able to delete it
					return res.send({ success: false, error: 'not_allowed' }); // TODO: Handle more gracefully
				}
			});
		});
	});
	objects.router.get('/conversation_users/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return res.send({ error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.models.Conversation.findOne({
			where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			// TODO: Optimize this so it's not making 2 queries to DB?
			conversation.getUsers({
				where: {
					id: req.user.id
				}
			}).then(function (users) {
				if(users != null && users.length > 0) {
					conversation.getUsers().then(function (users) {
						var usersData = [];

						for(var u in users) {
							var userData = users[u].toJSON();
							delete userData['password'];
							usersData.push(userData);
						}

						return res.send({ success: true, conversationID: req.params.id, users: usersData });
					});
				} else {
					// User is not part of the conversation and should not be able to access data
					return res.send({ success: false, error: 'not_allowed' }); // TODO: Handle more gracefully
				}
			});
		});
	});
	objects.router.get('/conversation_data/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle more gracefully
		}

		//TODO: Fetch conversations from database
		objects.models.Conversation.findOne({
			where: {
				id: req.params.id
			}
		}).then(function (conversation) {
			conversation.getUsers({
				where: {
					id: req.user.id
				}
			}).then(function (users) {
				if (users != null && users.length > 0) {
					objects.models.Message.findAll({
						where: {
							ConversationId: conversation.id
						}
					}).then(function (messages) {
						return res.send({ success: true, conversation: conversation, messages: messages });
					});
				} else {
					// User is not part of the conversation and should not be able to access data
					return res.send({ success: false, error: 'not_allowed' }); // TODO: Handle more gracefully
				}
			});
		});
	});

	objects.io.on('connection', function (socket) {
		socket.on('userOnline', function (data) {

		});
		socket.on('userOffline', function (data) {

		});

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
	});
};
