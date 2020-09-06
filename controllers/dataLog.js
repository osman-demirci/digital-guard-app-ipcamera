var validator = require('validator');
var util = require('../services/util');
var ObjectID = require('mongodb').ObjectID;
var async = require('async');

const detectedFacedImageCollName = "detected_faced_image";
const staffCollName = "staff";
const staffDetectedFacedImageCollName = "staff_detected_faced_image";

exports.fetchAllDetectedFace = function(req, res, next) {
    var mongodb = req.db;
    let resData = {
	header : {
	    messages : null
	},
	body : {
	    detectedFacedImages : null,
	    selectableStaffs : null,
	}
    }

    async.parallel([

    function(callback) {

	let coll = mongodb.collection(detectedFacedImageCollName);
	coll.find({}).toArray(function(err, result) {
	    callback(err, result);
	});

    },

    function(callback) {
	let projections = {
	    name : 1,
	    surname : 1
	};
	let coll = mongodb.collection(staffCollName);
	coll.find({}, projections).toArray(function(err, result) {
	    callback(err, result);
	});

    }

    ], function(err, results) {
	if (err)
	    return next(err);
	if (results == undefined || results.length != 2)
	    return next(new Error("ResultSet is empty."));

	resData.header.messages = res.locals.flash;
	resData.body.detectedFacedImages = results[0];
	resData.body.selectableStaffs = results[1];
	res.render('secure/dataLog', resData);
    });
}

exports.deleteAllDetectedFace = function(req, res, next) {
    var mongodb = req.db;
    let coll = mongodb.collection(detectedFacedImageCollName);
    let query = {};

    coll.deleteMany(query, function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}
	res.redirect('/dataLog');
    });
}

exports.saveAllStaffFacedImage = function(req, res, next) {
    var mongodb = req.db;
    let data = req.body;

    var staffId = data.staffId;
    var facedImageIds = data.facedImageIds;

    if (validator.isEmpty(staffId) || !facedImageIds) {
	util.addMessage(res, 'message.error.validator.required', "error");
	return next(new Error("Validation error."));
    }

    if (!Array.isArray(facedImageIds)) {
	facedImageIds = [ facedImageIds ];
    }

    var facedImageObjectIds = [];
    facedImageIds.forEach(function(imageId) {
	facedImageObjectIds.push(ObjectID(imageId));
    });

    async.waterfall([

    function(callback) {

	let query = {
	    _id : {
		$in : facedImageObjectIds
	    }
	};

	let coll = mongodb.collection(detectedFacedImageCollName);
	coll.find(query).toArray(function(err, result) {
	    if (result == undefined)
		return next(new Error("Faced images data are not find."));
	    callback(err, result);
	});

    },

    function(facedImageDatas, callback) {

	let query = {
	    _id : ObjectID(staffId)
	};

	let projections = {
	    _id : 1,
	    staffNumber : 1
	};
	let coll = mongodb.collection(staffCollName);
	coll.findOne(query, projections, function(err, result) {
	    if (result == undefined)
		return next(new Error("Staff data is not find."));

	    callback(err, facedImageDatas, result);
	});

    }, function(facedImageDatas, staffData, callback) {

	/*
	 * if (facedImageData == undefined || staffData == undefined) return
	 * next(new Error("Staff or Faced Image data is not find."));
	 */

	var staffFacedImageDatas = [];

	facedImageDatas.forEach(function(facedImageData) {
	    staffFacedImageDatas.push({
		staffId : staffData._id,
		staffNumber : staffData.staffNumber,
		content : facedImageData.content,
		mimeType : facedImageData.mimeType,
		recordDate : new Date()
	    });
	});

	let coll = mongodb.collection(staffDetectedFacedImageCollName);
	coll.insertMany(staffFacedImageDatas, function(err, result) {
	    callback(err, result)
	});
    }

    ], function(err, results) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	let query = {
	    _id : {
		$in : facedImageObjectIds
	    }
	};

	let coll = mongodb.collection(detectedFacedImageCollName);
	coll.deleteMany(query, function(err, result) {
	    if (err) {
		util.addMessage(res, 'message.error.common.fail', "error");
		return next(err);
	    }
	    res.redirect('/dataLog');
	});

    });
}
