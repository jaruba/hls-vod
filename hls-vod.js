var childProcess = require('child_process')
var url = require('url')
var fs = require('fs')
var path = require('path')
var readLine = require('readline')
var os = require('os')

// Parameters
var debug = false
var outputPath = path.join(os.tmpdir(), 'hls-vod-cache')
var processCleanupTimeout = 1 * 60 * 60 * 1000 // 1 hour
var playlistRetryTimeout = 60000 // 1 min
var playlistRetryDelay = 500
var minSegment = 10.0

// Program state
var probeProcesses = {}
var m3u8lists = {}

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath)

var log = function(msg) { if (debug) console.log(msg) }

module.exports = {
	playlist: function(ffprobePath, input, req, res, infohash, videoWidth, startAt) {
		handlePlaylistRequest(ffprobePath, input, res, url.parse(req.url).search, infohash, videoWidth, startAt)
	},
	segment: function(transcoderPath, input, req, res) {
		var urlQuery = url.parse(req.url, true).query

		var filename = req.url.split('/').pop().replace('stream-','')
		if (filename.indexOf('?'))
			filename = filename.substr(0, filename.indexOf('?'))

		var params = filename.split('_')

		handleSegmentRequest(transcoderPath, params[0], params[1], params[2], input, req, res, urlQuery)
	}
}

function handlePlaylistRequest(ffprobePath, file, response, queryString, infohash, videoWidth, startAt) {
	log('Playlist request: ' + file)
	
	if (!file) {
		response.writeHead(400);
		response.end();
		return
	}

	var hash = infohash + file.split('/').pop()
	var playlistPath = path.join(outputPath, hash + '_hls.m3u8');

	if (typeof m3u8lists[playlistPath] === 'undefined' && !fs.existsSync(playlistPath))
		spawnProbeProcess(ffprobePath, file, playlistPath, queryString, infohash, videoWidth);

	pollForPlaylist(file, response, playlistPath, queryString, videoWidth, startAt);
}

function spawnProbeProcess(ffprobePath, file, playlistPath, queryString, infohash, videoWidth) {

	m3u8lists[playlistPath] = ''

	var fileId = file.split('/').pop()
	var hash = infohash + fileId;
	var args = [
		'-i', file, '-show_frames', 
		'-skip_frame', 'nokey',
		'-select_streams', 'v',
		'-show_entries', 'frame=pkt_pts_time'
	]

	var startTime = Date.now()

	var probeChild = childProcess.spawn(ffprobePath, args, {cwd: outputPath, env: process.env})

	log(ffprobePath + ' ' + args.join(' '))

	probeProcesses[file] = probeChild

	var rl = readLine.createInterface(probeChild.stdout, probeChild.stdin)
	
	probeChild.stderr.on('data', function(data) { log(data.toString()) })
	
	var playlistPath = path.join(outputPath, hash + '_hls.m3u8');
	var write = (line, cb) => {
		m3u8lists[playlistPath] += line
		cb && cb()
	}
	var duration = minSegment * 1.1;
	write('#EXTM3U\n');
	write('#EXT-X-VERSION:3\n');
	write('#EXT-X-MEDIA-SEQUENCE:0\n');
	write('#EXT-X-ALLOW-CACHE:YES\n');
	write('#EXT-X-START:TIME-OFFSET=%startTime%,PRECISE=YES\n');
	write('#EXT-X-PLAYLIST-TYPE:EVENT\n');
	write('#EXT-X-TARGETDURATION:' + duration + '\n');
	var lastEnd = 0.0;
	var index = 0;
	rl.on('line', function (data) {
		var tmp=data.split('=');
		if (tmp.length == 2) {
			var pkt_time = parseFloat(tmp[1]);
			if (pkt_time - lastEnd >= minSegment * 0.9) {
				var duration = pkt_time - lastEnd;
				var durationStr = duration.toFixed(2);
				write('#EXTINF:' + durationStr + ',\n');
				var segment = encodeURIComponent('stream-' + index + '_' + lastEnd + '_' + durationStr + '_' + hash + '_%videoWidth%.ts') + '%queryString%';
				write(segment + '\n');
				lastEnd = pkt_time;
				index++;
			}
		}
	})
	
	rl.on('close', function() {
		write('#EXT-X-ENDLIST\n', function() {
			// save playlist to disk so we can clear it out from memory
			fs.writeFile(playlistPath, m3u8lists[playlistPath], function(err) {
				if (!err)
					delete m3u8lists[playlistPath]
			})
		})
	})
	
	probeChild.on('exit', function(code) {
		log(code == 0 ? ('Probe completed: ' + (Date.now() - startTime)) : ('Probe exited with code ' + code))
		delete probeProcesses[file]
	})

	// Kill any "zombie" processes
	setTimeout(function() {
		if (probeProcesses[file]) killProcess(probeProcesses[file])
	}, processCleanupTimeout)
}

