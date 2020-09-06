var opencv = require('opencv4nodejs');
var mongodb = require('mongodb');
var async = require('async');
var fs = require('fs');
var i18n = require('i18n');
var schedule = require('node-schedule');

/*
 * Constant variables
 */
const staffCollName = "staff";
const detectedFacedImageCollName = "detected_faced_image";
const staffDetectedFacedImageCollName = "staff_detected_faced_image";
const liveDataRoomName = "envMonitoring";
const trainDataFileName = "./data/trained.xml";
const predictConfidenceThreshold = 80;
const defaultImageFormat = "jpeg";
const faceRecognizerImageSizes = [ 200, 200 ];
const faceDetectorImageSizes = [ 720, 1280 ];

const faceDetectorOptions = {
    scaleFactor : 1.1,
    minNeighbors : 3,
    flags : 0,
    minSize : new opencv.Size(),
    maxSize : new opencv.Size()
};

/**
 * @link https://docs.opencv.org/3.4/df/d25/classcv_1_1face_1_1LBPHFaceRecognizer.html
 */
const faceRecognizerOptions = {
    radius : 2,
    neighbors : 8,
    grid_x : 8,
    grid_y : 8,
    threshold : 80
};

var guard = function(mongodb, websocket, wsEndpoint) {

    var camera = undefined;
    var faceRecognizer = undefined;
    var faceDetector = undefined;
    var clearDetectedFacedImagesJob = undefined;
    var cameraOpened = false;
    var readImageIntervalId = undefined;
    var processingOnImage = false;

    function init() {
	// Face Detector
	trainDetector();
	// Face Recognizer
	trainRecognizer();

	// Events
	websocket.on('connection', function(socket) {
	    socket.on("join", function(value) {
		if (value != liveDataRoomName) {
		    console.log("Room name is invalid");
		    return;
		}

		console.log("Join room");
		socket.join(value);
		if (cameraOpened == false)
		    createCamera();
	    });
	});

	// Clear history data
	scheduleDataClearing();

	// Create camera
	createCamera();
    }

    function createCamera() {
	try {
	    cameraOpened = true;
	    if (camera == undefined) {
		//camera = new opencv.VideoCapture("rtsp://admin:welcome1@192.168.1.64/Streaming/Channels/103");
		camera = new opencv.VideoCapture(0);
	    }
	    // camera.set(opencv.CAP_PROP_FRAME_WIDTH, 640);
	    // camera.set(opencv.CAP_PROP_FRAME_HEIGHT, 360);
	    console.log("Camera is created. ");
	} catch (e) {
	    cameraOpened = false;
	    camera = undefined;
	    console.log(e);
	    throw e;
	}

	setTimeout(function() {
	    readImageIntervalId = setInterval(function() {
		readImage();
	    }, 35);
	}, 500);
    }

    function closeCamera() {
	if (camera == undefined) {
	    cameraOpened = false;
	    return;
	}
	try {
	    camera.release();
	    camera = undefined;
	    cameraOpened = false;
	    if (readImageIntervalId)
		clearInterval(readImageIntervalId);
	    console.log("Camera is closed.");
	} catch (e) {
	    console.log(e);
	}
    }

    function readImage() {

	if (camera == undefined)
	    return;

	let frameMat = null;
	try {
	    frameMat = camera.read();
	    if (frameMat.empty) {
		camera.reset();
	    }
	} catch (e) {
	    console.log(err);
	    return;
	}

	// console.log(camera.get(opencv.CAP_PROP_FRAME_WIDTH));
	if (!(frameMat instanceof opencv.Mat) || frameMat.sizes[0] < 20 || frameMat.sizes[1] < 20) {
	    return;
	}

	detectAndJudgeFace(frameMat);
    }

    function emitToRoom(roomName, event, data) {
	var room = websocket.clients().adapter.rooms[roomName];
	if (room != undefined && room.length > 0) {
	    websocket.to(roomName).emit(event, data);
	} else {
	    // console.log("Any user has not found in room");
	}
    }

    function detectAndJudgeFace(frameMat) {

	emitToRoom(liveDataRoomName, 'camera', {
	    status : 'OK',
	    cameraData : convertOpencvMatToBase64(frameMat),
	});

	if (processingOnImage == true) {
	    return;
	}

	processingOnImage = true;
	const inputFrameMat = prepImageForFaceDetector(frameMat);

	if (!inputFrameMat) {
	    processingOnImage = false;
	    return;
	}

	faceDetector.detectMultiScaleAsync(inputFrameMat).then(function(result) {

	    let detectedFaceRects = result.objects;
	    if (!detectedFaceRects.length) {
		processingOnImage = false;
		return;
	    }

	    detectedFaceRects.forEach(function(faceRect) {

		if (faceRect.width < 20 || faceRect.height < 20)
		    return;

		const faceMat = frameMat.getRegion(faceRect);
		var judgeResult = undefined;

		judgeDetectedFace(faceMat, function(judgeResult) {
		    if (judgeResult == undefined || judgeResult.evidence == undefined || judgeResult.auth == undefined)
			return;
		    const judgeResultStatus = judgeResult.auth == true ? "OK" : "UNAUTH";
		    emitToRoom(liveDataRoomName, 'predictionResult', {
			status : judgeResultStatus,
			resultData : judgeResult,
		    });
		});

	    });

	    processingOnImage = false;
	});

    }

    function saveDetectedFacedImage(base64Image) {
	const imageContent = base64Image;
	let data = {
	    content : imageContent,
	    mimeType : "image/" + defaultImageFormat,
	    recordDate : new Date()
	};

	let coll = mongodb.collection(detectedFacedImageCollName);
	coll.insertOne(data, function(err, res) {
	    if (err) {
		console.log(err);
		return;
	    }
	});
    }

    function scheduleDataClearing() {
	clearDetectedFacedImagesJob = schedule.scheduleJob("0 0 0 1/1 * ? *", function() {
	    console.log("Job has started.");
	    let minDataValidityDate = new Date((new Date().getTime() - 86400000));
	    let query = {
		"recordDate" : {
		    "$lt" : minDataValidityDate,
		}
	    };
	    let coll = mongodb.collection(detectedFacedImageCollName);
	    coll.deleteMany(query, function(err, result) {
		if (err) {
		    console.log(err);
		    return;
		}
		console.log("Clear Detected Faced Images Job has fired. Result : " + result);
	    });
	});
	clearDetectedFacedImagesJob.job();
    }

    function trainDetector() {
	if (faceDetector == undefined) {
	    faceDetector = new opencv.CascadeClassifier(opencv.HAAR_FRONTALFACE_ALT2);
	}
    }

    function trainRecognizer() {

	if (faceRecognizer == undefined) {
	    // faceRecognizer = new
	    // opencv.LBPHFaceRecognizer(faceRecognizerOptions);
	    faceRecognizer = new opencv.EigenFaceRecognizer();
	}

	let projections = {
	    content : 1,
	    staffNumber : 1
	};

	let coll = mongodb.collection(staffDetectedFacedImageCollName);
	coll.find({}, projections).toArray(function(err, result) {
	    if (err) {
		console.log(err);
		throw err;
	    }

	    let facedImages = result;
	    var trainSamples = [];
	    var trainSampleLabels = [];

	    for (let i = 0; i < facedImages.length; i++) {
		let facedImage = facedImages[i];

		var sampleOwnerId = new Number(facedImage.staffNumber).valueOf();
		let base64FacedImage = facedImage.content;

		if (sampleOwnerId == undefined || base64FacedImage == undefined)
		    continue;

		var sampleImage = opencv.imdecode(Buffer.from(base64FacedImage, 'base64'));
		sampleImage = prepImageForFaceRecognizer(sampleImage);
		if (sampleImage == null)
		    continue;

		trainSamples.push(sampleImage);
		trainSampleLabels.push(sampleOwnerId);

	    }

	    if (trainSamples.length < 3) {
		return;
	    }

	    console.log("Train recognizer operation has started.");
	    faceRecognizer.train(trainSamples, trainSampleLabels);
	    faceRecognizer.save(trainDataFileName);
	    console.log("Train recognizer operation has completed.");

	});
    }

    function judgeDetectedFace(faceMat, callback) {
	var judgeResult = {
	    auth : false,
	    principal : i18n.__("guard.waitForFaceDetection"),
	    evidence : undefined,
	};

	const base64FaceImage = convertOpencvMatToBase64(faceMat);
	const predictImage = prepImageForFaceRecognizer(faceMat);

	if (!predictImage || !base64FaceImage || !faceRecognizer) {
	    callback(judgeResult);
	    return;
	}

	saveDetectedFacedImage(base64FaceImage);
	judgeResult.evidence = base64FaceImage;

	let predictResult = undefined;
	try {
	    predictResult = faceRecognizer.predict(predictImage);
	} catch (e) {
	    console.log(e);
	} finally {
	    if (!predictResult) {
		callback(judgeResult);
		return;
	    }
	}

	let staffNumber = predictResult.label || -1;
	let confidence = new Number(predictResult.confidence || 0).valueOf();

	console.log(confidence);

	if (staffNumber == -1 || confidence < predictConfidenceThreshold || confidence > 100) {
	    judgeResult.auth = false;
	    judgeResult.principal = i18n.__("guard.unauthStaff");
	    callback(judgeResult);
	    return;
	}

	judgeResult.auth = true;
	staffNumber = staffNumber.toString();

	let coll = mongodb.collection(staffCollName);
	let query = {
	    staffNumber : staffNumber.length == 7 ? "0" + staffNumber : staffNumber
	};

	let projections = {
	    name : 1,
	    surname : 1
	};

	coll.findOne(query, projections, function(err, result) {

	    let principal = i18n.__("guard.guestStaff");
	    if (err)
		principal = err.message;
	    else if (result)
		principal = result.name + " " + result.surname;

	    judgeResult.principal = principal;
	    callback(judgeResult);
	});
    }

    function prepImageForFaceDetector(opencvMat) {
	try {
	    return opencvMat.bgrToGray();
	} catch (e) {
	    console.log(e);
	    return null;
	}
    }

    function prepImageForFaceRecognizer(faceMat) {
	try {
	    return faceMat.bgrToGray().resize(faceRecognizerImageSizes[0], faceRecognizerImageSizes[1]);
	} catch (e) {
	    console.log(e);
	    return null;
	}
    }

    function convertBase64ToOpencvMat(base64Image) {
	try {
	    return opencv.imdecode(Buffer.from(base64Image, 'base64'));
	} catch (e) {
	    console.log(e);
	    return null;
	}
    }

    function convertOpencvMatToBase64(opencvMat) {
	try {
	    return opencv.imencode("." + defaultImageFormat, opencvMat).toString('base64');
	} catch (e) {
	    console.log(e);
	    return null;
	}
    }

    function destroy(callback) {

	let errors = []

	try {
	    clearDetectedFacedImagesJob.cancel();
	} catch (e) {
	    errors.push(e);
	}

	try {
	    closeCamera();
	} catch (e) {
	    errors.push(e);
	    callback(errors);
	}
    }

    return {
	init : function() {
	    init();
	},
	train : function() {
	    trainRecognizer();
	},
	destroy : function() {
	    destroy(function(err) {
		console.log(err);
	    });
	}
    }

}

module.exports = guard;
