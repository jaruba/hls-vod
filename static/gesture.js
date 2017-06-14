/*!
 * MediaElement.js
 * http://www.mediaelementjs.com/
 *
 * Wrapper that mimics native HTML5 MediaElement (audio and video)
 * using a variety of technologies (pure JavaScript, Flash, iframe)
 *
 * Copyright 2010-2017, John Dyer (http://j.hn/)
 * License: MIT
 *
 */(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
'use strict';


Object.assign(mejs.MepDefaults, {
	pancount : 10
});

Object.assign(MediaElementPlayer.prototype, {
	buildgesture: function buildgesture(player, controls, layers, media) {
		var t = this;
		player.gesture={};
		var gesture=player.gesture;
		gesture.seekTimeStart = -1;
		gesture.seekTimeLayer = document.createElement('div');
		gesture.seekTimeLayer.className = t.options.classPrefix + "layer " + t.options.classPrefix + "overlay";
		gesture.seekTimeLayer.innerHTML = "<div class=\"" + t.options.classPrefix + "seek-time-layer\"></div>";

		gesture.seekTimeLayer.style.display = 'none';

		layers.insertBefore(gesture.seekTimeLayer, layers.querySelector("." + t.options.classPrefix + "overlay-play"));

		
		player.hammer = new Hammer(player.container, {threshold:50, direction:Hammer.DIRECTION_VERTICAL});
		player.hammer.on('panstart panend panleft panright', function(ev) {
			switch(ev.type){
				case "panstart":
					gesture.seekTimeStart = player.getCurrentTime();
					
					break;
				case "panleft":
				case "panright":
					if (Math.abs(ev.deltaX) > 20 && Math.abs(ev.deltaY) < 20) {
						player.pause();
						player.showControls();
						gesture.seekTimeLayer.style.display = 'block';
						var date = new Date(null);
						var seekTo = gesture.seekTimeStart + ev.deltaX / 10;
						if (seekTo < 0) {
							seekTo = 0;
						}
						date.setSeconds(seekTo); // specify value for SECONDS here
						gesture.seekTimeLayer.children[0].innerHTML = date.toISOString().substr(11, 8) + '<br>' + (ev.deltaX >= 0 ? '+' : '') +  parseInt((ev.deltaX / 10)) /*+ ':' + ev.deltaX + ':' + ev.deltaY*/;
					}
					break;
				case "panend":
					var seekTo = gesture.seekTimeStart + ev.deltaX / 10;
					gesture.seekTimeLayer.style.display = 'none';
					gesture.seekTimeStart = -1;
					if (Math.abs(player.getCurrentTime() - seekTo) > 1) {
						player.setCurrentTime(seekTo);
					}
					player.play();
					break;
			}
		});
	},
	cleargesture: function cleargesture(player) {
		if (player) {
		}
	}
});

},{}]},{},[1]);
