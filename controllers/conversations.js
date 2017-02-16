'use strict';

var async = require('async');
var csurf = require('csurf');

// App-specific modules
var appError = require('../modules/app-error');
var appMessage = require('../modules/app-message');

var HtmlEntities = require('html-entities').AllHtmlEntities;
var entities = new HtmlEntities();

module.exports.controller = function (objects) {
	// Shows a list of conversations.
	objects.router.get('/conversations/', objects.csrfProtection, function (req, res) {
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/conversations/'));
		}

		res.render('conversations', { user: req.user, csrfToken: req.csrfToken() });
	});

	// Creates a conversation if the user is authenticated.
	objects.router.post('/conversations/', objects.csrfProtection, function (req, res) {
		//TODO: Handle errors properly
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/conversations/'));
		}

		if (!req.body) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {});
		}
		if (req.body.name.trim().length == 0) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {});
		}

		var names = req.body.names || [];
		names.push(req.user.id);
		names.map(parseInt);

		objects.models.Conversation.create({
			name: req.body.name.trim()
		}).then(function (conversation) {
			objects.models.User.findAll({
				where: {
					id: { $in: names }
				}
			}).then(function (users) {
				conversation.setUsers(users).then(function () {
					conversation.setOwner(req.user).then(function () {
						return res.render('conversations', {user: req.user, csrfToken: req.csrfToken()});
					});
				});
			});
		});
	});

	// Get conversations data.
	objects.router.get('/conversations_data/', function (req, res) {
		if (!req.isAuthenticated()) {
			return appError.generate(req, res, appError.ERROR_FORBIDDEN, {}); // TODO: Handle non authentication
		}

		res.setHeader('Content-Type', 'application/json');

		objects.models.User.findOne({
			where: {
				id: req.user.id
			}
		}).then(function (user) {
			user.getConversations().then(function (conversations) {
				conversations.sort(function (a, b) {
					if (a['lastMessage'] < b['lastMessage']) return 1;
					if (a['lastMessage'] > b['lastMessage']) return -1;

					return 0;
				});

				var usersList = [];

				async.eachSeries(conversations, function (conversation, callback) {
					conversation.getUsers({
						attributes: ['id', 'username'],
						order: [['username', 'ASC']]
					}).then(function (users) {
						var userList = [];
						for (var u in users) {
							if (users.hasOwnProperty(u)) {
								var userData = users[u].toJSON();

								// Prevent XSS from username
								userData['username'] = entities.encode(userData['username']);

								userList.push(userData);
							}
						}
						usersList.push(userList);
						callback();
					});
				}, function (err) {
					if (err) {
						console.error(err);
						return appError.generate(req, res, appError.ERROR_INTERNAL_SERVER, {});
					}

					return res.send({ conversations: conversations, users: usersList });
				});
			});
		});
	});

	// Shows a specific conversation if the user is part of it.
    objects.router.get('/conversations/:id/', function (req, res) {
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/conversations/' + req.params.id));
		}
		if (isNaN(parseInt(req.params.id))) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {}, appError.MESSAGE_INVALID_ID);
		}

		objects.models.Conversation.findOne({
			where: {
				id: parseInt(req.params.id)
			}
		}).then(function (conversation) {
			if (conversation) {
				conversation.getUsers({
					where: {id: req.user.id}
				}).then(function (users) {
					if (users != null && users.length > 0) {
						res.render('conversation', {
							user: req.user,
							conversation: conversation
						});
					} else {
						return appError.generate(req, res, appError.ERROR_FORBIDDEN, {});
					}
				});
			} else {
				return appError.generate(req, res, appError.ERROR_NOT_FOUND, {});
			}
		});
    });

    // Delete a conversation.
	objects.router.delete('/conversations/:id/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if (!req.isAuthenticated()) {
			return appError.generate(req, res, appError.ERROR_FORBIDDEN, {});
		}
		if (!parseInt(req.params.id)) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {}, appError.MESSAGE_INVALID_ID);
		}

		objects.models.Conversation.findOne({
			where: {
				id: parseInt(req.params.id)
			}
		}).then(function (conversation) {
			if (conversation == null) {
				return appError.generate(req, res, appError.ERROR_NOT_FOUND, {});
			}
			conversation.getOwner().then(function (owner) {
				if (owner == null || owner.id == req.user.id) {
					conversation.getUsers({
						where: { id: req.user.id },
						attributes: ['id']
					}).then(function (users) {
						if (users != null && users.length > 0) {
							objects.models.Message.findAll({
								where: {
									ConversationId: conversation.id
								}
							}).then(function (messages) {
								for (var m in messages) {
									if (messages.hasOwnProperty(m)) {
										messages[m].destroy();
									}
								}
							});

							conversation.destroy();

							return res.send({ success: true });
						} else {
							// If the user is not part of the conversation, block the action.
							return appError.generate(req, res, appError.ERROR_FORBIDDEN, {});
						}
					});
				} else {
					// If there is an owner and the current user is not the owner, block the action.
					return appError.generate(req, res, appError.ERROR_FORBIDDEN, {});
				}
			});
		});
	});

	// Get all users in a conversation.
	objects.router.get('/conversations/:id/users/', function (req, res) {
		if (!req.isAuthenticated()) {
			return appError.generate(req, res, appError.ERROR_FORBIDDEN, {}, appError.MESSAGE_NOT_AUTHENTICATED);
		}
		if (!parseInt(req.params.id)) {
			return appError.generate(req, res, appError.ERROR_BAD_REQUEST, {}, appError.MESSAGE_INVALID_ID);
		}

		res.setHeader('Content-Type', 'application/json');

		objects.models.Conversation.findOne({
			where: {
				id: parseInt(req.params.id)
			}
		}).then(function (conversation) {
			// TODO: Optimize this so it's not making 2 queries to DB?
			conversation.getUsers({
				where: {
					id: req.user.id
				}
			}).then(function (users) {
				if (users != null && users.length > 0) {
					conversation.getUsers({
						order: [['username', 'ASC']],
						attributes: { exclude: ['avatar', 'avatarThumb', 'password'] }
					}).then(function (users) {
						var usersData = [];

						for (var u in users) {
							if (users.hasOwnProperty(u)) {
								var userData = users[u].toJSON();

								// Prevent XSS from username
								userData['username'] = entities.encode(userData['username']);

								usersData.push(userData);
							}
						}

						return res.send({ success: true, conversationID: req.params.id, users: usersData });
					});
				} else {
					// User is not part of the conversation and should not be able to access data
					return appError.generate(req, res, appError.ERROR_FORBIDDEN, {}); // TODO: message field in meta
				}
			});
		});
	});
	objects.router.get('/conversations/:id/data/from/:from/count/:count/', function (req, res) {
		if (!req.isAuthenticated()) {
			return appError.generate(req, res, appError.ERROR_FORBIDDEN, {}, appError.MESSAGE_NOT_AUTHENTICATED);
		}
		if (!parseInt(req.params.id)) {
			return appError.generate(req, res, appError.ERROR_FORBIDDEN, {}, appError.MESSAGE_INVALID_ID);
		}

		res.setHeader('Content-Type', 'application/json');

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
					return objects.models.Message.findAll({
						where: {
							ConversationId: conversation.id
						},
						order: '"createdAt" DESC',
						offset: parseInt(req.params.from),
						limit: parseInt(req.params.count)
					});
				} else {
					// User is not part of the conversation and should not be able to access data
					appError.generate(req, res, appError.ERROR_FORBIDDEN, {}); // TODO: message field in meta
				}
			}).then(function (messages) {
				var expandedMessages = [];
				for (var m in messages) {
					if (messages.hasOwnProperty(m)) {
						var expandedMessage = messages[m].toJSON();
						if (messages[m].type != 'image') {
							expandedMessage.imageData = [];
							for (var i in messages[m].imageData2) {
								if (messages[m].imageData2.hasOwnProperty(i)) {
									expandedMessage.imageData.push('data:image/png;base64,' +
										messages[m].imageData2[i].toString('base64'));
								}
							}
						} else {
							// Fetched via URL. Don't need to send; this will speed display up a bit.
							delete expandedMessage.imageData;
						}
						delete expandedMessage.imageData2;
						expandedMessages.push(expandedMessage);
					}
				}
				res.send({ success: true, conversation: conversation, messages: expandedMessages });
			});
		});
	});

	// TODO: HANDLE 403 / AUTHENTICATION EXPIRY HERE!!!!!!!!!

	objects.io.on('connection', function (socket) {
		// Change the name of a conversation.
		socket.on('changeName', function (data) {
			objects.models.Conversation.findOne({
				where: {
					id: parseInt(data.conversationID)
				}
			}).then(function (conversation) {
				return conversation.getUsers({
					where: {
						id: socket.request.session.passport.user
					},
					attributes: ['id']
				}).then(function (users) {
					if (users != null && users.length > 0) {
						if (data.newName.trim().length > 0) {
							conversation.name = entities.encode(data.newName.trim());
							conversation.save();

							objects.io.to('conversation' + conversation.id.toString())
								.emit('changeName', conversation.name);

							appMessage.create(objects, socket, conversation.id, null, appMessage.TYPE_META, {
								action: appMessage.ACTION_NAME_CHANGED,
								name: conversation.name
							}, true);
						}
					} else {
						// TODO: Throw a forbidden-esque error
					}
				});
			});
		});

		// Add a user to a conversation.
		socket.on('userAdd', function (data) {
			objects.models.Conversation.findOne({
				where: {
					id: parseInt(data.conversationID)
				}
			}).then(function (conversation) {
				conversation.getUsers({
					where: {
						id: socket.request.session.passport.user
					},
					attributes: ['id']
				}).then(function (users) {
					if (users != null && users.length > 0) {
						objects.models.User.findOne({
							where: {
								id: data.userID
							},
							attributes: { exclude: ['password'] }
						}).then(function (user) {
							if (user) {
								conversation.addUser(user);
								conversation.save();

								var userData = user.toJSON();

								// Prevent XSS from username
								userData['username'] = entities.encode(userData['username']);

								objects.io.to('conversation' + data.conversationID.toString())
									.emit('userAdd', userData);

								appMessage.create(objects, socket, data.conversationID, null, appMessage.TYPE_META, {
									action: appMessage.ACTION_USER_ADDED,
									subject: user.id
								}, true);
							}
						});
					} else {
						// TODO: Throw a forbidden-esque error
					}
				});
			});
		});

		// Remove a user from a conversation.
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
							},
							attributes: { exclude: ['password', 'avatar'] }
						}).then(function (user) {
							if (user) {
								if (users[0].id == conversation.OwnerId || conversation.OwnerId == null) {
									var userId = user.id;
									conversation.removeUser(user);

									if (conversation.OwnerId == userId) {
										conversation.OwnerId = null;
										conversation.save();
									}

									objects.io.to('conversation' + data.conversationID.toString())
										.emit('userRemove', {id: userId, username: data.username});

									appMessage.create(objects, socket, data.conversationID, null, appMessage.TYPE_META, {
										action: appMessage.ACTION_USER_REMOVED,
										subject: userId
									}, true);
								} else {
									// TODO: Throw a forbidden-esque error
								}
							}
						});
					} else {
						// TODO: Throw a forbidden-esque error
					}
				});
			});
		});

		socket.on('userJoin', function (conversationID) {
			// TODO: Send user connect message, handle online/offline stuff...
			// TODO: Cache conversation data FOR ALL APP!!! SO THAT NOT SO MANY DB REQUESTS ARE MADE

			objects.models.Conversation.findOne({
				where: {
					id: parseInt(conversationID)
				}
			}).then(function (conversation) {
				conversation.getUsers({
					where: {
						id: socket.request.session.passport.user
					}
				}).then(function (users) {
					if (users != null && users.length > 0) {
						socket.join('conversation' + conversationID.toString());

						socket.broadcast.to('conversation' + conversationID.toString())
							.emit('userJoin', users[0].username);
					} else {
						// TODO: Throw a forbidden-esque error
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
					} else {
						// TODO: Throw a forbidden-esque error
					}
				});
			});
		});

		// Claim a conversation for a user.
		socket.on('claimConversation', function (conversationID) {
			objects.models.Conversation.findOne({
				where: {
					id: parseInt(conversationID)
				}
			}).then(function (conversation) {
				// TODO: Is this request really needed?
				conversation.getUsers({
					where: {
						id: socket.request.session.passport.user
					}
				}).then(function (users) {
					if (users != null && users.length > 0) {
						conversation.getOwner().then(function (owner) {
							if (owner == null) {
								// Conversation is OK to claim, since there is no set owner.
								conversation.setOwner(users[0]).then(function () {
									objects.io.in('conversation' + conversation.id.toString())
										.emit('claimConversation', users[0].id);
									appMessage.create(objects, socket, conversationID, null, appMessage.TYPE_META, {
										action: appMessage.ACTION_CLAIMED
									}, true);
								});
							} else {
								// TODO: Send bad request error.
							}
						});
					} else {
						// TODO: Throw a forbidden-esque error.
					}
				});
			});
		});
	});
};
