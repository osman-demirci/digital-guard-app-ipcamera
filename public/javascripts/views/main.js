var Websocket = {
    socket : undefined,
    connect : function() {

	try {
	    this.socket = io.connect('/websocket');
	} catch (e) {
	    this.logger(e);
	    return;
	}

	// Live Video Canvas
	var liveVideoCanvas = document.getElementById('liveVideoCanvas');
	this.socket.emit("join", "envMonitoring");
	this.socket.on('camera', function(data) {
	    var cameraData = data.cameraData;
	    if (cameraData) {
		Websocket.updateCanvasContext(liveVideoCanvas, cameraData);
	    }
	});

	// Detected Face Canvas
	var detectedFaceCanvas = document.getElementById('detectedFaceCanvas');
	this.socket.on('predictionResult', function(data) {

	    var resultData = data.resultData;
	    var auth = resultData.auth;
	    var principal = resultData.principal;
	    var evidence = resultData.evidence;

	    if (evidence) {
		Websocket.updateCanvasContext(detectedFaceCanvas, evidence);
	    }

	    var resultBox = document.getElementById('predictionResultBox');

	    var resultBoxContent = '<i class="fa fa-user-secret"></i>-';
	    if (auth == true) {
		resultBoxContent += '<label class="fc-green">';
	    } else if (auth == false) {
		resultBoxContent += '<label class="fc-red">';
	    } else {
		resultBoxContent += '<label class="fc-orange">';
	    }
	    resultBoxContent += principal + '</label>'

	    resultBox.innerHTML = resultBoxContent;

	});

	this.socket.on('pir', function(data) {
	    // console.log('Incoming message:', data);

	    var pirData = data.pirData;
	    if (pirData == true) {
		var element = document.getElementById('latestPirData');
		var pirCount = Number(element.innerHTML);
		pirCount = pirCount == undefined ? 0 : pirCount + 1;
		element.innerHTML = pirCount;

	    }
	});

	this.socket.on('dht', function(data) {
	    // console.log('Incoming message:', data);

	    var dhtData = data.dhtData;
	    if (dhtData) {
		var humElement = document.getElementById('latestHumData');
		var tempElement = document.getElementById('latestTempData');

		humElement.innerHTML = dhtData.hum;
		tempElement.innerHTML = dhtData.temp;
	    }
	});
    },

    disconnect : function() {
	try {
	    this.socket.disconnect()
	} catch (e) {
	    this.logger(e);
	    return;
	}
    },

    updateCanvasContext : function(imageCanvas, cameraData) {

	var base64String = undefined;

	if (cameraData instanceof ArrayBuffer) {
	    try {
		base64String = window.btoa(String.fromCharCode.apply(null, new Uint8Array(cameraData)));
	    } catch (e) {
		this.logger(e);
		return;
	    }
	} else {
	    base64String = cameraData
	}

	const imageContext = imageCanvas.getContext('2d');
	const image = new Image();

	image.src = 'data:image/png;base64,' + base64String;
	image.onload = function() {
	    imageContext.drawImage(this, 0, 0, imageCanvas.width, imageCanvas.height);
	};
    },

    logger : function(message) {
	if (console.log)
	    console.log(message);
    }
}

window.addEventListener('load', function(event) {
    Websocket.connect();
});

window.addEventListener("unload", function(event) {
    Websocket.disconnect();
});