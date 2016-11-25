'use strict';

/**
 * Handles the SketchWave conversation user interface.
 * @param currentUser {object} - The object containing user data from the server.
 * @param conversation {object} - The object containing conversation data from the server.
 * @constructor
 */
var ConversationUI = function (currentUser, conversation) {
	$(document).ready(function () {
		const CURRENT_USER = currentUser;
		const convID = conversation.id;
		var ownerId = conversation.owner;

		var active = true;
		var useCursor = false;
		var editingName = false;

		var socket = io();
		var authors = {};
		var stamps = {};

		// TODO: Localize this.
		const metaMessages = {
			'userLeft': '%user% left the conversation.',
			'userRemoved': '%subject% was removed from the conversation by %user%.',
			'userJoined': '%user% joined the conversation.',
			'userAdded': '%subject% was added to the conversation by %user%.',
			'nameChanged': 'The conversation\'s name was changed to %name%.',
			'claimed': '%user% claimed the conversation as their own!'
		};

		var messagesLoaded = 0;

		var $body = $('body');
		var $cursor = $('#cursor');
		var $messagesContainer = $('#messagesContainer');
		var $editMembersButton = $('#editMembers');
		var $drawPanel = $('#drawPanel');
		var $brushSizeRange = $('#brushSizeRange');
		var $hotSwapButton = $('#hotswap');
		var $loadMoreButton = $('#loadMore');
		var $changeNameButton = $('#changeName');
		var $controls = $('#controls');
		var $commands = $('#commands');

		$controls.hide();
		$commands.hide();

		$messagesContainer.append('<div class="loader" '
			+ 'style="position:absolute;left:50%;margin-left:-23px;margin-top:50px;"></div>');

		$.get('/conversations/' + convID + '/stamps/').done(function (data) {
			for (var s in data['stamps']) {
				if (data['stamps'].hasOwnProperty(s)) {
					stamps[data['stamps'][s]['id']] = data['stamps'][s];
				}
			}
		});

		$cursor.hide();
		$loadMoreButton.hide();

		var $canvas = $('#drawCanvas');
		var drawCanvas = new SWCanvas('drawCanvas');

		var hover = false;

		// TODO: Optimize small avatars
		var displayMessage = function (userID, messageData, messageType, date, immediate, top) {
			var messageHTML = '<div class="message ' + messageType + '-message';
			if (userID == CURRENT_USER.id) {
				messageHTML += ' you';
			}
			messageHTML += '" id="message-' + '">'
				+ '<div class="topBar"><div class="author">';

			if (authors[userID]['avatar']) {
				messageHTML += '<img src="/users/' + authors[userID]['id'] + '/avatar/thumb/">';
			}

			messageHTML += '<a href="/users/' + userID + '/">'
				+ authors[userID]['username'] + '</a></div><div class="date">'
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
				$messagesContainer.children('#loadMore').first().after(messageHTML);
			} else {
				$messagesContainer.append(messageHTML);

				if (immediate) {
					$messagesContainer.scrollTop($messagesContainer[0].scrollHeight);
				} else {
					$messagesContainer.animate({scrollTop: $messagesContainer[0].scrollHeight.toString() + 'px'});
				}
			}
		};

		var displayRawMetaMessage = function (message, immediate) {
			$messagesContainer.append('<div class="metaMessage">' + message + '</div>');
			if (immediate) {
				$messagesContainer.scrollTop($messagesContainer[0].scrollHeight);

			} else {
				$messagesContainer.animate({scrollTop: $messagesContainer[0].scrollHeight.toString() + 'px'});
			}
		};

		var displayMetaMessage = function (message, immediate) {
			// TODO: The authors array is garbage and has to be fixed.
			var processedString = metaMessages[message['metaData']['action']];
			if (message['metaData']['action'] == 'nameChanged') {
				processedString = processedString.replace('%name%', message['metaData']['name']);
			}
			processedString = processedString.replace('%user%', authors[message['UserId']]['username']);
			if (message['metaData'].hasOwnProperty('subject')) {
				processedString = processedString.replace('%subject%',
					authors[message['metaData']['subject']]['username']);
			}
			displayRawMetaMessage(processedString, immediate);
		};

		var refreshMessages = function (immediate, from, count, top) {
			$loadMoreButton.attr('disabled', 'disabled');
			$loadMoreButton.addClass('disabled');

			$.get('/conversations/' + convID.toString() + '/data/from/' + from.toString()
				+ '/count/' + count.toString()).then(function (data) {

				var $convName = $('#convName');

				// TODO: If not editing
				$convName.text(data['conversation']['name']);
				ownerId = data['conversation']['OwnerId'];

				if (ownerId == null) {
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
							displayMessage(data['messages'][m]['UserId'], data['messages'][m]['imageData'],
								data['messages'][m]['type'], formattedDate, immediate, top);
							break;
						case 'text':
							displayMessage(data['messages'][m]['UserId'], data['messages'][m]['textData'],
								data['messages'][m]['type'], formattedDate, immediate, top);
							break;
						case 'meta':
							displayMetaMessage(data['messages'][m], immediate);
							break;
					}
				}

				if (data['messages'].length >= 10) {
					$loadMoreButton.removeAttr('disabled');
					$loadMoreButton.removeClass('disabled');
				}

				messagesLoaded += data['messages'].length;

				if (top) {
					$messagesContainer.scrollTop(currentScrollTop.offset().top - 240);
				} else {
					// TODO: This is a temporary hack for images being done loading

					if (!top) {
						window.setTimeout(function () {
							$messagesContainer.scrollTop($messagesContainer[0].scrollHeight);
						}, 100);
					}
				}

				// Done loading, get rid of the loading animation thing
				$messagesContainer.children('.loader').first().remove();
				$controls.fadeIn();
				$commands.fadeIn();
				$loadMoreButton.show();
			});
		};

		var drawCursor = function (x, y) {
			$cursor.css({'top': (y - 114).toString() + 'px', 'left': x.toString() + 'px'});
		};

		$canvas.on('mousedown', function (event) {
			var mCoords = drawCanvas.calculateMouse(event.pageX, event.pageY);

			drawCanvas.startPainting();

			drawCanvas.addPoint(mCoords.x, mCoords.y, false);
			drawCanvas.redraw();
		});
		$canvas.on('touchstart', function (event) {
			var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
			var mCoords = drawCanvas.calculateMouse(touch.pageX, touch.pageY);

			drawCanvas.startPainting();

			drawCanvas.addPoint(mCoords.x, mCoords.y, false);
			drawCanvas.redraw();
		});
		$canvas.on('mousemove', function (event) {
			if (drawCanvas.paint) {
				var mCoords = drawCanvas.calculateMouse(event.pageX, event.pageY);

				drawCanvas.addPoint(mCoords.x, mCoords.y, true);
				drawCanvas.redraw();
			}

			if (hover) {
				if (useCursor) drawCursor(event.pageX, event.pageY);
			}
		});
		$canvas.on('touchmove', function (event) {
			event.preventDefault();

			if (drawCanvas.paint) {
				//noinspection JSUnresolvedVariable
				var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
				var mCoords = drawCanvas.calculateMouse(touch.pageX, touch.pageY);

				drawCanvas.addPoint(mCoords.x, mCoords.y, true);
				drawCanvas.redraw();
			}
		});

		var onMouseUp = function () {
			drawCanvas.stopPainting();
			drawCanvas.imageToBg(false);
		};

		$canvas.on('mouseup', onMouseUp);
		$canvas.on('touchend', function (event) {
			event.preventDefault();
			onMouseUp(event);
		});
		$canvas.on('mouseleave', function () {
			drawCanvas.stopPainting();
			hover = false;
			if (useCursor) $cursor.hide();
		});

		$canvas.on('mouseenter', function (event) {
			hover = true;
			if (useCursor) {
				$cursor.show();
				drawCursor(event.pageX, event.pageY);
			}
		});

		$('.colorTool').click(function () {
			drawCanvas.updateBrush({
				tool: 'brush',
				color: $(this).css('backgroundColor')
			});

			$brushSizeRange.change(); // Refresh size, make sure it's correct

			$(this).parent().children('li').each(function () {
				$(this).removeClass('active');
			});
			$(this).addClass('active');

			$(this).parent().parent().children('#images').children('li').each(function () {
				$(this).removeClass('active');
			});
		});
		$('.stampTool').click(function () {
			drawCanvas.updateBrush({
				tool: 'stamp',
				stamp: $(this).attr('id')
			});

			$brushSizeRange.change(); // Refresh size, make sure it's correct

			$(this).parent().children('li').each(function () {
				$(this).removeClass('active');
			});
			$(this).addClass('active');

			$(this).parent().parent().children('#colors').children('li').each(function () {
				$(this).removeClass('active');
			});
		});

		$brushSizeRange.on('input change', function () {
			drawCanvas.setBrushSize($(this).val());
		});

		$('#clear').click(function () {
			drawCanvas.clearAllCanvasData(true);
		});
		$('#send').click(function () {
			var messageData = {
				messageData: drawCanvas.canvas.toDataURL(),
				conversationID: convID,
				type: 'image'
			};

			drawCanvas.clearAllCanvasData(true);
			socket.emit('newMessage', messageData);
			messagesLoaded++;

			if (window.innerWidth <= 1040) {
				if ($drawPanel.css('left') != '0px') {
					$drawPanel.css({left: '100%'});
				}
			}

			displayMessage(CURRENT_USER.id.toString(), messageData.messageData, messageData.type,
				moment(Date.now()).format('h:mm A; MMMM D'), false);
		});

		$('#stampIt').click(function () {
			socket.emit('stampAdd', {
				imageData: drawCanvas.canvas.toDataURL(),
				conversationID: convID
			});

			$body.append('<div id="modalBackground"></div>');
			$body.append('<div id="modal"><h1>Stamp was added!</h1>'
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
		});

		$('#hotkey').click(function () {
			var refreshStamps = function () {
				for (var s in stamps) {
					if (stamps.hasOwnProperty(s)) {
						var stampHTML = '<div class="stamp" data-id="' + stamps[s]['id']
							+ '"><img src="' + stamps[s]['imageData'] + '">';
						if (stamps[s]['UserId'] == CURRENT_USER.id.toString()) {
							stampHTML += '<button class="stampDelete transparent noMargin big iconOnly">'
								+ '<i class="material-icons">delete</i></button>';
						}
						stampHTML += '</div>';
						$('#stamps').append(stampHTML);
					}
				}
			};

			$body.append('<div id="modalBackground"></div>');
			$body.append('<div id="modal"><h1><span>User Stamps</span><div class="controls">'
				+ '<button id="closeModal" class="transparent iconOnly big noMargin">'
				+ '<i class="material-icons">clear</i></button></div></h1>'
				+ '<div id="stamps"><div class="stamp"><img src="/images/sciencerules.png"></div></div>'
				+ '</div>');

			refreshStamps();

			$body.on('click', '.stampDelete', function (event) {
				event.stopPropagation();

				// TODO: Are you sure???

				socket.emit('stampRemove', {
					conversationID: convID,
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
		});

		$body.on('click', '.stamp', function () {
			$hotSwapButton.children('img').first().attr('src', ($(this).children('img').first().attr('src')));
			$hotSwapButton.click();

			$('#modal').fadeOut('fast', function () {
				$(this).remove();
			});
			$('#modalBackground').fadeOut('fast', function () {
				$(this).remove();
			});
		});

		$body.on('click', '.importToCanvas', function () {
			drawCanvas.background = $(this).parent().parent()
				.children('div.image').first().children('img').first().attr('src');
			drawCanvas.clearAllCanvasData(false);
			drawCanvas.redraw();
		});

		// Start changing the conversation name
		$changeNameButton.click(function () {
			editingName = true;

			$('#convName').replaceWith('<input type="text" id="changeNameText" value="'
				+ $('#convName').text() + '">');
			$('#changeNameText').after(' <div id="nameChangeControls"><button id="saveName">'
				+ '<i class="material-icons">done</i><span>Save</span></button>'
				+ '<button id="cancelChange" class="transparent"><i class="material-icons">clear</i>'
				+ '<span>Cancel</span></button></div>');
			$('#saveName').click(function () {
				// TODO: Socket send a message that name has changed

				socket.emit('changeName', {
					newName: $('#changeNameText').val(),
					conversationID: convID
				});

				editingName = false;

				$('#saveName').remove();
				$('#cancelChange').remove();

				$('#changeNameText').replaceWith('<span id="convName">'
					+ $('#changeNameText').val() + '</span>');
				$changeNameButton.removeAttr('disabled');
				$changeNameButton.show();
			});
			$('#cancelChange').click(function () {
				editingName = false;

				$('#saveName').remove();
				$(this).remove();

				$('#changeNameText').replaceWith('<span id="convName">'
					+ $('#changeNameText').val() + '</span>');
				$changeNameButton.removeAttr('disabled');
				$changeNameButton.show();
			});
			$(this).attr('disabled', 'disabled');
			$(this).hide();
		});

		$editMembersButton.click(function () {
			$body.append('<div id="modalBackground"></div>');
			var modalHTML = '<div id="modal"><h1><span>Edit Members</span><div class="controls">'
				+ '<button id="closeModal" class="transparent iconOnly big noMargin">'
				+ '<i class="material-icons">clear</i>'
				+ '</button></div></h1><div id="members"></div><select id="addMemberBox"></select> '
				+ '<button id="addMember"><i class="material-icons">person_add</i> Add Member</button>'
				+ '<br><br></div>';

			$body.append(modalHTML);

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
							exclude: convID
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

			$.get('/conversations/' + convID + '/users/').done(function (data) {
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

						if (ownerId == data['users'][u]['id']) {
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
					socket.emit('userAdd', {userID: userToAdd, conversationID: convID});
					displayRawMetaMessage(authors[userToAdd]['username'] + ' was added to the conversation by '
						+ CURRENT_USER.username + '.', false);

					$membersList.append('<div class="member" data-username="'
						+ authors[userToAdd]['username'] + '"><div class="avatar"><img src="/users/'
						+ authors[userToAdd]['id'] + '/avatar/thumb/"></div><a class="name">'
						+ authors[userToAdd]['username']
						+ '</a> <button class="deleteMember iconOnly transparent">'
						+ '<i class="material-icons">clear</i></button></div>');
				}
			});

			$body.on('click', '.deleteMember', function () {
				// TODO: We should probably only use one method of IDing users rather than DB ID + username
				var usernameToRemove = $(this).parent().data('username');
				socket.emit('userRemove', {username: usernameToRemove, conversationID: convID});
				displayRawMetaMessage(usernameToRemove + ' was removed from the conversation by '
					+ CURRENT_USER.username + '.', false);
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
			if ($drawPanel.css('left') != '0px') {
				$drawPanel.animate({left: 0});
				$(this).children('span').text('Messages');
				$(this).children('i').text('chevron_left');
				$drawPanel.focus();
			} else {
				$drawPanel.animate({left: '100%'});
				$(this).children('span').text('Draw');
				$(this).children('i').text('gesture');
			}
		});

		$loadMoreButton.click(function () {
			refreshMessages(true, messagesLoaded, 10, true);
		});

		$(window).resize(function () {
			if (window.innerWidth > 1040) {
				$drawPanel.css({left: '50%'});
			} else {
				if ($drawPanel.css('left') != '0px') {
					$drawPanel.css({left: '100%'});
				}
			}
			$canvas.css('height', ($canvas.width() / 1.5).toString() + 'px');
			drawCanvas.updateCanvasOffset();
		});

		$(window).on('beforeunload', function (event) {
			onMouseUp(event);
			socket.emit('userLeave', {conversationID: convID});
			socket.disconnect();
		});

		window.setInterval(function () {
			if (active) {
				// Keep session alive
				$.get('/keepalive/');
			}
		}, 10000);

		// -----------------

		$brushSizeRange.change();
		$(window).resize();

		socket.emit('userOnline');
		socket.emit('userJoin', convID);

		// TODO: Handle add/remove with sockets. This is dumb.
		$.get('/users/').done(function (data) {
			authors = data['users'];
			refreshMessages(true, 0, 50, false);
		});

		if ('Notification' in window) {
			if (Notification.permission !== 'denied' && Notification.permission !== 'granted') {
				Notification.requestPermission();
			}
		}

		$body.on('click', '#claimConv', function () {
			socket.emit('claimConversation', convID);
		});

		socket.on('claimConversation', function (claimerId) {
			// TODO: Some additional logic to update UI
			$('#claimConv').remove();
			ownerId = claimerId;
		});

		socket.on('newMessage', function (data) {
			if (parseInt(data['ConversationId']) == convID) {
				var rawDate = data['createdAt'];
				var formattedDate = moment(rawDate).format("h:mm A; MMMM D");

				var notificationToCreate = '';

				switch (data['type']) {
					case 'image':
						notificationToCreate = authors[data['UserId']]['username'] + ' sent a sketch!';
						displayMessage(data['UserId'], data['imageData'], data['type'], formattedDate, false);
						break;
					case 'text':
						notificationToCreate = authors[data['UserId']]['username'] + ' sent a message!';
						displayMessage(data['UserId'], data['textData'], data['type'], formattedDate, false);
						break;
					case 'meta':
						displayMetaMessage(data['textData'], false);
				}

				if ('Notification' in window && notificationToCreate != '') {
					if (!document.hasFocus() && authors[data['UserId']] != CURRENT_USER.id) {
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
		});

		socket.on('stampAdd', function (stamp) {
			stamps[stamp['id']] = stamp;
		});
		socket.on('stampRemove', function (stamp) {
			delete stamps[stamp];
		});

		socket.on('changeName', function (name) {
			if (!editingName) {
				$('#convName').html(name);
			}
		});

		socket.on('userAdd', function (data) {
			authors[data.id] = data;
		});

		socket.on('userJoin', function (data) {
			// TODO: Some form of indication that the user is viewing the chat
		});
		socket.on('userLeave', function (data) {
			// TODO: Some form of indication that the user is no longer viewing the chat
		});
	}.bind(this));
};
