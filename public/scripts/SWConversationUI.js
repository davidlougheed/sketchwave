'use strict';

/**
 * Handles the SketchWave conversation user interface.
 * @param currentUser {object} - The object containing user data from the server.
 * @param conversation {object} - The object containing conversation data from the server.
 * @constructor
 */
var SWConversationUI = function (currentUser, conversation) {
	// Constants
	this.CURRENT_USER = currentUser;
	// TODO: Localize this.
	this.META_MESSAGES = {
		'userLeft': '%user% left the conversation.',
		'userRemoved': '%subject% was removed from the conversation by %user%.',
		'userJoined': '%user% joined the conversation.',
		'userAdded': '%subject% was added to the conversation by %user%.',
		'nameChanged': 'The conversation\'s name was changed to %name%.',
		'claimed': '%user% claimed the conversation as their own!'
	};

	this.convID = conversation.id;
	this.ownerId = conversation.owner;

	this.socket = io();
	this.authors = {};
	this.stamps = {};

	this.active = true;
	this.useCursor = false;
	this.editingName = false;

	this.messagesLoaded = 0;

	$(document).ready(function () {
		this.initialize();
	}.bind(this));

};

SWConversationUI.prototype.initialize = function () {
	// Cache various elements that remain unchanged.
	this.$body = $('body');
	this.$cursor = $('#cursor');
	this.$messagesContainer = $('#messagesContainer');
	this.$editMembersButton = $('#editMembers');
	this.$drawPanel = $('#drawPanel');
	this.$brushSizeRange = $('#brushSizeRange');
	this.$hotSwapButton = $('#hotswap');
	this.$loadMoreButton = $('#loadMore');
	this.$changeNameButton = $('#changeName');
	this.$controls = $('#controls');
	this.$commands = $('#commands');
	this.$onionSkin = $('#onionSkin');

	this.$controls.hide();
	this.$commands.hide();

	var self = this;

	this.$messagesContainer.append('<div class="loader" '
		+ 'style="position:absolute;left:50%;margin-left:-23px;margin-top:50px;"></div>');

	$.get('/conversations/' + this.convID + '/stamps/').done(function (data) {
		for (var s in data['stamps']) {
			if (data['stamps'].hasOwnProperty(s)) {
				this.stamps[data['stamps'][s]['id']] = data['stamps'][s];
			}
		}
	}.bind(this));

	this.$cursor.hide();
	this.$loadMoreButton.hide();

	this.$canvas = $('#drawCanvas');
	this.drawCanvas = new SWCanvas('drawCanvas');

	var hover = false;

	this.$canvas.on('mousedown', function (event) {
		var mCoords = this.drawCanvas.calculateMouse(event.pageX, event.pageY);

		this.drawCanvas.startPainting();

		this.drawCanvas.addPoint(mCoords.x, mCoords.y, false);
		this.drawCanvas.redraw();
	}.bind(this));
	this.$canvas.on('touchstart', function (event) {
		//noinspection JSUnresolvedVariable
		var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
		var mCoords = this.drawCanvas.calculateMouse(touch.pageX, touch.pageY);

		this.drawCanvas.startPainting();

		this.drawCanvas.addPoint(mCoords.x, mCoords.y, false);
		this.drawCanvas.redraw();
	}.bind(this));
	this.$canvas.on('mousemove', function (event) {
		if (this.drawCanvas.paint) {
			var mCoords = this.drawCanvas.calculateMouse(event.pageX, event.pageY);

			this.drawCanvas.addPoint(mCoords.x, mCoords.y, true);
			this.drawCanvas.redraw();
		}

		if (hover) {
			if (this.useCursor) this.drawCursor(event.pageX, event.pageY);
		}
	}.bind(this));
	this.$canvas.on('touchmove', function (event) {
		event.preventDefault();

		if (this.drawCanvas.paint) {
			//noinspection JSUnresolvedVariable
			var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
			var mCoords = this.drawCanvas.calculateMouse(touch.pageX, touch.pageY);

			this.drawCanvas.addPoint(mCoords.x, mCoords.y, true);
			this.drawCanvas.redraw();
		}
	}.bind(this));

	var onMouseUp = function () {
		this.drawCanvas.stopPainting();
		this.drawCanvas.imageToBg(false);
	}.bind(this);

	this.$canvas.on('mouseup', onMouseUp);
	this.$canvas.on('touchend', function (event) {
		event.preventDefault();
		onMouseUp(event);
	});
	this.$canvas.on('mouseleave', function () {
		this.drawCanvas.stopPainting();
		hover = false;
		if (this.useCursor) this.$cursor.hide();
	}.bind(this));

	this.$canvas.on('mouseenter', function (event) {
		hover = true;
		if (this.useCursor) {
			this.$cursor.show();
			this.drawCursor(event.pageX, event.pageY);
		}
	}.bind(this));

	$('.colorTool').click(function () {
		self.drawCanvas.updateBrush({
			tool: 'brush',
			color: $(this).css('backgroundColor')
		});

		self.$brushSizeRange.change(); // Refresh size, make sure it's correct

		$(this).parent().children('li').each(function () {
			$(this).removeClass('active');
		});
		$(this).addClass('active');

		$(this).parent().parent().children('#images').children('li').each(function () {
			$(this).removeClass('active');
		});
	});
	$('.stampTool').click(function () {
		self.drawCanvas.updateBrush({
			tool: 'stamp',
			stamp: $(this).attr('id')
		});

		self.$brushSizeRange.change(); // Refresh size, make sure it's correct

		$(this).parent().children('li').each(function () {
			$(this).removeClass('active');
		});
		$(this).addClass('active');

		$(this).parent().parent().children('#colors').children('li').each(function () {
			$(this).removeClass('active');
		});
	});

	this.$brushSizeRange.on('input change', function () {
		self.drawCanvas.setBrushSize($(this).val());
	});

	$('#clear').click(function () {
		this.drawCanvas.clearAllCanvasData(true, false);
	}.bind(this));
	$('#send').click(function () {
		var messageData;
		if (this.drawCanvas.frames.length == 1) {
			messageData = {
				messageData: this.drawCanvas.canvas.toDataURL(),
				conversationID: this.convID,
				type: 'image'
			};
		} else {
			messageData = {
				messageData: this.drawCanvas.getFrameDataURLs(),
				conversationID: this.convID,
				type: 'animation'
			};
		}

		this.drawCanvas.clearAllCanvasData(true, false);
		this.drawCanvas.clearFrames();
		this.drawCanvas.stopPlaying();

		this.$onionSkin.attr('src', ''); // TODO: Sub in a blank image instead of nothing.

		$('.frame').each(function () {
			if ($(this).data('frame') > 0) {
				$(this).remove();
			}
		});
		$('#frame-1').addClass('selected');

		this.socket.emit('newMessage', messageData);
		this.messagesLoaded++;

		if (window.innerWidth <= 1100) {
			if (this.$drawPanel.css('left') != '0px') {
				this.$drawPanel.css({left: '100%'});
			}
		}

		this.displayMessage(this.CURRENT_USER.id.toString(), messageData.messageData, messageData.type,
			moment(Date.now()).format('h:mm A; MMMM D'), false);
	}.bind(this));

	$('#stampIt').click(function () {
		this.socket.emit('stampAdd', {
			imageData: this.drawCanvas.canvas.toDataURL(),
			conversationID: this.convID
		});

		this.$body.append('<div id="modalBackground"></div>');
		this.$body.append('<div id="modal"><h1>Stamp was added!</h1>'
			+ '<button id="okay">Okay</button>'
			+ '</div>');
		$('#okay, #modalBackground').click(function () {
			$('#modal').fadeOut('fast', function () {
				$(this).remove();
			});
			$('#modalBackground').fadeOut('fast', function () {
				$(this).remove();
			});
		});
	}.bind(this));

	$('#hotkey').click(function () {
		this.$body.append('<div id="modalBackground"></div>');
		this.$body.append('<div id="modal"><h1><span>User Stamps</span><div class="controls">'
			+ '<button id="closeModal" class="transparent iconOnly big noMargin">'
			+ '<i class="material-icons">clear</i></button></div></h1>'
			+ '<div id="stamps"><div class="stamp"><img src="/images/sciencerules.png"></div></div>'
			+ '</div>');

		this.refreshStamps();

		this.$body.on('click', '.stampDelete', function (event) {
			event.stopPropagation();

			// TODO: Are you sure???

			self.socket.emit('stampRemove', {
				conversationID: self.convID,
				stampID: $(this).parent().data('id')
			});
			$(this).parent().remove();
		});

		$('#closeModal, #modalBackground').click(function () {
			$('#modal').fadeOut('fast', function () {
				$(this).remove();
			});
			$('#modalBackground').fadeOut('fast', function () {
				$(this).remove();
			});
		});
	}.bind(this));

	this.$body.on('click', '.stamp', function () {
		self.$hotSwapButton.children('img').first().attr('src', ($(this).children('img').first().attr('src')));
		self.$hotSwapButton.click();

		$('#modal').fadeOut('fast', function () {
			$(this).remove();
		});
		$('#modalBackground').fadeOut('fast', function () {
			$(this).remove();
		});
	});

	this.$body.on('click', '.importToCanvas', function () {
		if (!self.drawCanvas.frames[self.drawCanvas.currentFrame].background) {
			self.drawCanvas.frames[self.drawCanvas.currentFrame].background = document.createElement('img');
		}
		self.drawCanvas.frames[self.drawCanvas.currentFrame].background.setAttribute('src', $(this).parent().parent()
			.children('div.image').first().children('img').first().attr('src'));
		self.drawCanvas.clearAllCanvasData(false, false);
		self.drawCanvas.redraw();
	});

	// Start changing the conversation name
	this.$changeNameButton.click(function () {
		self.editingName = true;

		$('#convName').replaceWith('<input type="text" id="changeNameText" value="'
			+ $('#convName').text() + '">');
		$('#changeNameText').after(' <div id="nameChangeControls"><button id="saveName">'
			+ '<i class="material-icons">done</i><span>Save</span></button>'
			+ '<button id="cancelChange" class="transparent"><i class="material-icons">clear</i>'
			+ '<span>Cancel</span></button></div>');
		$('#saveName').click(function () {
			// TODO: Socket send a message that name has changed

			self.socket.emit('changeName', {
				newName: $('#changeNameText').val(),
				conversationID: self.convID
			});

			self.editingName = false;

			$('#saveName').remove();
			$('#cancelChange').remove();

			$('#changeNameText').replaceWith('<span id="convName">'
				+ $('#changeNameText').val() + '</span>');
			self.$changeNameButton.removeAttr('disabled');
			self.$changeNameButton.show();
		});
		$('#cancelChange').click(function () {
			self.editingName = false;

			$('#saveName').remove();
			$(this).remove();

			$('#changeNameText').replaceWith('<span id="convName">'
				+ $('#changeNameText').val() + '</span>');
			self.$changeNameButton.removeAttr('disabled');
			self.$changeNameButton.show();
		});
		$(this).attr('disabled', 'disabled');
		$(this).hide();
	});

	this.$editMembersButton.click(function () {
		self.$body.append('<div id="modalBackground"></div>');
		var modalHTML = '<div id="modal"><h1><span>Edit Members</span><div class="controls">'
			+ '<button id="closeModal" class="transparent iconOnly big noMargin">'
			+ '<i class="material-icons">clear</i>'
			+ '</button></div></h1><div id="members"></div><select id="addMemberBox"></select> '
			+ '<button id="addMember"><i class="material-icons">person_add</i> Add Member</button>'
			+ '<br><br></div>';

		self.$body.append(modalHTML);

		function template(data) {
			return $('<span class="search-member"><div class="avatar"><img src="/users/'
				+ data.id + '/avatar/thumb/"></div><div class="name">'
				+ data.text + '</div></span>');
		}

		var $membersList = $('#members');
		$('#addMemberBox').select2({
			placeholder: {
				id: '-1', // the value of the option
				text: 'Select an option'
			},

			ajax: {
				url: '/users_search/',
				dataType: 'json',
				delay: 250,
				type: 'GET',
				data: function (params) {
					return {
						q: params.term,
						exclude: self.convID
					}
				},
				/*data: function (params) {
				return {
				q: params.term, // search term
				page: params.page
				};
				},*/
				processResults: function (data, params) {
					// parse the results into the format expected by Select2
					// since we are using custom formatting functions we do not need to
					// alter the remote JSON data, except to indicate that infinite
					// scrolling can be used
					//params.page = params.page || 1;

					return {
						results: $.map(data.users, function (user) {
							return {
								text: user.username,
								id: user.id
							}
						})
						/*pagination: {
						more: (params.page * 30) < data.total_count
						}*/
					};
				},
				cache: true
			},
			templateResult: template,
			minimumInputLength: 1
		});

		$.get('/conversations/' + self.convID + '/users/').done(function (data) {
			for (var u in data['users']) {
				if (data['users'].hasOwnProperty(u)) {
					var memberHTML = '<div class="member" data-username="'
						+ data['users'][u]['username'] + '" data-id="' + data['users'][u]['id']
						+ '"><div class="avatar">'
						+ '<img src="/users/' + data['users'][u]['id'] + '/avatar/thumb/">'
						+ '</div><a class="name" href="/users/' + data['users'][u]['id'] + '/">'
						+ data['users'][u]['username'] + '</a><div class="onlineIndicator"></div>'
						+ ' <button class="deleteMember iconOnly transparent">'
						+ '<i class="material-icons">clear</i></button>';

					if (self.ownerId == data['users'][u]['id']) {
						memberHTML += '<div class="ownerBadge">Owner</div>';
					}
					memberHTML += '</div>';

					$('#members').append(memberHTML);
				}
			}

			$('#members').find('.member').each(function () {
				$.get('/users/' + $(this).data('id') + '/status/').done(function (statusData) {
					if (statusData['online']) {
						$(this).children('.onlineIndicator').first().addClass('online');
					}
				}.bind(this));
			});
		});

		$('#addMember').click(function () {
			var userToAdd = $('#addMemberBox').val();
			if (userToAdd) {
				self.socket.emit('userAdd', {userID: userToAdd, conversationID: self.convID});
				self.displayRawMetaMessage(self.authors[userToAdd]['username'] + ' was added to the conversation by '
					+ self.CURRENT_USER.username + '.', false);

				$membersList.append('<div class="member" data-username="'
					+ self.authors[userToAdd]['username'] + '"><div class="avatar"><img src="/users/'
					+ self.authors[userToAdd]['id'] + '/avatar/thumb/"></div><a class="name">'
					+ self.authors[userToAdd]['username']
					+ '</a> <button class="deleteMember iconOnly transparent">'
					+ '<i class="material-icons">clear</i></button></div>');
			}
		});

		self.$body.on('click', '.deleteMember', function () {
			// TODO: We should probably only use one method of IDing users rather than DB ID + username
			var usernameToRemove = $(this).parent().data('username');
			self.socket.emit('userRemove', {username: usernameToRemove, conversationID: self.convID});
			self.displayRawMetaMessage(usernameToRemove + ' was removed from the conversation by '
				+ self.CURRENT_USER.username + '.', false);
			$(this).parent().remove();
		});

		$('#closeModal, #modalBackground').click(function () {
			$('#modal').fadeOut('fast', function () {
				$(this).remove();
			});
			$('#modalBackground').fadeOut('fast', function () {
				$(this).remove();
			});
		});
	});

	$('#toggleCanvas').click(function () {
		if (self.$drawPanel.css('left') != '0px') {
			self.$drawPanel.animate({left: 0});
			$(this).children('span').text('Messages');
			$(this).children('i').text('chevron_left');
			self.$drawPanel.focus();
		} else {
			self.$drawPanel.animate({left: '100%'});
			$(this).children('span').text('Draw');
			$(this).children('i').text('gesture');
		}
	});

	this.$loadMoreButton.click(function () {
		this.refreshMessages(true, this.messagesLoaded, 10, true);
	}.bind(this));

	this.$body.on('click', '.frame', function (event) {
		this.drawCanvas.setFrame($(event.target).data('frame'));
		this.drawCanvas.redraw();
		$('.frame').removeClass('selected');
		$(event.target).addClass('selected');
	}.bind(this));

	$('#addFrame').click(function () {
		if (this.drawCanvas.addFrame()) {
			$('.frame').last().after('<a id="frame-' + this.drawCanvas.frames.length + '" class="frame" data-frame="'
				+ (this.drawCanvas.frames.length - 1) + '">' + this.drawCanvas.frames.length + '</a>');
		}
	}.bind(this));
	$('#removeFrame').click(function () {
		if (this.drawCanvas.removeFrame()) {
			var $frames = $('.frame');
			$frames.last().remove();
			$frames.removeClass('selected');
			$('#frame-' + (this.drawCanvas.currentFrame + 1)).addClass('selected');
		}
	}.bind(this));

	$('#toggleAnimation').click(function () {
		if (self.drawCanvas.playing) {
			self.drawCanvas.stopPlaying();
			$(this).children('i').first().text('play_arrow');
			$('#frame-' + (self.drawCanvas.currentFrame + 1)).addClass('selected');
		} else {
			self.drawCanvas.startPlaying();
			$(this).children('i').first().text('pause');
			$('.frame.selected').first().removeClass('selected');
		}
	});

	$(window).resize(function () {
		if (window.innerWidth > 1100) {
			this.$drawPanel.css({left: '50%'});
		} else {
			if (this.$drawPanel.css('left') != '0px') {
				this.$drawPanel.css({left: '100%'});
			}
		}
		this.$canvas.css('height', (this.$canvas.width() / 1.5).toString() + 'px');
		this.drawCanvas.updateCanvasOffset();
	}.bind(this));

	$(window).on('beforeunload', function (event) {
		onMouseUp(event);
		this.socket.emit('userLeave', {conversationID: this.convID});
		this.socket.disconnect();
	}.bind(this));

	window.setInterval(function () {
		if (this.active) {
			// Keep session alive
			$.get('/keepalive/');
		}
	}.bind(this), 10000);

	$('#scrollIt').scroll(function () {
		this.drawCanvas.updateCanvasOffset();
	}.bind(this));

	// -----------------

	this.$brushSizeRange.change();
	$(window).resize();

	this.socket.emit('userOnline');
	this.socket.emit('userJoin', this.convID);

	// TODO: Handle add/remove with sockets. This is dumb.
	$.get('/users/').done(function (data) {
		this.authors = data['users'];
		this.refreshMessages(true, 0, 50, false);
	}.bind(this));

	if ('Notification' in window) {
		if (Notification.permission !== 'denied' && Notification.permission !== 'granted') {
			Notification.requestPermission();
		}
	}

	this.$body.on('click', '#claimConv', function () {
		this.socket.emit('claimConversation', this.convID);
	}.bind(this));

	this.socket.on('claimConversation', function (claimerId) {
		// TODO: Some additional logic to update UI
		$('#claimConv').remove();
		this.ownerId = claimerId;
	}.bind(this));

	this.socket.on('newMessage', function (data) {
		if (parseInt(data['ConversationId']) == this.convID) {
			var rawDate = data['createdAt'];
			var formattedDate = moment(rawDate).format("h:mm A; MMMM D");

			var notificationToCreate = '';

			switch (data['type']) {
				case 'image':
					notificationToCreate = this.authors[data['UserId']]['username'] + ' sent a sketch!';
					this.displayMessage(data['UserId'], data['imageData'], data['type'], formattedDate, false);
					break;
				case 'text':
					notificationToCreate = this.authors[data['UserId']]['username'] + ' sent a message!';
					this.displayMessage(data['UserId'], data['textData'], data['type'], formattedDate, false);
					break;
				case 'meta':
					this.displayMetaMessage(data['textData'], false);
			}

			if ('Notification' in window && notificationToCreate != '') {
				if (!document.hasFocus() && this.authors[data['UserId']] != this.CURRENT_USER.id) {
					if (Notification.permission === 'granted') {
						// TODO: Notification toggle
						new Notification(notificationToCreate);
					} else if (Notification.permission !== 'denied') {
						// TODO: This version of requestPermission (callback rather than promise) is deprecated
						Notification.requestPermission(function (permission) {
							if (permission === 'granted') {
								new Notification(notificationToCreate);
							}
						});
					}
				}
			}
		}
	}.bind(this));

	this.socket.on('stampAdd', function (stamp) {
		this.stamps[stamp['id']] = stamp;
	}.bind(this));
	this.socket.on('stampRemove', function (stamp) {
		delete this.stamps[stamp];
	}.bind(this));

	this.socket.on('changeName', function (name) {
		if (!this.editingName) {
			$('#convName').html(name);
		}
	}.bind(this));

	this.socket.on('userAdd', function (data) {
		this.authors[data.id] = data;
	}.bind(this));

	this.socket.on('userJoin', function (data) {
		// TODO: Some form of indication that the user is viewing the chat
	}.bind(this));
	this.socket.on('userLeave', function (data) {
		// TODO: Some form of indication that the user is no longer viewing the chat
	}.bind(this));
};

