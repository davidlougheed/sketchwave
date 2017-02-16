'use strict';

/**
 * @file Describes class for managing SketchWave canvases.
 * @author David Lougheed
 */

/**
 * Creates the SketchWave canvas object and sets up basic initial properties.
 * @param canvas {string} - The ID of the canvas element to use for drawing.
 * @constructor
 */
var SWCanvas = function (canvas) {
	// A drawing can have up to 10 frames (with more than 1 frame it becomes animated).
	this.canvas = document.getElementById(canvas);
	this.context = this.canvas.getContext('2d');
	// TODO: When viable, replace offset() with a native JS equivalent
	this.canvasOffset = $(this.canvas).offset();

	// Cache canvas' real width/height (without scaling)
	this.cw = this.context.canvas.width;
	this.ch = this.context.canvas.height;

	this.updateCanvasOffset();

	// Reduce anti-aliasing
	this.context.mozImageSmoothingEnabled = false;
	this.context.webkitImageSmoothingEnabled = false;
	this.context.msImageSmoothingEnabled = false;
	this.context.imageSmoothingEnabled = false;

	this.paint = false;

	this.allowGabeSave = true;
	this.pointsSinceSave = 0;

	this.brush = {
		color: this.colors.red,
		size: 5,
		tool: 'brush',
		stamp: 'dolphin'
	};

	this.frames = [{
		points: [],
		background: document.createElement('canvas')
	}];
	this.frames[0].background.width = this.cw;
	this.frames[0].background.height = this.ch;

	this.currentFrame = 0;
	this.animationInterval = null;
	this.playing = false;

	this.GABESAVE_QUOTA = 50;

	this.stamps = {
		dolphin: $('#dolphin').find('img')[0],
		hand: $('#hand').find('img')[0],
		pizza: $('#pizza').find('img')[0],
		gabe: $('#gabe').find('img')[0]
	};

	this.moveImageDataToBackground(false, false, null);
};

/**
 * An object containing the SketchWave drawing colors.
 */
SWCanvas.prototype.colors = {
	white: '#FFFFFF',
	grey: '#808080',
	black: '#000000',
	pink: '#FF69B4',
	red: '#FF0000',
	orange: '#FF9300',
	yellow: '#FFFF00',
	blue: '#0000FF',
	green: '#00FF00'
};

/**
 * Clears canvas data to free up some memory (as part of the GabeSave process).
 * @param backgroundClear {boolean}
 * @param keepPoints {boolean}
 */
SWCanvas.prototype.clearAllCanvasData = function (backgroundClear, keepPoints) {
	this.context.clearRect(0, 0, this.cw, this.ch);
	// this.points = this.points.slice(this.points.length - 6, this.points.length);
	if (keepPoints !== true) {
		this.frames[this.currentFrame].points = [];
	}
	if (backgroundClear) {
		this.frames[this.currentFrame].background.getContext('2d').clearRect(0, 0, this.cw, this.ch);
		this.moveImageDataToBackground(false, false, null); // Make sure there's a background in place.
	}
};

/**
 * Clears canvas data to start fresh.
 */
SWCanvas.prototype.clearFrames = function () {
	this.context.clearRect(0, 0, this.cw, this.ch);

	this.frames = [{
		points: [],
		background: document.createElement('canvas')
	}];
	this.frames[0].background.width = this.cw;
	this.frames[0].background.height = this.ch;

	this.currentFrame = 0;
	this.moveImageDataToBackground(false, false, null);
};

/**
 * Draws the points in the current frame onto the canvas.
 */
