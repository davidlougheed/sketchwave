var SWCanvas = function (canvas) {
	this.canvas = document.getElementById(canvas);
	this.context = this.canvas.getContext('2d');

	this.cw = this.context.canvas.width;
	this.ch = this.context.canvas.height;

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

SWCanvas.prototype.clearAllCanvasData = function (backgroundClear) {
	this.context.clearRect(0, 0, this.cw, this.ch);
	this.points = this.points.slice(this.points.length - 6, this.points.length);
	if (backgroundClear) {
		this.background = null;
	}
};

SWCanvas.prototype.redraw = function () {
	this.context.clearRect(0, 0, this.cw, this.ch);
	if (this.background) {
		var bgImage = document.createElement('img');
		bgImage.setAttribute('src', this.background);
		this.context.drawImage(bgImage, 0, 0, this.cw, this.ch);
	}

	this.context.lineJoin = 'round';

	for (var p in this.points) {
		if(this.points.hasOwnProperty(p)) {
			if (this.points[p].tool == 'brush') {
				// Make brush size feel more natural
				this.context.lineWidth = (Math.pow(this.points[p].size / this.ch, 1.75) * this.ch / 2.0) + 1;
				this.context.strokeStyle = this.points[p].color;

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
				if (this.points[p].stamp) {
					var size = this.points[p].size * 1.5;
					// TODO: Make this not dependent on DOM
					if (this.points[p].stamp == 'hotswap') {
						this.context.drawImage($('#' + this.points[p].stamp + ' img')[0], this.points[p].x - Math.round(size / 2),
							this.points[p].y - Math.round(size / 3), size, size / 1.5);
					} else {
						this.context.drawImage($('#' + this.points[p].stamp + ' img')[0], this.points[p].x - (this.points[p].size / 2),
							this.points[p].y - (this.points[p].size / 2), this.points[p].size, this.points[p].size);
					}
				}
			}
		}
	}
};

SWCanvas.prototype.addPoint = function (x, y, dragging) {
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

SWCanvas.prototype.startPainting = function () {
	this.paint = true;
};
SWCanvas.prototype.stopPainting = function () {
	this.paint = false;
};

SWCanvas.prototype.updateBrush = function(updates) {
	for(var u in updates) {
		if(updates.hasOwnProperty(u)) {
			if(this.brush[u] !== updates[u]) {
				this.brush[u] = updates[u];
			}
		}
	}
};

SWCanvas.prototype.calculateMouse = function(x, y) {
	// TODO: When viable, replace offset() with a native JS equivalent
	// TODO: Cache offset to boost performance, change on window resize
	return {
		x: (x - $(this.canvas).offset().left) / (this.canvas.offsetWidth / this.cw),
		y: (y - $(this.canvas).offset().top) / (this.canvas.offsetHeight / this.ch)
	};
};

SWCanvas.prototype.setBrushSize = function (value) {
	this.brush.size = Math.round(value / 100.0 * this.ch);
};

SWCanvas.prototype.moveImageDataToBackground = function () {
	this.background = this.canvas.toDataURL();
};

SWCanvas.prototype.imageToBg = function () {
	this.moveImageDataToBackground();
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
