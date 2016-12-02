'use strict';

/**
 * Creates the SketchWave canvas object and sets up basic initial properties.
 * @param canvas {string} - The ID of the canvas element to use for drawing.
 * @constructor
 */
var SWCanvas = function (canvas) {
	// A drawing can have up to 10 frames (with more than 1 frame it becomes animated).
	this.canvas = document.getElementById(canvas);
	this.context = this.canvas.getContext('2d');
	this.canvasOffset = $(this.canvas).offset();

	// Cache canvas' real width/height (without scaling)
	this.cw = this.context.canvas.width;
	this.ch = this.context.canvas.height;

	// Reduce anti-aliasing
	this.context.mozImageSmoothingEnabled = false;
	this.context.webkitImageSmoothingEnabled = false;
	this.context.msImageSmoothingEnabled = false;
	this.context.imageSmoothingEnabled = false;

	this.paint = false;

	this.brush = {
		color: this.colors.red,
		size: 5,
		tool: 'brush',
		stamp: 'dolphin'
	};

	this.frames = [{
		points: [],
		background: document.createElement('img')
	}];
	this.currentFrame = 0;
	this.animationInterval = null;
	this.playing = false;

	this.BLANK_PNG = "/images/blank.png";
};

/**
 * An object containing the SketchWave drawing colors.
 */
SWCanvas.prototype.colors = {
	white: '#FFFFFF',
	grey: '#808080',
	black: '#000000',
	red: '#FF0000',
	pink: '#FF69B4',
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
		this.frames[this.currentFrame].background = document.createElement('img');
	}
};

/**
 * Clears canvas data to start fresh.
 */
SWCanvas.prototype.clearFrames = function () {
	this.context.clearRect(0, 0, this.cw, this.ch);
	this.frames = [{
		points: [],
		background: document.createElement('img')
	}];
	this.currentFrame = 0;
};

/**
 * Redraws the canvas using the points list of the current frame.
 */
SWCanvas.prototype.redraw = function () {
	this.context.clearRect(0, 0, this.cw, this.ch);

	// Copy image as the first thing on the canvas as part of the GabeSave process.
	if (this.frames[this.currentFrame].background) {
		this.context.drawImage(this.frames[this.currentFrame].background, 0, 0, this.cw, this.ch);
	}

	this.context.lineJoin = 'round';

	for (var p in this.frames[this.currentFrame].points) {
		if (this.frames[this.currentFrame].points.hasOwnProperty(p)) {
			if (this.frames[this.currentFrame].points[p].tool == 'brush') {
				// We're using the paintbrush and not stamps

				// Make brush size feel more natural
				this.context.lineWidth = (Math.pow(this.frames[this.currentFrame].points[p].size / this.ch, 1.75)
					* this.ch / 2.0) + 1;
				this.context.strokeStyle = this.frames[this.currentFrame].points[p].color;

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
					// Where 1.5 is the size ratio of the canvas width to height:
					var size = this.frames[this.currentFrame].points[p].size * 1.5;
					// TODO: Make this not dependent on DOM
					if (this.frames[this.currentFrame].points[p].stamp == 'hotswap') {
						this.context.drawImage($('#' + this.frames[this.currentFrame].points[p].stamp + ' img')[0],
							this.frames[this.currentFrame].points[p].x - Math.round(size / 2),
							this.frames[this.currentFrame].points[p].y - Math.round(size / 3), size, size / 1.5);
					} else {
						this.context.drawImage($('#' + this.frames[this.currentFrame].points[p].stamp + ' img')[0],
							this.frames[this.currentFrame].points[p].x - (this.frames[this.currentFrame].points[p].size / 2),
							this.frames[this.currentFrame].points[p].y - (this.frames[this.currentFrame].points[p].size / 2),
							this.frames[this.currentFrame].points[p].size, this.frames[this.currentFrame].points[p].size);
					}
				}
			}
		}
	}

	if (!this.playing && this.currentFrame > 0) {
		if (this.frames[this.currentFrame - 1].background && this.frames[this.currentFrame - 1].background.src) {
			$('#onionSkin').attr('src', this.frames[this.currentFrame - 1].background.getAttribute('src'));
		} else {
			$('#onionSkin').attr('src', this.BLANK_PNG);
		}
	}
};

