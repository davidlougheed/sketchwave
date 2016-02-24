module.exports.controller = function (objects) {
	objects.router.get('/users_data/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send('not authenticated'); // TODO: Handle non authentication
		}

		objects.models.User.findAll().then(function (users) {
            //TODO: THIS HECKING SUCKS
            var usersData = {};

            for(var u in users) {
                var userData = users[u].toJSON();
                usersData[userData['id']] = userData;
            }

			return res.send({users: usersData});
		});
	});
};