SWConversationUI.prototype.displayMessage = function (userID, messageData, messageType, date, immediate, top) {
	var messageHTML = '<div class="message ' + messageType + '-message';
	if (userID == this.CURRENT_USER.id) {
		messageHTML += ' you';
	}
	// TODO: Add a message specific ID
	messageHTML += '" id="message-' + '">'
		+ '<div class="topBar"><div class="author">';

	if (this.authors[userID]['avatar']) {
		messageHTML += '<img src="/users/' + this.authors[userID]['id'] + '/avatar/thumb/">';
	}

	messageHTML += '<a href="/users/' + userID + '/">'
		+ this.authors[userID]['username'] + '</a></div><div class="date">'
		+ date + '</div></div>';

	switch (messageType) {
		case 'image':
			messageHTML += '<div class="image">'
				+ '<img src="' + messageData + '"></div>'
				+ '<div class="controls"><button class="importToCanvas transparent noMargin">'
				+ '<i class="material-icons">gesture</i><span>Bastardize</span></button></div>';
			break;
		case 'text':
			messageHTML += '<div class="text">' + messageData + '</div>';
			break;
	}

	messageHTML += '</div>';

	if (top) {
		this.$messagesContainer.children('#loadMore').first().after(messageHTML);
	} else {
		this.$messagesContainer.append(messageHTML);

		if (immediate) {
			this.$messagesContainer.scrollTop(this.$messagesContainer[0].scrollHeight);
		} else {
			this.$messagesContainer.animate({scrollTop: this.$messagesContainer[0].scrollHeight.toString() + 'px'});
		}
	}
};

