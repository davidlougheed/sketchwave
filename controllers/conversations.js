'use strict';

var sanitizeHtml = require('sanitize-html');
var async = require('async');
var appError = require('../modules/app-error');

module.exports.controller = function (objects) {
	objects.router.get('/conversations/', function (req, res) {
		if (!req.isAuthenticated()) {
			// TODO: Handle non-authentication more gracefully, perhaps with a login form + redirect
			return res.redirect('/login/?redirect=' + encodeURIComponent('/conversations/'));
		}

		res.render('conversations', { user: req.user });
	});
	objects.router.post('/conversations/', function (req, res) {
		//TODO: Handle errors properly
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/conversations/'));
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
								if(userJSON['avatar'] !== null) userJSON['avatar'] = users[u].avatar.toString();
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
			return res.redirect('/login/?redirect=' + encodeURIComponent('/conversation/' + req.params.id));
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
							conversationID: req.params.id
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

			objects.io.of('conversation' + conversation.id.toString())
				.emit('changeName', conversation.name);

			return res.send({ success: true });
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

							// Convert avatar from buffer to string
							if(userData['avatar'] !== null) userData['avatar'] = users[u].avatar.toString();

							// Delete password
							delete userData['password'];

							// Prevent XSS from username
							userData['username'] = sanitizeHtml(userData['username'], {
								allowedTags: [],
								allowedAttributes: []
							});

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
	objects.router.get('/conversation_data/:id/from/:from/count/:count/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle more gracefully
		}

		//TODO: Fetch conversations from database
		objects.models.Conversation.findOne({
			where: {
				id: parseInt(req.params.id)
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
						},
						order: '"createdAt" DESC',
						offset: parseInt(req.params.from),
						limit: parseInt(req.params.count)
					}).then(function (messages) {
						var messagesData = [];

						for(var m in messages) {
							if (messages.hasOwnProperty(m)) {
								var messageData = messages[m].toJSON();
								messageData['imageData'] = sanitizeHtml(messageData['imageData'], {
									allowedTags: [],
									allowedAttributes: []
								});
								messagesData.push(messageData);
							}
						}

						return res.send({ success: true, conversation: conversation, messages: messagesData });
					});
				} else {
					// User is not part of the conversation and should not be able to access data
					return res.send({ success: false, error: 'not_allowed' }); // TODO: Handle more gracefully
				}
			});
		});
	});

	// TODO: HANDLE 403 / AUTHENTICATION EXPIRY HERE!!!!!!!!!

	objects.io.on('connection', function (socket) {
		socket.on('userOnline', function (data) {
			objects.redis.sadd(['swUsersOnline', data], function(err, reply) {
				if (err) {
					throw err;
				}
			});
		});
		socket.on('userOffline', function (data) {
			objects.redis.srem(['swUsersOnline', data], function(err, reply) {
				if (err) {
					throw err;
				}
			});
		});

		socket.on('userAdd', function (data) {
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
						objects.models.User.findOne({
							where: {
								username: data.username
							}
						}).then(function (user) {
							if(user) {
								conversation.addUser(user);
								conversation.save();

								var userJSON = user.toJSON();
								delete userJSON['password'];

								// TODO: Add meta message to database

								objects.io.to('conversation' + data.conversationID.toString())
									.emit('userAdd', userJSON);
							}
						});
					}
				});
			});
		});
		socket.on('userRemove', function (data) {
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
						objects.models.User.findOne({
							where: {
								username: data.username
							}
						}).then(function (user) {
							if (user) {
								var userID = user.id;
								conversation.removeUser(user);

								// TODO: Add meta message to database

								objects.io.to('conversation' + data.conversationID.toString())
									.emit('userRemove', { id: userID, username: data.username });
							}
						});
					}
				});
			});
		});

		socket.on('userJoin', function (data) {
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
							.emit('userJoin', users[0].username);
					}
				});
			});
		});
		socket.on('userLeave', function (data) {
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
							.emit('userLeave', users[0].username);
					}
				});
			});
		});
	});
};
