module.exports.controller = function (objects) {
	objects.router.post('/stamp/', function (req, res) {
		//TODO: Handle errors properly

		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ error: 'not authenticated' }); // TODO: Handle non authentication
		}
		if (!req.body) {
			return res.send({ error: 'error no body' });
		}

		objects.models.Stamp.create({
			imageData: req.body.imageData,
			UserId: parseInt(req.user.id),
			ConversationId: parseInt(req.body.conversationID)
		}).then(function (message) {
			res.send({ success: true });
		});
	});

	objects.router.post('/stamps/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ error: 'not authenticated' }); // TODO: Handle non authentication
		}
		if (!req.body) {
			return res.send({ error: 'error no body' });
		}

        console.log(req.body.conversationID);

		objects.models.Stamp.findAll({
			where: {
				ConversationId: req.body.conversationID
			}
		}).then(function (stamps) {
			return res.send({ stamps: stamps });
		})
	});
};
