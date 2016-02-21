module.exports.controller = function (objects) {
    objects.router.post('/message/', function (req, res) {
        //TODO: Handle errors properly

        res.setHeader('Content-Type', 'application/json');

        if(!req.isAuthenticated()) {
            return res.send({ error: 'not authenticated' }); // TODO: Handle non authentication
        }

        if (!req.body) {
            return res.send({ error: 'error no body' });
        }

        objects.models.Message.create({
            imageData: [req.body.imageData],
            ConversationId: parseInt(req.body.conversationID),
            UserId: parseInt(req.user.id)
        }).then(function (message) {
            res.send({ success: true });
        });
    });
};