SWConversationUI.prototype.displayRawMetaMessage = function (message, immediate) {
	this.$messagesContainer.append('<div class="metaMessage">' + message + '</div>');
	if (immediate) {
		this.$messagesContainer.scrollTop(this.$messagesContainer[0].scrollHeight);
	} else {
		this.$messagesContainer.animate({scrollTop: this.$messagesContainer[0].scrollHeight.toString() + 'px'});
	}
};

SWConversationUI.prototype.displayMetaMessage = function (message, immediate) {
	// TODO: The authors array is garbage and has to be fixed.
	var processedString = this.META_MESSAGES[message['metaData']['action']];
	if (message['metaData']['action'] == 'nameChanged') {
		processedString = processedString.replace('%name%', message['metaData']['name']);
	}
	processedString = processedString.replace('%user%', this.authors[message['UserId']]['username']);
	if (message['metaData'].hasOwnProperty('subject')) {
		processedString = processedString.replace('%subject%',
			this.authors[message['metaData']['subject']]['username']);
	}
	this.displayRawMetaMessage(processedString, immediate);
};

SWConversationUI.prototype.refreshMessages = function (immediate, from, count, top) {
	this.$loadMoreButton.attr('disabled', 'disabled');
	this.$loadMoreButton.addClass('disabled');

	$.get('/conversations/' + this.convID.toString() + '/data/from/' + from.toString()
		+ '/count/' + count.toString()).then(function (data) {

		var $convName = $('#convName');

		// TODO: If not editing
		$convName.text(data['conversation']['name']);
		this.ownerId = data['conversation']['OwnerId'];

		if (this.ownerId == null) {
			$convName.after('<button id="claimConv">Claim</button>');
		}

		if (!top) {
			data['messages'].reverse();
		}

		var currentScrollTop = $('.message').first();

		for (var m = 0; m < data['messages'].length; m++) {
			var rawDate = data['messages'][m]['createdAt'];
			var formattedDate = moment(rawDate).format("h:mm A; MMMM D");

			switch (data['messages'][m]['type']) {
				case 'image':
					this.displayMessage(data['messages'][m]['UserId'], data['messages'][m]['imageData'],
						data['messages'][m]['type'], formattedDate, immediate, top);
					break;
				case 'text':
					this.displayMessage(data['messages'][m]['UserId'], data['messages'][m]['textData'],
						data['messages'][m]['type'], formattedDate, immediate, top);
					break;
				case 'meta':
					this.displayMetaMessage(data['messages'][m], immediate);
					break;
			}
		}

		if (data['messages'].length >= 10) {
			this.$loadMoreButton.removeAttr('disabled');
			this.$loadMoreButton.removeClass('disabled');
		}

		this.messagesLoaded += data['messages'].length;

		if (top) {
			this.$messagesContainer.scrollTop(currentScrollTop.offset().top - 240);
		} else {
			// TODO: This is a temporary hack for images being done loading

			if (!top) {
				window.setTimeout(function () {
					this.$messagesContainer.scrollTop(this.$messagesContainer[0].scrollHeight);
				}.bind(this), 100);
			}
		}

		// Done loading, get rid of the loading animation thing
		this.$messagesContainer.children('.loader').first().remove();
		this.$controls.fadeIn();
		this.$commands.fadeIn();
		this.$loadMoreButton.show();
	}.bind(this));
};

SWConversationUI.prototype.refreshStamps = function () {
	for (var s in this.stamps) {
		if (this.stamps.hasOwnProperty(s)) {
			var stampHTML = '<div class="stamp" data-id="' + this.stamps[s]['id']
				+ '"><img src="' + this.stamps[s]['imageData'] + '">';
			if (this.stamps[s]['UserId'] == this.CURRENT_USER.id.toString()) {
				stampHTML += '<button class="stampDelete transparent noMargin big iconOnly">'
					+ '<i class="material-icons">delete</i></button>';
			}
			stampHTML += '</div>';
			$('#stamps').append(stampHTML);
		}
	}
};

SWConversationUI.prototype.drawCursor = function (x, y) {
	this.$cursor.css({'top': (y - 114).toString() + 'px', 'left': x.toString() + 'px'});
};