SWCanvas.prototype.drawPoints = function () {
	this.context.lineJoin = 'round';

	var cacheStamp;
	var cacheStampContext;
	var size;

	if (this.frames[this.currentFrame].points.length > 0) {
		if (this.frames[this.currentFrame].points[0].tool == 'brush') {
			// Only one line width / stroke style is in use at any point in time.

			// Make brush size feel more natural
			this.context.lineWidth = (Math.pow(this.frames[this.currentFrame].points[0].size / this.ch, 1.75)
				* this.ch / 2.0) + 1;
			this.context.strokeStyle = this.frames[this.currentFrame].points[0].color;
		} else {
			// The same size of stamp is used, so cache the size to avoid scaling.

			cacheStamp = document.createElement('canvas');
			cacheStampContext = cacheStamp.getContext('2d');

			if (this.frames[this.currentFrame].points[0].stamp == 'hotswap') {
				// Where 1.5 is the size ratio of the canvas width to height:
				size = this.frames[this.currentFrame].points[0].size * 1.5;

				cacheStamp.width = size;
				cacheStamp.height = this.frames[this.currentFrame].points[0].size;

				// TODO: Make this not dependent on DOM
				cacheStampContext.drawImage($('#' + this.frames[this.currentFrame].points[0].stamp + ' img')[0], 0, 0,
					cacheStamp.width, cacheStamp.height);
			} else {
				size = this.frames[this.currentFrame].points[0].size;

				cacheStamp.width = size;
				cacheStamp.height = size;

				cacheStampContext.drawImage(this.stamps[this.frames[this.currentFrame].points[0].stamp], 0, 0,
					size, size);
			}
		}
	}

	for (var p in this.frames[this.currentFrame].points) {
		if (this.frames[this.currentFrame].points.hasOwnProperty(p)) {
			if (this.frames[this.currentFrame].points[p].tool == 'brush') {
				// We're using the paintbrush and not stamps

				// Start drawing the line
				this.context.beginPath();

				if (this.frames[this.currentFrame].points[p].dragging && p != 0) {
					this.context.moveTo(this.frames[this.currentFrame].points[p - 1].x,
						this.frames[this.currentFrame].points[p - 1].y);
				} else {
					this.context.moveTo(this.frames[this.currentFrame].points[p].x - 1,
						this.frames[this.currentFrame].points[p].y);
				}

				this.context.lineTo(this.frames[this.currentFrame].points[p].x,
					this.frames[this.currentFrame].points[p].y);
				this.context.closePath();
				this.context.stroke();
			} else {
				// We're adding stamps

				if (this.frames[this.currentFrame].points[p].stamp) {
					if (this.frames[this.currentFrame].points[p].stamp == 'hotswap') {
						this.context.drawImage(cacheStamp,
							this.frames[this.currentFrame].points[p].x - Math.round(size / 2),
							this.frames[this.currentFrame].points[p].y - Math.round(size / 3), size,
							this.frames[this.currentFrame].points[p].size);
					} else {
						this.context.drawImage(cacheStamp, 0, 0, size, size,
							this.frames[this.currentFrame].points[p].x - (size / 2),
							this.frames[this.currentFrame].points[p].y - (size / 2), size, size);
					}
				}
			}
		}
	}

	if (!this.playing && this.currentFrame > 0) {
		this.clearOnionSkin();
		if (this.frames[this.currentFrame - 1].background) {
			$('#onionSkin')[0].getContext('2d').drawImage(this.frames[this.currentFrame - 1].background, 0, 0,
				this.cw, this.ch);
		}
	}
};

/**
 * Clears the onion skin image.
 */
SWCanvas.prototype.redrawOnionSkin = function () {
	this.clearOnionSkin();

	if (!this.playing && this.currentFrame > 0 && this.frames[this.currentFrame - 1].background) {
		$('#onionSkin')[0].getContext('2d').drawImage(this.frames[this.currentFrame - 1].background, 0, 0,
			this.cw, this.ch);
	}
};

SWCanvas.prototype.clearOnionSkin = function () {
	$('#onionSkin')[0].getContext('2d').clearRect(0, 0, this.cw, this.ch);
};

/**
 * Redraws the canvas using the points list of the current frame.
 */
SWCanvas.prototype.redraw = function () {
	// Copy image as the first thing on the canvas as part of the GabeSave process.
	this.context.clearRect(0, 0, this.cw, this.ch);
	if (this.frames[this.currentFrame].background) {
		this.context.drawImage(this.frames[this.currentFrame].background, 0, 0, this.cw, this.ch);
	}
	this.drawPoints();

	window.requestAnimationFrame(this.redraw.bind(this));
};

/**
 * Adds a point to the canvas.
 * @param mouseCoordinates {object} - The coordinates of the point to add.
 * @param dragging {boolean} - Whether or not this is part of a "dragged" line.
 */
SWCanvas.prototype.addPoint = function (mouseCoordinates, dragging) {
	// Push a points object to the SW canvas object's internal list
	this.frames[this.currentFrame].points.push({
		x: mouseCoordinates.x,
		y: mouseCoordinates.y,
		dragging: dragging,
		color: this.brush.color,
		size: this.brush.size,
		tool: this.brush.tool,
		stamp: (this.brush.tool === 'brush') ? null : this.brush.stamp
	});

	this.pointsSinceSave += 1;

	// TODO: Fix this hacky mess: GabeSave results in quantum teleportation while an animation is playing.
	if (this.frames[this.currentFrame].points.length > this.GABESAVE_QUOTA && this.allowGabeSave && !this.playing) {
		this.allowGabeSave = false;
		this.moveImageDataToBackground(true, dragging, function () {
			this.allowGabeSave = true;
		}.bind(this));
	}
};

/**
 * Starts painting.
 */
SWCanvas.prototype.startPainting = function () {
	this.paint = true;
};
/**
 * Stops painting.
 */
SWCanvas.prototype.stopPainting = function () {
	this.paint = false;
};

/**
 * Add a frame.
 * @returns {boolean}
 */
SWCanvas.prototype.addFrame = function () {
	if (this.frames.length < 10) {
		this.frames.push({
			points: [],
			background: document.createElement('canvas')
		});
		this.frames[this.frames.length - 1].background.width = this.cw;
		this.frames[this.frames.length - 1].background.height = this.ch;

		this.setFrame(this.frames.length - 1);
		return true;
	}

	return false;
};

