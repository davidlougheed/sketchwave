module.exports.controller = function (objects) {
	objects.router.post('/stamp/', function (req, res) {
		//TODO: Handle errors properly

		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}
		if (!req.body) {
			return res.send({ success: false, error: 'no_body' });
		}

		// TODO: Authenticate user for stamp creation!!!

		objects.models.Stamp.create({
			imageData: req.body.imageData,
			UserId: parseInt(req.user.id),
			ConversationId: parseInt(req.body.conversationID)
		}).then(function (stamp) {
			socket.broadcast.to('conversation' + req.body.conversationID.toString())
				.emit('addStamp', stamp.toJSON());
			res.send({ success: true });
		});
	});
	objects.router.delete('/stamp/:id/', function (req, res) {
		//TODO: Handle errors properly
		//TODO: DONT LET YOU DELETE UNLESS YOU HAVE PERMISSION!!!!!!

		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}
		if (!req.body) {
			return res.send({ success: false, error: 'no_body' });
		}

		objects.models.Stamp.findOne({
			where: {
				id: parseInt(req.params.id)
			}
		}).then(function (stamp) {
			if(stamp.UserId != req.user.id) {
				return res.send({ success: false, error: 'wrong person' });
			}

			stamp.destroy();

			// TODO: emit a stamp destroy socket message

			return res.send({ success: true });
		});
	});

	objects.router.post('/stamps/', function (req, res) {
		res.setHeader('Content-Type', 'application/json');

		if(!req.isAuthenticated()) {
			return res.send({ success: false, error: 'not_authenticated' }); // TODO: Handle non authentication
		}
		if (!req.body) {
			return res.send({ success: false, error: 'no_body' });
		}

		objects.models.Stamp.findAll({
			where: {
				ConversationId: req.body.conversationID
			}
		}).then(function (stamps) {
			return res.send({ success: true, stamps: stamps });
		})
	});
};
