'use strict';

module.exports.controller = function (objects) {
	objects.router.get('/users_data/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.models.User.findAll().then(function (users) {
            //TODO: THIS HECKING SUCKS... BUT HOW???
            var usersData = {};

            for(var u in users) {
                var userData = users[u].toJSON();
				if(userData['avatar'] !== null) userData['avatar'] = users[u].avatar.toString();
				delete userData['password'];
                usersData[userData['id']] = userData;
            }

			return res.send({ success: true, users: usersData });
		});
	});

	objects.router.get('/user/:id/', function (req, res) {
		if (!req.isAuthenticated()) {
			return res.redirect('/login/?redirect=' + encodeURIComponent('/user/' + req.params.id));
		}

		objects.models.User.findOne({where: {
			id: req.params.id
		}
		}).then(function (user) {
			var userJSON = user.toJSON();
			delete userJSON['password'];
			res.render('user', {
				user: req.user, // The currently signed-in user
				profile: userJSON // User who's profile someone is viewing
			});
		});
	});

	objects.router.post('/user/:id/avatar/', function (req, res) {
		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}

		objects.models.User.findOne({where: {
			id: parseInt(req.params.id)
		}
		}).then(function (user) {
			if(req.user.id == req.params.id) {
				user.avatar = req.body.imageData;
				user.save();

				return res.send({ success: true });
			}

			return res.send({ success: false });
		});
	});
};