/**
 * Remove a frame.
 */
SWCanvas.prototype.removeFrame = function () {
	if (this.frames.length > 1) {
		this.frames.pop();
		if (this.currentFrame >= this.frames.length) {
			this.setFrame(this.frames.length - 1);
		}
		return true;
	}

	return false;
};

/**
 * Set the current frame.
 * @param frame {number} - The number of the frame to switch to.
 */
SWCanvas.prototype.setFrame = function (frame) {
	if (frame >= 0 || frame < 10) {
		this.pointsSinceSave = 0;
		this.allowGabeSave = true;
		this.currentFrame = frame;
		if (frame == 0 || (this.currentFrame > 0 && !this.frames[this.currentFrame].background)) {
			this.clearOnionSkin();
		}
	}
};

/**
 * Get all frames' data URLs.
 */
SWCanvas.prototype.getFrameDataURLs = function () {
	var urls = [];
	for (var i in this.frames) {
		if (this.frames.hasOwnProperty(i)) {
			// GabeSave should have moved everything into the background.
			urls.push(this.frames[i].background.toDataURL());
		}
	}
	return urls;
};

/**
 * Step forward once in animation sequence.
 */
SWCanvas.prototype.playStep = function () {
	this.currentFrame = (this.currentFrame + 1) % this.frames.length;
};

/**
 * Start playing.
 */
SWCanvas.prototype.startPlaying = function () {
	this.playing = true;
	this.animationInterval = setInterval(this.playStep.bind(this), 100);
	this.clearOnionSkin();
};

/**
 * Stop playing.
 */
SWCanvas.prototype.stopPlaying = function () {
	this.playing = false;
	clearInterval(this.animationInterval);
};

/**
 * Updates any parameter of the brush with parameters specified in the updates object.
 * @param updates {object} - The updates to apply to the brush object.
 */
SWCanvas.prototype.updateBrush = function (updates) {
	for (var u in updates) {
		if (updates.hasOwnProperty(u)) {
			if (this.brush[u] !== updates[u]) {
				this.brush[u] = updates[u];
			}
		}
	}
};

SWCanvas.prototype.updateCanvasOffset = function () {
	this.canvasOffset = $(this.canvas).offset();
};

/**
 * Calculates canvas point coordinates based on event mouse coordinates.
 * @param x {number} - The event page X coordinate.
 * @param y {number} - The event page Y coordinate.
 * @returns {{x: number, y: number}}
 */
SWCanvas.prototype.calculateMouse = function (x, y) {
	//noinspection JSUnresolvedVariable
	return {
		x: (x - this.canvasOffset.left) / (this.canvas.offsetWidth / this.cw),
		y: (y - this.canvasOffset.top) / (this.canvas.offsetHeight / this.ch)
	};
};

/**
 * Sets the brush size of the canvas.
 * @param value {number} - A number between 1 and 100 associated with brush size.
 */
SWCanvas.prototype.setBrushSize = function (value) {
	this.brush.size = Math.round(value / 100.0 * this.ch);
};

/**
 * Takes the current canvas drawing and caches it as an image for drawing on the canvas as a background.
 * Part of the GabeSave process.
 */
SWCanvas.prototype.moveImageDataToBackground = function (checkPoints, dragging, callback) {
	this.pointsSinceSave = 0;
	this.frames[this.currentFrame].background.getContext('2d').clearRect(0, 0, this.cw, this.ch);
	this.frames[this.currentFrame].background.getContext('2d').drawImage(this.canvas, 0, 0, this.cw, this.ch);
	if (!dragging) {
		this.frames[this.currentFrame].points = this.frames[this.currentFrame].points
			.splice(0, this.frames[this.currentFrame].points.length - 1);
	} else if (checkPoints) {
		this.frames[this.currentFrame].points = this.frames[this.currentFrame].points
			.slice(this.frames[this.currentFrame].points.length - (this.pointsSinceSave + 2),
				this.frames[this.currentFrame].points.length);
	}
	if (callback) callback();
};

/**
 * Draws background from variable.
 * @param keepPoints {boolean}
 */
SWCanvas.prototype.drawBackground = function (keepPoints) {
	if (this.frames[this.currentFrame].background) {
		this.clearAllCanvasData(false, keepPoints);
		this.context.drawImage(this.frames[this.currentFrame].background, 0, 0);
	}
};

/**
 * Moves image data to background, then starts drawing the image on the canvas as part of the GabeSave process.
 * @param keepPoints {boolean}
 */
SWCanvas.prototype.imageToBg = function (keepPoints) {
	this.moveImageDataToBackground(false, false, function (keepPoints) {
		this.drawBackground(keepPoints);
	}.bind(this, keepPoints));
};
