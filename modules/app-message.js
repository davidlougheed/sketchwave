'use strict';

var sanitizeHtml = require('sanitize-html');

module.exports.ACTION_USER_LEFT = 'userLeft';
module.exports.ACTION_USER_REMOVED = 'userRemoved';
module.exports.ACTION_USER_JOINED = 'userJoined';
module.exports.ACTION_USER_ADDED = 'userAdded';

module.exports.ACTION_NAME_CHANGED = 'nameChanged';
module.exports.ACTION_CLAIMED = 'claimed';

module.exports.TYPE_IMAGE = 'image';
module.exports.TYPE_ANIMATION = 'animation';
module.exports.TYPE_TEXT = 'text';
module.exports.TYPE_META = 'meta';

/**
 * Creates a SketchWave message.
 * @param objects {object} - A collection of shared objects to be used for server tasks.
 * @param socket {object} - A socket.io socket object.
 * @param conversationID {number} - The ID of the conversation to send the message to.
 * @param data {object} - Message data.
 * @param type {string} - Message type.
 * @param metaData {object} - Message metadata.
 * @param toAll {boolean} - Whether to send the message to everyone (including the sender) or not.
 */
module.exports.create = function (objects, socket, conversationID, data, type, metaData, toAll) {
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

				var buf;
				switch (type) {
					case 'image':
						buf = Buffer.from(sanitizeHtml(data.replace('data:image/png;base64,', ''), {
							allowedTags: [],
							allowedAttributes: []
						}).toString(), 'base64');
						messageCreationData.imageData2 = [buf];
						break;
					case 'animation':
						var animationFrames = [];
						for (var f in data) {
							if (data.hasOwnProperty(f)) {
								if (data[f]) {
									buf = Buffer.from(sanitizeHtml(data[f].replace('data:image/png;base64,', ''), {
										allowedTags: [],
										allowedAttributes: []
									}).toString(), 'base64');
								}
								animationFrames.push(buf);
							}
						}
						messageCreationData.imageData2 = animationFrames;
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
					for (var i in expandedMessage.imageData2) {
						if (expandedMessage.imageData2.hasOwnProperty(i)) {
							expandedMessage.imageData.push('data:image/png;base64,' +
								expandedMessage.imageData2[i].toString('base64'));
						}
					}
					delete expandedMessage.imageData2;

					if (toAll) {
						objects.io.to('conversation' + conversationID.toString())
							.emit('newMessage', expandedMessage);
					} else {
						socket.broadcast.to('conversation' + conversationID.toString())
							.emit('newMessage', expandedMessage);
					}
				});
			}
		});
	});
};
