'use strict';

var sanitizeHtml = require('sanitize-html');
var sharp = require('sharp');

var HtmlEntities = require('html-entities').AllHtmlEntities;
var entities = new HtmlEntities();

module.exports.controller = function (objects) {
	objects.router.get('/users/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.models.User.findAll({
			attributes: { exclude: ['password'] }
		}).then(function (users) {
            //TODO: THIS HECKING SUCKS... BUT HOW???
            var usersData = {};

            for(var u in users) {
				if(users.hasOwnProperty(u)) {
					var userData = users[u].toJSON();

					// Convert avatar from buffer to string
					if (userData['avatar'] !== null) {
						if (userData['avatar'].indexOf('data:image/png;base64,') == -1) {
							// New Avatar Storage System
							userData.avatar = 'data:image/png;base64,' + userData.avatar.toString('base64');
						} else {
							// Old Avatar Storage System
							userData['avatar'] = users[u].avatar.toString();
						}
					}

					// Prevent XSS from username
					userData['username'] = entities.encode(userData['username']);

					usersData[userData['id']] = userData;
				}
            }

			return res.send({ success: true, users: usersData });
		});
	});
	objects.router.get('/users_search/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		var searchTerm = req.query.q;

		objects.models.User.findAll({
			attributes: { exclude: ['avatar', 'avatarThumb', 'password'] },
			where: {
				username: {
					$like: '%' + searchTerm + '%'
				}
			}
		}).then(function (users) {
			// TODO: Only include data that is needed for searching
			var usersData = [];

			for(var u in users) {
				if(users.hasOwnProperty(u)) {
					var userData = users[u].toJSON();

					// TODO: Convert this to a shared function
					// Convert avatar from buffer to string
					if (userData['avatar'] !== null) userData['avatar'] = users[u].avatar.toString();

					// Prevent XSS from username
					userData['username'] = entities.encode(userData['username']);

					usersData.push(userData);
				}
			}

			return res.send({ success: true, users: usersData });
		});
	});

	objects.router.get('/users/:id/', function (req, res) {
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/users/' + req.params.id));
		}

		objects.models.User.findOne({
			where: {
				id: req.params.id
			},
			attributes: { exclude: ['password'] }
		}).then(function (user) {
			var userData = user.toJSON();

			if (userData.avatar.toString().indexOf('data:image/png;base64,') == -1) {
				// New Avatar Storage System
				userData.avatar = 'data:image/png;base64,' + userData.avatar.toString('base64');
			} else {
				// Old Avatar Storage System
				userData.avatar = userData.avatar.toString();
			}

			res.render('user', {
				user: req.user, // The currently signed-in user
				profile: userData // User who's profile someone is viewing
			});
		});
	});

	objects.router.get('/users/:id/avatar/', function (req, res) {
		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		res.header('Content-Type', 'image/png');

		objects.models.User.findOne({
			where: {
				id: parseInt(req.params.id)
			},
			attributes: ['id', 'avatar']
		}).then(function (user) {
			var userData = user.toJSON();
			if(userData.avatar !== null) {
				if (userData.avatar.indexOf('data:image/png;base64,') == -1) {
					// New Avatar Storage System
					return res.send(user.avatar);
				} else {
					// Old Avatar Storage System
					userData.avatar = userData.avatar.toString()
						.replace('data:image/png;base64,', '');
					var newBuffer = new Buffer(userData.avatar, 'base64');
					return res.send(newBuffer);
				}
			}

			return res.send(null);
		});
	});

	objects.router.get('/users/:id/avatar/thumb/', function (req, res) {
		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		res.header('Content-Type', 'image/png');

		var userId = parseInt(req.params.id);
		if (isNaN(userId)) {
			userId = -1;
		}

		objects.models.User.findOne({
			where: {
				id: userId
			},
			attributes: ['id', 'avatarThumb']
		}).then(function (user) {
			if (user) {
				var userData = user.toJSON();
				if (userData.avatarThumb !== null) {
					return res.send(user.avatarThumb);
				} else {
					// Duplicate query to avoid fetching the big avatar if we don't have to.
					objects.models.User.findOne({
						where: {
							id: parseInt(req.params.id)
						},
						attributes: ['id', 'avatar']
					}).then(function (user) {
						if (user.avatar != null) {
							if (user.avatar.indexOf('data:image/png;base64,') == -1) {
								// New Avatar Storage System
								sharp(user.avatar).resize(108, 108).toBuffer().then(function (data) {
									return res.send(data);
								});
							} else {
								// Old Avatar Storage System
								var userAvatar = user.avatar.toString()
									.replace('data:image/png;base64,', '');
								var newBuffer = new Buffer(userAvatar, 'base64');
								sharp(newBuffer).resize(108, 108).toBuffer().then(function (data) {
									return res.send(data);
								});
							}
						}
					});
				}
			} else {
				return res.send();
			}
		});
	});

	objects.router.post('/users/:id/avatar/', function (req, res) {
		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.models.User.findOne({
			where: {
				id: parseInt(req.params.id)
			},
			attributes: ['id', 'avatar', 'avatarThumb']
		}).then(function (user) {
			// Prevent XSS
			var userAvatar = Buffer.from(sanitizeHtml(req.body.imageData.replace('data:image/png;base64,', ''), {
				allowedTags: [],
				allowedAttributes: []
			}).toString(), 'base64');
			user.avatar = userAvatar;
			sharp(userAvatar).resize(108, 108).toBuffer().then(function (data) {
				user.avatarThumb = data;
				user.save();
				return res.send({ success: true });
			});
		});
	});

	objects.router.get('/users/:id/status/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.redis.sismember(['swUsersOnline', parseInt(req.params.id)], function (err, reply) {
			if (reply === 1) {
				return res.send({ 'online': true });
			} else {
				return res.send({ 'online': false });
			}
		});
	});

	objects.io.on('connection', function (socket) {
		socket.on('userOnline', function () {
			objects.redis.sadd(['swUsersOnline', socket.request.session.passport.user], function (err, reply) {
				if (err) {
					throw err;
				}
			});
		});
		socket.on('disconnect', function () {
			objects.redis.srem(['swUsersOnline', socket.request.session.passport.user], function (err, reply) {
				if (err) {
					throw err;
				}
			});
		});
	});
};
