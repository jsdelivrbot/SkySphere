/**
 * Represents a sky map.
 * @module SkySphere
 * @private
 * @requires module:constellations
 * @returns {function} SkySphere constructor.
 */
define(['constellations'], function(constellations) {
	
	// Frame Per Second: used in browser that don't support requestAnimationFrame.
	var FPS = 15;
	
	var supportTouch = 'ontouchstart' in window;
	// Size of the sensitive area around a sky point that detects clicks.
	var area = supportTouch ? 15 : 6;
	
	// All created SkySpheres
	var instances = [];
	
	/**
	 * Convert a declination angle from degree to radians (in range from 0 to 2PI).
	 * @private
	 * @param {float} dec - declination angle in degree (from -90 to 90).
	 */
	function dec2rad(dec) {
		return (dec + 90) * 2 * Math.PI / 360;
	}
	
	/**
	 * Convert a right ascension angle from degree to radians (in range from 0 to 2PI).
	 * @private
	 * @param {float} ra - right ascension angle in hours (from 0 to 24).
	 */
	function ra2rad(ra) {
		return ra * 2 * Math.PI / 24;
	}
	
	var renew;
	function step() {
		renew = false;
		
		for(var i = 0; i < instances.length; i++) {
			if(instances[i].isMoving) {
				renew = true;
				instances[i].drawSky();
			}
		}
		if(renew) {
			nextFrame();
		}
	}
	
	function nextFrame() {
		if(window.requestAnimationFrame) {
			window.requestAnimationFrame(step);
		} else {
			setTimeout(step, 1000 / FPS);
		}
	}
	
	/**
	 * Represents a sky map.
	 * @constructor
	 * @alias SkySphere
	 * @param {string} elementId - canvas id
	 * @param {object} options - sky map options
	 * @description Supported options:
	 * <ul>
	 * <li><strong>width</strong>: container width in pixels.</li>
	 * <li><strong>height</strong>: container height in pixels.</li>
	 * <li><strong>initialRadius</strong>: initial radius of the sphere in pixels.</li>
	 * <li><strong>backgroundColor</strong>: sky background color in hexadecimal format.</li>
	 * <li><strong>customOnClick</strong>: function to be executed when clicking on added custom objects.</li>
	 * </ul>
	 */
	function SkySphere(elementId, options) {
		this.options = options;
		this.init(elementId);
		instances.push(this);
	}
	
	SkySphere.prototype.zoomFactor = 1;
	SkySphere.prototype.starLines = [];
	SkySphere.prototype.starPoints = [];
	SkySphere.prototype.objectPoints = [];
	SkySphere.prototype.isMoving = false;
	
	SkySphere.prototype.init = function(elementId) {
		var self = this;
		
		this.canvas = document.getElementById(elementId);
		this.containerWidth = this.canvas.width = this.options.width || 400;
		this.containerHeight = this.canvas.height = this.options.height || this.containerWidth;
		
		this.radius = this.initialRadius = this.options.initialRadius || Math.min(this.containerWidth, this.containerHeight) * 0.45;
		
		this.context = this.canvas.getContext('2d');
		this.context.lineWidth = 1;
		
		// Generating the sky lines and points.
		
		var i, constellationLines = constellations.l, stars = constellations.s;
		for(i = 0; i < constellationLines.length; i++) {
			var star = stars[constellationLines[i][0]];
			var skyPoint1 = this.generateSkyPoint(star[0], star[1]);
			star = stars[constellationLines[i][1]];
			var skyPoint2 = this.generateSkyPoint(star[0], star[1]);
			this.starLines.push({ skyPoint1: skyPoint1, skyPoint2: skyPoint2 });
		}
		
		for(i = 0; i < stars.length; i++) {
			this.starPoints.push(this.generateSkyPoint(stars[i][0], stars[i][1]));
		}
		
		var clientRect, startX, startY, prevX, prevY, x, y, e;
		
		function startMove(event) {
			event.preventDefault();
			e = supportTouch ? event.touches[0] : event;
			
			self.isMoving = true;
			
			prevX = startX = e.clientX;
			prevY = startY = e.clientY;
			
			clientRect = self.canvas.getBoundingClientRect();
			x = startX - clientRect.left;
			y = startY - clientRect.top;
			
			window.addEventListener(supportTouch ? 'touchmove' : 'mousemove', onMove, false);
			window.addEventListener(supportTouch ? 'touchend' : 'mouseup', stopMove, false);
			nextFrame();
		}
		
		function onMove(event) {
			e = supportTouch ? event.touches[0] : event;
			self.rotateXY((e.clientX - prevX) / self.radius, (e.clientY - prevY) / self.radius);
			prevX = e.clientX;
			prevY = e.clientY;
		}
		
		function stopMove() {
			self.isMoving = false;
			window.removeEventListener(supportTouch ? 'touchmove' : 'mousemove', onMove, false);
			window.removeEventListener(supportTouch ? 'touchend' : 'mouseup', stopMove, false);
			
			if(prevX === startX && prevY === startY && self.options.customOnClick) {
				// single click detected!
				for(var i = 0; i < self.objectPoints.length; i++) {
					var skyPoint = self.objectPoints[i];
					if(Math.abs(skyPoint.x - x) < area && Math.abs(skyPoint.y - y) < area && skyPoint.z >= 0) {
						self.options.customOnClick(skyPoint.data.clickData);
						return;
					}
				}
			}
		}
		
		this.canvas.addEventListener(supportTouch ? 'touchstart' : 'mousedown', startMove);
	};

	SkySphere.prototype.generateSkyPoint = function(ra, dec, data) {
		var skyPoint = {
			x: this.radius * Math.sin(dec) * Math.cos(ra) + this.containerWidth / 2,
			y: -this.radius * Math.sin(dec) * Math.sin(ra) + this.containerHeight / 2,
			z: this.radius * Math.cos(dec)
		};
		
		if (data !== undefined) {
			skyPoint.data = data;
		}
		
		return skyPoint;
	};

	/**
	 * Draw constellations lines and stars and added custom objects.
	 * @private
	 */
	SkySphere.prototype.drawSky = function() {
		var context = this.context;
		var i, star, skyPoint, skyPoint1, skyPoint2, radius;
		
		context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		context.fillStyle = this.options.backgroundColor || '#000';
		context.strokeStyle = '#666';
		context.beginPath();
		context.arc(this.containerWidth / 2, this.containerHeight / 2, this.radius, 0, 2 * Math.PI, true);
		context.fill();
		context.stroke();
		
		context.strokeStyle = '#aaa';
		for(i = 0; i < this.starLines.length; i++) {
			star = this.starLines[i];
			skyPoint1 = star.skyPoint1;
			skyPoint2 = star.skyPoint2;
			if(skyPoint1.z > 0 && skyPoint2.z > 0) {
				context.beginPath();
				context.moveTo(Math.floor(skyPoint1.x), Math.floor(skyPoint1.y));
				context.lineTo(Math.floor(skyPoint2.x), Math.floor(skyPoint2.y));
				context.stroke();
			}
		}
		
		context.fillStyle = '#fff';
		for(i = 0; i < this.starPoints.length; i++) {
			skyPoint = this.starPoints[i];
			if(skyPoint.z >= 0) {
				context.beginPath();
				context.arc(Math.floor(skyPoint.x), Math.floor(skyPoint.y), 2, 0, 2 * Math.PI, true);
				context.fill();
			}
		}
		
		for(i = 0; i < this.objectPoints.length; i++) {
			skyPoint = this.objectPoints[i];
			if(skyPoint.z >= 0) {
				context.fillStyle = skyPoint.data.color || '#ff0000';
				context.beginPath();
				radius = skyPoint.data.radius || 2;
				context.arc(Math.floor(skyPoint.x), Math.floor(skyPoint.y), radius, 0, 2 * Math.PI, true);
				context.fill();
			}
		}
	};
	
	/**
	 * Apply a transformation to all elements of the sky.
	 * @param {function} transform - function to apply to each sky point passed as argument.
	 */
	SkySphere.prototype.applyTransform = function(transform) {
		var i;
		// Update constellation lines
		for(i = 0; i < this.starLines.length; i++) {
			var starLine = this.starLines[i];
			transform(starLine.skyPoint1);
			transform(starLine.skyPoint2);
		}
		// Update stars
		for(i = 0; i < this.starPoints.length; i++) {
			transform(this.starPoints[i]);
		}
		// Update custom objects
		for(i = 0; i < this.objectPoints.length; i++) {
			transform(this.objectPoints[i]);
		}
	};

	/**
	 * Rotate the sphere using the mouse drag.
	 * @private
	 * @param {float} dx - position offset on x axis.
	 * @param {float} dy - position offset on y axis.
	 */
	SkySphere.prototype.rotateXY = function(dy, dx) {
		var x, y;
		
		var sindx = Math.sin(dx), cosdx = Math.cos(dx), sindy = Math.sin(dy), cosdy = Math.cos(dy);
		var my1 = sindx * sindy, my3 = sindx * cosdy;
		var mz1 = cosdx * sindy, mz3 = cosdx * cosdy;
		
		var centerX = this.containerWidth / 2;
		var centerY = this.containerHeight / 2;
		
		this.applyTransform(function(skyPoint) {
			x = skyPoint.x - centerX;
			y = -skyPoint.y + centerY;
			skyPoint.x = x * cosdy + skyPoint.z * sindy + centerX;
			skyPoint.y = -x * my1 - y * cosdx + skyPoint.z * my3 + centerY;
			skyPoint.z = -x * mz1 + y * sindx + skyPoint.z * mz3; 
		});
	};
	
	SkySphere.prototype._centeringXTimeout = null;
	SkySphere.prototype._centeringYTimeout = null;
	/**
	 * Show an animation that move a sky point to the center of the sphere, first horizontally, then vertically.
	 * @param {object} skyPoint - the point to center.
	 */
	SkySphere.prototype.centerSkyPoint = function(skyPoint) {
		var self = this;
		
		// If we want to center a point while another point is already centering we have to stop previous animations.
		if(this._centeringXTimeout) {
			clearTimeout(this._centeringXTimeout);
		}
		if(this._centeringYTimeout) {
			clearTimeout(this._centeringYTimeout);
		}
		
		var centerX = this.containerWidth / 2;
		var centerY = this.containerHeight / 2;
		var dx = skyPoint.x < centerX ? .05 : -.05;
		var dy = skyPoint.y > centerY ? .05 : -.05;
		
		function moveXUntilCenter() {
			var x = skyPoint.x - centerX;
			if (x !== 0 && (dx > 0 && x < 0) || (dx < 0 && x > 0)) {
				self.rotateXY(dx, 0);
				self._centeringXTimeout = setTimeout(moveXUntilCenter, 30);
			} else {
				moveYUntilCenter();
			}
		}
		function moveYUntilCenter() {
			var y = -skyPoint.y + centerY;
			if (y !== 0 && (dy > 0 && y < 0) || (dy < 0 && y > 0)) {
				self.rotateXY(0, -dy);
				self._centeringYTimeout = setTimeout(moveYUntilCenter, 30);
			} else {
				self.isMoving = false;
			}
		}
		
		this.isMoving = true;
		nextFrame();
		moveXUntilCenter();
	};
	
	/**
	 * Zoom the sphere multiplying the current radius to the zoomFactor.
	 * @param {float} zoomFactor
	 */
	SkySphere.prototype.zoom = function(zoomFactor) {
		var self = this;
		
		this.radius = this.radius * zoomFactor;
		
		var centerX = this.containerWidth / 2;
		var centerY = this.containerHeight / 2;
		this.applyTransform(function(skyPoint) {
			self.zoomFactor = zoomFactor;
			skyPoint.x = zoomFactor * (skyPoint.x - centerX) + centerX;
			skyPoint.y = zoomFactor * (skyPoint.y - centerY) + centerY;
			skyPoint.z = zoomFactor * skyPoint.z;
		});
		
		this.drawSky();
	};
	
	/**
	 * Zoom the sphere relying on its initial radius.
	 * @param {float} zoomFactor
	 */
	SkySphere.prototype.absoluteZoom = function(zoomFactor) {
		this.zoom((this.initialRadius * zoomFactor) / this.radius);
	};
	
	/**
	 * Change the container size and rescale the sky.
	 * @param {int} width - new width of the container.
	 * @param {int} height - new height of the container.
	 * @param {bool} resize - optional param to indicate if we want to adapt the sphere to the container size after container resizing.
	 * @param {float} paddingPercentage - percentage (from 0 to 1) of canvas size to leave empty between sphere and container border.
	 */
	SkySphere.prototype.setContainerSize = function(width, height, resize, paddingPercentage) {
		var offsetX = (width - this.containerWidth) / 2;
		var offsetY = (height - this.containerHeight) / 2;
		
		this.canvas.width = this.containerWidth = width;
		this.canvas.height = this.containerHeight = height;
		
		this.applyTransform(function(skyPoint) {
			skyPoint.x += offsetX;
			skyPoint.y += offsetY;
		});
		
		if(resize) {
			this.zoom(Math.min(width, height) * (paddingPercentage || 0.9) / ( 2 * this.radius));
		}
	};

	/**
	 * Add a custom object point.
	 * @param {float} ra - Right Ascension (in hours, from 0 to 24)
	 * @param {float} dec - Declination (in degree, from -90 to 90)
	 * @param {object} data - custom optional data to add to the object.
	 * @returns {object} the generated sky point.
	 * @description The "data" option is an object that supports this properties:
	 * <ul>
	 * <li><strong>color</strong>: custom color in hexadecimal format (default is '#ff0000').</li>
	 * <li><strong>radius</strong>: radius in pixels (default is 2).</li>
	 * <li><strong>clickData</strong>: object that will be passed to the <strong>customOnClick</strong> function when clicking on the custom object.</li>
	 * </ul>
	 */
	SkySphere.prototype.addCustomObject = function(ra, dec, data) {
		var skyPoint = this.generateSkyPoint(ra2rad(ra), dec2rad(dec), data);
		this.objectPoints.push(skyPoint);
		return skyPoint;
	};
	
	return SkySphere;
});