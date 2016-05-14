'use strict';

var sanitizeHtml = require('sanitize-html');

var HtmlEntities = require('html-entities').AllHtmlEntities;
var entities = new HtmlEntities();

module.exports.controller = function (objects) {
	objects.router.get('/users_data/', function (req, res) {
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

					// TODO: Convert this to a shared function
					// Convert avatar from buffer to string
					if (userData['avatar'] !== null) userData['avatar'] = users[u].avatar.toString();

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
			attributes: { exclude: ['password'] },
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

	objects.router.get('/user/:id/', function (req, res) {
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/user/' + req.params.id));
		}

		objects.models.User.findOne({
			where: {
				id: req.params.id
			},
			attributes: { exclude: ['password'] }
		}).then(function (user) {
			var userData = user.toJSON();

			res.render('user', {
				user: req.user, // The currently signed-in user
				profile: userData // User who's profile someone is viewing
			});
		});
	});

	objects.router.get('/user/:id/avatar/', function (req, res) {
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
				userData.avatar = userData.avatar.toString()
					.replace('data:image/png;base64,', '');
				var newBuffer = new Buffer(userData.avatar, 'base64');
				return res.send(newBuffer);
			}

			return res.send(null);
		});
	});

	objects.router.post('/user/:id/avatar/', function (req, res) {
		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.models.User.findOne({
			where: {
				id: parseInt(req.params.id)
			},
			attributes: { include: ['id', 'avatar'] }
		}).then(function (user) {
			// Prevent XSS
			user.avatar = sanitizeHtml(req.body.imageData, {
				allowedTags: [],
				allowedAttributes: []
			});

			user.save();

			return res.send({ success: true });
		});
	});
};
