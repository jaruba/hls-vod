$(function() {
	var $videoContainer = $('#video-container');
	var $audioPlayer = $('audio');
	var $audioContainer = $('#audio-container');
	var $previewImage = $('#preview-image');
	var $playerLoading = $('#player-loading');

	// State
	var mediaElement;
	var loading = false;

	function audioStop() {
		$audioPlayer.prop('controls', false);
		$audioPlayer[0].pause();
		$audioContainer.hide();
	}

	function videoStop() {
		if (mediaElement) {
			mediaElement.pause();
			$videoContainer.hide();
		}
	}
	
	function imageShow(path, name) {
		window.open(path);
	}

	function audioPlay(path, name) {
		$('#audio-song-name').text(name);
		
		videoStop();
		audioStop();
		hidePreviewImage();

		$audioPlayer.prop('controls', true);
		$audioContainer.show();

		$audioPlayer[0].src = path;
		$audioPlayer[0].load();
		$audioPlayer[0].play();
	}

	function videoPlay(path) {
		audioStop();
		hidePreviewImage();

		$videoContainer.show();

		if (mediaElement) {
			mediaElement.pause();
			
			mediaElement.setSrc(path);
			mediaElement.play();
		}
		else {
			var $video = $('#video');
			$video[0].src = path;
			$video.mediaelementplayer({
				features: ['playpause', 'gesture', 'current', 'progress', 'duration', 'volume', 'speed', 'fullscreen'],
				renderers: ['vod'],
				clickToPlayPause: false,
				success: function (mediaElement2, domObject) {
					mediaElement = mediaElement2;
					mediaElement.play();
				},
				error: function (mediaeElement, err) {
					console.log('Error loading media element');
				}
			});
		}
	}

	function hidePreviewImage() {
		$playerLoading.fadeOut(200);
		$previewImage.hide();
	}

	function showPreviewImage(relPath) {
		var path = '/thumbnail' + relPath;
		$previewImage.attr('src', path).fadeIn(200);
		$playerLoading.fadeIn(200);
		$previewImage.on('load', function() {
			$playerLoading.fadeOut(200);
		});
		videoStop();
		audioStop();
	}
	
	function browseTo(path) {
		if (loading) return;
		loading = true;

		var $fileList = $('#file-list');
		
		$.ajax('/browse/' + path, {
			success: function(data) {
				loading = false;

				$('#dir-header').text(data.cwd);

				$('#btn_delete').unbind('click').click(function(){
					if (window.confirm("Delete\n" + data.cwd +"\nAre you sure?")) {
						$.get('/deldir' + data.cwd, function(ret){
							if (ret=='ok'){
								browseTo(path + encodeURIComponent('/..'));
							}
						});
					}
					return false;
				});
					
				$fileList.empty();

				var prev = $('<div class="list-group-item file-item"/>');
				prev.append($('<div class="list-group-itemi-heading file-title">Prev</>'));
				prev.click(function(){
					if (data.prev) {
					  browseTo(encodeURIComponent(data.prev));
					};
				});
				$fileList.append(prev);
        var next = $('<div class="list-group-item file-item"/>');
				next.append($('<div class="list-group-itemi-heading file-title">Next</>'));
				next.click(function(){
					if (data.next) {
					  browseTo(encodeURIComponent(data.next));
					};
				});
				$fileList.append(next);
				var back = $('<div class="list-group-item file-item"/>');
				back.append($('<div class="list-group-item-heading file-title">..</>'));
				back.click(function() {
					browseTo(data.cwd != '/' ? path + encodeURIComponent('/..') : path);
				});
				$fileList.append(back);

				$.each(data.files, function(index, file) {
					var elem = $('<div class="list-group-item file-item"/>');
					var title = $('<div class="list-group-item-heading file-title">');
					title.text(file.name);
					elem.append(title);
					var dropDown = $('<div class="dropdown file-action"><span type="button" data-toggle="dropdown" class="file-dropdown dropdown-toggle"><span class="glyphicon glyphicon-menu-hamburger"></span></span></div>');
					var dropMenus = [];//$('<ul class="dropdown-menu"></ul>');
					
					switch(file.type) {
					case 'video':
						title.click(function() {
							$("#video_title").text(file.name);
							videoPlay(file.path);
						});
						break;

					case 'audio':
						title.click(function() {
							audioPlay(file.path, file.name);
						});
						break;
					case 'image':
						title.click(function() {
							imageShow(file.path, file.name);
						});
						break;
					case 'directory':
						title.click(function() {
							browseTo(encodeURIComponent(file.path));
						});
						break;
					
						default:
					}
					
					if (file.error) {
						elem.attr('title', file.errorMsg);
					}

					if (file.type == 'video' || file.type == 'audio') {
						var infoLink = $('<a  />').attr('href', '/info' + file.relPath).text('Information');
						infoLink.click(function(event) {
							$.get(this.href,function(rsp){
								$("#mediainfo .modal-body p").html(rsp);
								$("#mediainfo").modal('show');
							});
							return false;
						});
						dropMenus.push($('<li/>').append(infoLink));
					}

					if (file.type != 'directory' ) {
						var delLink = $('<a  />').attr('href', '/del' + file.relPath).text('Delete');
						delLink.click(function(event) {
							if (window.confirm("Delete\n" + file.relPath +"\nAre you sure?")) {
								$.get(this.href, function(){
									browseTo(path);
								});
							}
							return false;
						});
						if (dropMenus.length) {
							dropMenus.push($('<li role="separator" class="divider"></li>'));
						}
						dropMenus.push($('<li/>').append(delLink));
					}

					if (dropMenus.length) {
						var dropMenu = $('<ul class="dropdown-menu"></ul>');
						for(i in dropMenus) {
							dropMenu.append(dropMenus[i]);
						}
						dropDown.append(dropMenu);
						elem.prepend(dropDown);
					}
					
					$fileList.append(elem);
				});
			}
		});
	}
	

	$('#settings-btn').click(function() {
		$('#settings-container').fadeToggle();
	});

	$('#settings-container select[name=videoWidth]').change(function() {
		$.ajax('/settings', {
			data: {
				videoWidth: $(this).val()
			},
			type: 'POST',
			error: function() {
				alert('Failed');
			}
		});
	});

  $('#settings-container select[name=videoQuality]').change(function() {
		$.ajax('/settings', {
			data: {
				videoQuality: $(this).val()
			},
			type: 'POST',
			error: function() {
				alert('Failed');
			}
		});
	});

	$.get('/settings', function(data) {
		$('#settings-container select[name=videoWidth]').val(data.videoWidth);
		$('#settings-container select[name=videoQuality]').val(data.videoQuality);
	});
	
	
	var url = $(location).attr('href');
	var param = url.split('?path=');
	if (param.length == 2) {
		browseTo(param[1]);
	} else {
		browseTo('/');
	}
	
	$videoContainer.hide();
	$audioContainer.hide();
	$previewImage.hide();
	$playerLoading.hide();
});
