'use strict';

/**
 * Creates the SketchWave canvas object and sets up basic initial properties.
 * @param canvas {string} - The ID of the canvas element to use for drawing.
 * @constructor
 */
var SWCanvas = function (canvas) {
	this.canvas = document.getElementById(canvas);
	this.context = this.canvas.getContext('2d');

	// Cache canvas' real width/height (without scaling)
	this.cw = this.context.canvas.width;
	this.ch = this.context.canvas.height;

	// Reduce anti-aliasing
	this.context.mozImageSmoothingEnabled = false;
	this.context.webkitImageSmoothingEnabled = false;
	this.context.msImageSmoothingEnabled = false;
	this.context.imageSmoothingEnabled = false;

	this.paint = false;

	this.points = [];
	this.brush = {
		color: this.colors.red,
		size: 5,
		tool: 'brush',
		stamp: 'dolphin'
	};

	this.background = null;
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
 */
SWCanvas.prototype.clearAllCanvasData = function (backgroundClear) {
	this.context.clearRect(0, 0, this.cw, this.ch);
	this.points = this.points.slice(this.points.length - 6, this.points.length);
	if (backgroundClear) {
		this.background = null;
	}
};

/**
 * Redraws the canvas using the points list.
 */
SWCanvas.prototype.redraw = function () {
	this.context.clearRect(0, 0, this.cw, this.ch);

	// Copy image as the first thing on the canvas as part of the GabeSave process.
	if (this.background) {
		var bgImage = document.createElement('img');
		bgImage.setAttribute('src', this.background);
		this.context.drawImage(bgImage, 0, 0, this.cw, this.ch);
	}

	this.context.lineJoin = 'round';

	for (var p in this.points) {
		if(this.points.hasOwnProperty(p)) {
			if (this.points[p].tool == 'brush') {
				// We're using the paintbrush and not stamps

				// Make brush size feel more natural
				this.context.lineWidth = (Math.pow(this.points[p].size / this.ch, 1.75) * this.ch / 2.0) + 1;
				this.context.strokeStyle = this.points[p].color;

				// Start drawing the line
				this.context.beginPath();

				if (this.points[p].dragging && p != 0) {
					this.context.moveTo(this.points[p - 1].x, this.points[p - 1].y);
				} else {
					this.context.moveTo(this.points[p].x - 1, this.points[p].y);
				}

				this.context.lineTo(this.points[p].x, this.points[p].y);
				this.context.closePath();
				this.context.stroke();
			} else {
				// We're adding stamps

				if (this.points[p].stamp) {
					var size = this.points[p].size * 1.5; // Where 1.5 is the size ratio of the canvas width to height
					// TODO: Make this not dependent on DOM
					if (this.points[p].stamp == 'hotswap') {
						this.context.drawImage($('#' + this.points[p].stamp + ' img')[0],
							this.points[p].x - Math.round(size / 2),
							this.points[p].y - Math.round(size / 3), size, size / 1.5);
					} else {
						this.context.drawImage($('#' + this.points[p].stamp + ' img')[0],
							this.points[p].x - (this.points[p].size / 2),
							this.points[p].y - (this.points[p].size / 2), this.points[p].size, this.points[p].size);
					}
				}
			}
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
	this.points.push({
		x: x,
		y: y,
		dragging: dragging,
		color: this.brush.color,
		size: this.brush.size,
		tool: this.brush.tool,
		stamp: (this.brush.tool === 'brush') ? null : this.brush.stamp
	});
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
 * Updates any parameter of the brush with parameters specified in the updates object.
 * @param updates {object} - The updates to apply to the brush object.
 */
SWCanvas.prototype.updateBrush = function(updates) {
	for(var u in updates) {
		if(updates.hasOwnProperty(u)) {
			if(this.brush[u] !== updates[u]) {
				this.brush[u] = updates[u];
			}
		}
	}
};

/**
 * Calculates canvas point coordinates based on event mouse coordinates.
 * @param x {number} - The event page X coordinate.
 * @param y {number} - The event page Y coordinate.
 * @returns {{x: number, y: number}}
 */
SWCanvas.prototype.calculateMouse = function(x, y) {
	// TODO: When viable, replace offset() with a native JS equivalent
	// TODO: Cache offset to boost performance, change on window resize
	return {
		x: (x - $(this.canvas).offset().left) / (this.canvas.offsetWidth / this.cw),
		y: (y - $(this.canvas).offset().top) / (this.canvas.offsetHeight / this.ch)
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
SWCanvas.prototype.moveImageDataToBackground = function () {
	this.background = this.canvas.toDataURL();
};

/**
 * Draws background from variable.
 */
SWCanvas.prototype.drawBackground = function () {
	if (this.background) {
		var imageLoad = function (bg) {
			this.clearAllCanvasData(false);
			this.context.clearRect(0, 0, this.cw, this.ch);
			this.context.drawImage(bg, 0, 0, this.cw, this.ch);
		};

		var bgImage = document.createElement('img');
		bgImage.setAttribute('src', this.background);
		bgImage.onload = imageLoad.bind(this, bgImage);
	}
};

/**
 * Moves image date to background, then starts drawing the image on the canvas as part of the GabeSave process.
 */
SWCanvas.prototype.imageToBg = function () {
	this.moveImageDataToBackground();
	this.drawBackground();
};