/**
 * Adds a point to the canvas.
 * @param x {number} - The X coordinate of the point to add.
 * @param y {number} - The Y coordinate of the point to add.
 * @param dragging {boolean} - Whether or not this is part of a "dragged" line.
 */
SWCanvas.prototype.addPoint = function (x, y, dragging) {
	// Push a points object to the SW canvas object's internal list
	this.frames[this.currentFrame].points.push({
		x: x,
		y: y,
		dragging: dragging,
		color: this.brush.color,
		size: this.brush.size,
		tool: this.brush.tool,
		stamp: (this.brush.tool === 'brush') ? null : this.brush.stamp
	});

	if (this.frames[this.currentFrame].points.length > 50) {
		this.redraw();
		this.moveImageDataToBackground(true, dragging);
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
 */
SWCanvas.prototype.addFrame = function () {
	if (this.frames.length < 10) {
		this.frames.push({
			points: [],
			background: document.createElement('img')
		});
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
			this.currentFrame = this.frames.length - 1;
			this.redraw();
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
		this.currentFrame = frame;
		if (frame == 0) {
			$('#onionSkin').attr('src', ''); // TODO: Sub in a blank image instead of nothing.
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
			urls.push(this.frames[i].background.getAttribute('src'));
		}
	}
	return urls;
};

/**
 * Step forward once in animation sequence.
 */
SWCanvas.prototype.playStep = function () {
	this.currentFrame = (this.currentFrame + 1) % this.frames.length;
	this.redraw();
};

/**
 * Start playing.
 */
SWCanvas.prototype.startPlaying = function () {
	this.playing = true;
	this.animationInterval = setInterval(this.playStep.bind(this), 100);
	$('#onionSkin').attr('src', this.BLANK_PNG);
};

/**
 * Stop playing.
 */
SWCanvas.prototype.stopPlaying = function () {
	this.playing = false;
	clearInterval(this.animationInterval);
	this.redraw();
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
	// TODO: When viable, replace offset() with a native JS equivalent
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
SWCanvas.prototype.moveImageDataToBackground = function (checkPoints, dragging) {
	// TODO: Eventually move this to toBlob when it is supported in more browsers.
	if (!dragging) {
		this.frames[this.currentFrame].background.setAttribute('src', this.canvas.toDataURL());
		this.frames[this.currentFrame].points = this.frames[this.currentFrame].points
			.splice(0, this.frames[this.currentFrame].points.length);
	} else {
		setTimeout(function (checkPoints) {
			this.frames[this.currentFrame].background.setAttribute('src', this.canvas.toDataURL());
			if (checkPoints) {
				this.frames[this.currentFrame].points = this.frames[this.currentFrame].points
					.slice(this.frames[this.currentFrame].points.length - 10,
						this.frames[this.currentFrame].points.length);
			}
		}.bind(this, checkPoints), 0);
	}
};

/**
 * Draws background from variable.
 * @param keepPoints {boolean}
 */
SWCanvas.prototype.drawBackground = function (keepPoints) {
	if (this.frames[this.currentFrame].background) {
		this.clearAllCanvasData(false, keepPoints);
		this.context.clearRect(0, 0, this.cw, this.ch);
		this.context.drawImage(this.frames[this.currentFrame].background,
			0, 0, this.cw, this.ch);
	}
};

/**
 * Moves image data to background, then starts drawing the image on the canvas as part of the GabeSave process.
 * @param keepPoints {boolean}
 */
SWCanvas.prototype.imageToBg = function (keepPoints) {
	this.moveImageDataToBackground(false, false);
	this.drawBackground(keepPoints);
};