function pollForPlaylist(file, response, playlistPath, queryString, videoWidth, startAt) {

	var numTries = 0;

	function checkPlaylistString(string, cb) {
		cb(!!(string.split(/\n/).length -1 >= 12)) // at least 12 lines (3 segments)
	}

	var fromMemory = function() {
		checkPlaylistString(m3u8lists[playlistPath] || '', function(found) {
			if (found) {
				response.setHeader('Content-Type', 'application/x-mpegURL');
				response.write(m3u8lists[playlistPath].replace('%startTime%', startAt).replace(new RegExp('%queryString%', 'g'), queryString).replace(new RegExp('%25videoWidth%25', 'g'), videoWidth));
				response.end();
			} else {
				if (numTries > playlistRetryTimeout/playlistRetryDelay) {
					log('Whoops! Gave up trying to open m3u8 file');
					response.writeHead(500);
					response.end();
				} else {
					log('Retrying playlist file...')
					numTries++
					setTimeout(fromMemory, playlistRetryDelay)
				}
			}
		})
	}

	var fromDisk = function() {
		var readStream = fs.createReadStream(playlistPath);

		readStream.on('error', function(err) {
			log(err);
			readStream.close();
			response.writeHead(500);
			response.end();
		});

		response.setHeader('Content-Type', 'application/x-mpegURL');

		processDiskPlaylist(readStream, function(line) {
			response.write(line + '\n');
		}, function() {
			response.end();
		}, startAt, queryString, videoWidth);
	}

	if (m3u8lists[playlistPath]) fromMemory()
	else if (fs.existsSync(playlistPath)) fromDisk();
	else
		setTimeout(function() {
			pollForPlaylist(file, response, playlistPath, queryString, videoWidth, startAt)
		}, 1000)
}

function processDiskPlaylist(readStream, eachLine, done, startAt, queryString, videoWidth) {
	var rl = readLine.createInterface({terminal: false, input: readStream});
	
	var foundPlaylistType = false;

	rl.on('line', function (line) {
		if (line.match('^#EXT-X-PLAYLIST-TYPE:')) foundPlaylistType = true;
		else if (line.match('^#EXTINF:') && !foundPlaylistType) {
			// Insert the type if it does not exist (ffmpeg doesn't seem to add this). Not having this set to VOD or EVENT will lead to no scrub-bar when encoding is completed
			eachLine('#EXT-X-PLAYLIST-TYPE:EVENT');
			foundPlaylistType = true;
		}
		
		eachLine(line.replace('%startTime%', startAt).replace(new RegExp('%queryString%', 'g'), queryString).replace(new RegExp('%25videoWidth%25', 'g'), videoWidth));
	});
	rl.on('close', function() {
		log('Done reading lines');
		done();
	});
}

function handleSegmentRequest(transcoderPath, index, start, duration, file, request, response, urlQuery) {

	log('Segment request: ' + file)

	if (!file) {
		response.writeHead(400);
		response.end();
		return
	}

	var startTime = convertSecToTime(start);
	var durationTime = convertSecToTime(duration);
	var args = [
		'-ss', startTime,
		'-t', durationTime,
		'-i', file,
		'-sn',
		'-async', '0',
		'-acodec',(urlQuery.needsAudio == -1 ? urlQuery.audio : 'copy'),
		'-b:a', urlQuery.ab,
		'-ar', '44100',
		'-ac', '2',
		'-r',  '30',
		'-vcodec', (urlQuery.needsVideo == -1 || urlQuery.resized == 'true' || urlQuery.needsAudio > -1 ? urlQuery.video : 'copy'),
		'-b:v', urlQuery.vb,
		'-profile:v', 'baseline',
		'-preset:v' ,'ultrafast',
//		'-crf', targetQuality,
		'-x264opts', 'level=3.0',
		'-threads', '0',
		'-flags',
		'-global_header',
		'-f', 'mpegts',
//		'-copyts',
		'-muxdelay', '0',
		'-v', '0',
		'-map', '0:v:' + (urlQuery.needsVideo > -1 ? urlQuery.needsVideo : '0'),
		'-map', '0:a:' + (urlQuery.needsAudio > -1 ? urlQuery.needsAudio : '0')
	];

	if (urlQuery.resized == 'true') {
		args.push('-vf')
		args.push('scale=w=' + urlQuery.targetWidth + ':h=trunc(ow/a/2)*2')
	}

	args.push('pipe:1')

	var encoderChild = childProcess.spawn(transcoderPath, args, {cwd: outputPath, env: process.env});

	log(transcoderPath + ' ' + args.join(' '));

	response.writeHead(200);
	
	encoderChild.stdout.on('data', function(data) {
		response.write(data);
	});
	
	encoderChild.on('exit', function(code) {
		log(code == 0 ? 'Encoder completed' : ('Encoder exited with code ' + code));
		response.end();
	});
	
	request.on('close', function() { killProcess(encoderChild) })

}

function killProcess(processToKill, callback) {

	log('Killing long running process')

	processToKill.kill()

	setTimeout(function() { processToKill.kill('SIGKILL') }, 5000)

	processToKill.on('exit', function(code) {
		if (callback) callback()
	})
}

function convertSecToTime(sec){
	var date = new Date(null)
	date.setSeconds(sec)
	var result = date.toISOString().substr(11, 8)
	var tmp = (sec + '').split('.')
	if(tmp.length == 2) result += '.' + tmp[1]
	return result
}
