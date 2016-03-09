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
				delete userData['password'];
                usersData[userData['id']] = userData;
            }

			return res.send({ success: true, users: usersData });
		});
	});
};
