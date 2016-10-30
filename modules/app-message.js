'use strict';

var sanitizeHtml = require('sanitize-html');

module.exports.ACTION_USER_LEFT = 'userLeft';
module.exports.ACTION_USER_REMOVED = 'userRemoved';
module.exports.ACTION_USER_JOINED = 'userJoined';
module.exports.ACTION_USER_ADDED = 'userAdded';

module.exports.ACTION_NAME_CHANGED = 'nameChanged';
module.exports.ACTION_CLAIMED = 'claimed';

module.exports.TYPE_IMAGE = 'image';
module.exports.TYPE_TEXT = 'text';
module.exports.TYPE_META = 'meta';

module.exports.create = function (objects, socket, conversationID, data, type, metaData) {
	metaData = metaData || {};

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
				var messageCreationData = {
					type: type,
					ConversationId: parseInt(conversationID),
					UserId: parseInt(socket.request.session.passport.user)
				};

				switch (type) {
					case 'image':
						var imageString = sanitizeHtml(data.replace('data:image/png;base64,', ''), {
							allowedTags: [],
							allowedAttributes: []
						}).toString();
						var imageBuffer = Buffer.from(imageString, 'base64');
						messageCreationData.imageData2 = [imageBuffer];
						break;
					case 'text':
						messageCreationData.textData = sanitizeHtml(data);
						break;
					case 'meta':
						messageCreationData.metaData = {
							action: metaData.action
						};

						switch (metaData.action) {
							case module.exports.ACTION_USER_LEFT:
							case module.exports.ACTION_USER_REMOVED:
							case module.exports.ACTION_USER_JOINED:
							case module.exports.ACTION_USER_ADDED:
								messageCreationData.metaData['subject'] = metaData.subject;
								break;
							case module.exports.ACTION_NAME_CHANGED:
								messageCreationData.metaData['name'] = metaData.name;
								break;
						}

						break;
				}

				objects.models.Message.create(messageCreationData).then(function (message) {
					conversation.lastMessage = Date.now();
					conversation.save();

					var expandedMessage = message.toJSON();
					expandedMessage.imageData = [];
					delete expandedMessage.imageData2;
					for (var i in message.imageData2) {
						if (message.imageData2.hasOwnProperty(i)) {
							expandedMessage.imageData.push('data:image/png;base64,' +
								message.imageData2[i].toString('base64'));
						}
					}

					socket.broadcast.to('conversation' + conversationID.toString())
						.emit('newMessage', expandedMessage);
				});
			}
		});
	});
};
