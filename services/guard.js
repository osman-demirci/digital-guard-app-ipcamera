process.env.OPENCV4NODEJS_DISABLE_EXTERNAL_MEM_TRACKING = 1
var opencv = require('opencv4nodejs');
var opencvFr = require('face-recognition').withCv(opencv)
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
const staffFaceRecognitionTrainCollName = "staff_face_recognition_train";
const liveDataRoomName = "envMonitoring";
const trainDataFileName = "./data/trained.json";
const predictConfidenceThreshold = 75;
const defaultImageFormat = "jpeg";
const faceRecognizerImageSizes = [ 200, 200 ];
const faceDetectorImageSizes = [ 720, 1280 ];
const faceDetectorFaceImageSizes = faceRecognizerImageSizes;
const faceRecognizerNumJitters = 15

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
	// Create camera.
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
	    }, 40);
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

	const prepResult = prepImageForFaceDetector(frameMat);
	const inputFrameMat = prepResult.opencvMat;
	const inputImage = prepResult.opencvFrImage;

	if (!inputImage) {
	    processingOnImage = false;
	    return;
	}

	faceDetector.locateFaces(inputImage).then(function(faceRects) {

	    faceRects.forEach(function(faceRect) {

		if (!faceRect)
		    return;

		const faceMat = cropRegionFromOpencvMat(inputFrameMat, faceRect, faceDetectorFaceImageSizes);
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
	})
    }

    function cropRegionFromOpencvMat(sourceOpencvMat, dlibRect, faceSizes) {

	const faceRect = dlibRect.rect;
	const minImageWidth = 0;
	const maxImageWidth = faceDetectorImageSizes[1];
	const minImageHeight = 0;
	const maxImageHeight = faceDetectorImageSizes[0];
	const faceRectLeft = faceRect.left < minImageWidth ? minImageWidth : faceRect.left;
	const faceRectRight = faceRect.right > maxImageWidth ? maxImageWidth : faceRect.right;
	const faceRectTop = faceRect.top < minImageHeight ? minImageHeight : faceRect.top;
	const faceRectBottom = faceRect.bottom > maxImageHeight ? maxImageHeight : faceRect.bottom;
	const startX = faceRectLeft, startY = faceRectTop;
	const width = faceRectRight - faceRectLeft, height = faceRectBottom - faceRectTop;
	const opencvRect = new opencv.Rect(startX, startY, width, height);

	try {
	    return sourceOpencvMat.getRegion(opencvRect).copy().resize(faceSizes[0], faceSizes[1]);
	} catch (e) {
	    console.log(e);
	    return null;
	}
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
	    faceDetector = new opencvFr.AsyncFaceDetector();
	}
    }

    function trainRecognizer() {

	if (faceRecognizer == undefined)
	    faceRecognizer = new opencvFr.FaceRecognizer();

	const train = undefined;
	if (train) {
	    faceRecognizer.load(train.trainData);
	    return;
	}

	async.waterfall([

	function(callback) {

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
		const trainSamplesMap = new Map();
		let trainSamplesSize = 0;

		for (let i = 0; i < facedImages.length; i++) {
		    let facedImage = facedImages[i];

		    const sampleOwnerId = new Number(facedImage.staffNumber).valueOf();
		    let base64FacedImage = facedImage.content;

		    if (sampleOwnerId == undefined || base64FacedImage == undefined)
			continue;

		    const facedImageMat = convertBase64ToOpencvMat(base64FacedImage);
		    if (!facedImageMat)
			continue;

		    const sampleImage = prepImageForFaceRecognizer(facedImageMat);
		    if (sampleImage == null)
			continue;

		    let trainSamples = trainSamplesMap.get(sampleOwnerId);
		    if (!trainSamples) {
			trainSamples = new Array();
			trainSamplesMap.set(sampleOwnerId, trainSamples);
		    }

		    trainSamples.push(sampleImage);
		    trainSamplesSize++;
		}

		if (trainSamplesSize < 3) {
		    callback(null, null);
		    return;
		}

		console.log("Train recognizer operation has started at : " + new Date());
		trainSamplesMap.forEach(function(trainSamples, sampleOwnerId) {
		    faceRecognizer.addFaces(trainSamples, sampleOwnerId, faceRecognizerNumJitters);
		});

		const trainData = faceRecognizer.serialize();
		console.log("Train recognizer operation has completed at : " + new Date());

		let train = {
		    trainDate : new Date(),
		    trainData : trainData,
		    samplesSize : trainSamplesSize
		}

		callback(null, trainData);
	    });

	} ], function(err, results) {

	    if (err) {
		console.log(err);
		return;
	    }

	    if (!results || results.length == 0)
		return;

	    const trainData = results[0];
	    let coll = mongodb.collection(staffFaceRecognitionTrainCollName);
	    coll.deleteMany({}, function(err, result) {
		if (err) {
		    console.log(err);
		    return;
		}
	    });

	    coll.insertOne(trainData, function(err, res) {
		if (err) {
		    console.log(err);
		    return;
		}
	    });

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

	    console.log(predictImage);

	    predictResult = faceRecognizer.predictBest(predictImage);

	    console.log("predictResult : " + JSON.stringify(predictResult));

	} catch (e) {
	    console.log(e);
	} finally {
	    if (!predictResult) {
		callback(judgeResult);
		return;
	    }
	}

	let staffNumber = predictResult.className || -1;
	const predictDistance = new Number(predictResult.distance).valueOf();
	const confidence = !predictDistance ? 0 : 100 * (1 - predictDistance);

	if (staffNumber == -1 || confidence < predictConfidenceThreshold) {
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

	let opencvFrImage = null;

	try {
	    if (opencvMat.sizes[0] != faceDetectorImageSizes[0]) {
		opencvMat = opencvMat.resize(faceDetectorImageSizes[0], faceDetectorImageSizes[1]);
	    }
	    opencvFrImage = opencvFr.CvImage(opencvMat);
	} catch (e) {
	    console.log(e);
	}

	return ({
	    opencvMat : opencvMat,
	    opencvFrImage : opencvFrImage
	});
    }

    function prepImageForFaceRecognizer(faceMat) {
	const faceSizes = faceRecognizerImageSizes;
	try {
	    return opencvFr.cvImageToImageRGB(opencvFr.CvImage(faceMat.resize(faceSizes[0], faceSizes[1])));
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
