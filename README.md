hls-vod
=======

HTTP Live Streaming with on-the-fly encoding of any video file for Apple TV, iPhone, iPad, iPod, Mac Safari and other devices that support HTTP Live Streaming.

hls-vod lets you stream your whole video collection on-demand, regardless of format, to your iOS devices, playable from Safari, working with AirPlay as well. It does this by invoking ffmpeg on the fly through the command line.

Requirements
------------
- Tested on Linux and Mac, but it might work on Windows too.
- node.js (Tested on >0.8.14)
- ffmpeg (needs >v1, must be built with libx264)

Installation
------------
- git clone ...
- cd hls-vod
- npm install

Running
------------------------------
- Make sure you have node.js and ffmpeg (>1.0) in PATH
- node hls-vod.js --root-path /mnt/videos
- Browse to http://localhost:4040/


Arguments
------------------
--root-path PATH - Root path allowed to read files in.

--transcoder-path PATH - Will use ffmpeg in PATH if not specified

For more arguments run it without arguments: node hls-vod.js

Compiling ffmpeg
----------------
You need a fairly recent version

hint:
./configure --enable-libx264 --enable-gpl --enable-nonfree
make -j9 && make install
