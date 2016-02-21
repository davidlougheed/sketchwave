module.exports.controller = function (objects) {
	objects.router.get('/conversations', function (req, res) {
		res.render('conversations');
	});
    objects.router.get('/conversation', function (req, res) {
        res.render('conversation');
    });
	objects.router.get('/conversation_data', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send(''); // TODO: Handle non authentication
		}

		//TODO: Fetch conversations from database
		//objects.models.Conversations.findAll().then(function (conversations) {
		//    return conversations;
		//});
	});
};
