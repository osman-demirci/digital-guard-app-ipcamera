var validator = require('validator');
var util = require('../services/util');
var ObjectID = require('mongodb').ObjectID;
var dateformat = require('dateformat');

const staffCollName = "staff";
const staffDetectedFacedImageCollName = "staff_detected_faced_image";

exports.fetchAllStaff = function(req, res, next) {

    var mongodb = req.db;
    let resData = {
	header : {
	    renderStaffTable : true,
	    renderStaffCrudPanel : false,
	    renderStaffFacedImagesPanel : false,
	    messages : null
	},
	body : {
	    staffs : null
	}
    }

    let projections = {
	name : 1,
	surname : 1,
	email : 1,
	telephoneNum : 1,
	province : 1,
	district : 1,
	address : 1,
    };

    let coll = mongodb.collection(staffCollName);
    coll.find({}, projections).toArray(function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	resData.header.messages = res.locals.flash;
	resData.body.staffs = result;
	res.render('secure/staff', resData);
    });
}

exports.createStaff = function(req, res, next) {
    let resData = {
	header : {
	    renderStaffTable : false,
	    renderStaffCrudPanel : true,
	    renderStaffFacedImagesPanel : false,
	},
	body : {
	    staffs : null
	}
    }

    resData.header.messages = res.locals.flash;
    res.render('secure/staff', resData);
    return;
}

exports.fetchStaff = function(req, res, next) {
    let staffId = req.params.staffId;
    var mongodb = req.db;
    let resData = {
	header : {
	    renderStaffTable : false,
	    renderStaffCrudPanel : true,
	    renderStaffFacedImagesPanel : false,
	},
	body : {
	    staff : null
	}
    }

    let coll = mongodb.collection(staffCollName);
    let query = {
	_id : ObjectID(staffId)
    };
    let projections = {
	name : 1,
	surname : 1,
	email : 1,
	telephoneNum : 1,
	province : 1,
	district : 1,
	address : 1,
    };

    coll.findOne(query, projections, function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	resData.header.messages = res.locals.flash;
	resData.body.staff = result;
	res.render('secure/staff', resData);
    });

}

exports.fetchAllStaffFacedImage = function(req, res, next) {
    let staffId = req.params.staffId;
    var mongodb = req.db;
    let resData = {
	header : {
	    renderStaffTable : false,
	    renderStaffCrudPanel : false,
	    renderStaffFacedImagesPanel : true,
	},
	body : {
	    staffFacedImages : null,
	}
    }

    let query = {
	staffId : ObjectID(staffId)
    };

    let coll = mongodb.collection(staffDetectedFacedImageCollName);
    coll.find(query).toArray(function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	resData.header.messages = res.locals.flash;
	resData.body.staffFacedImages = result;
	res.render('secure/staff', resData);
    });

}

exports.saveStaff = function(req, res, next) {
    var mongodb = req.db;
    let data = req.body;
    let validate = true;

    if (validator.isEmpty(data.surname) || validator.isEmpty(data.telephoneNum)) {
	util.addMessage(res, 'message.error.validator.required', "error");
	validate = false;
    }

    if (!validator.isEmail(data.email)) {
	util.addMessage(res, 'message.error.validator.email', "error");
	validate = false;
    }

    if (!validate) {
	let resData = {
	    header : {
		renderStaffTable : false,
		renderStaffCrudPanel : true,
		renderStaffFacedImagesPanel : false,
	    },
	    body : {
		staff : null
	    }
	}
	resData.header.messages = res.locals.flash;
	resData.body.staff = data;
	res.render('secure/staff', resData);
	return;
    }

    const staffNumberPattern = "ddHHMMss";
    data.staffNumber = dateformat(new Date(), staffNumberPattern);

    let coll = mongodb.collection(staffCollName);
    coll.insertOne(data, function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	res.redirect('/staff');
    });
}

exports.updateStaff = function(req, res, next) {
    var mongodb = req.db;
    let data = req.body;
    let staffId = req.params.staffId;

    let validate = true;

    if (validator.isEmpty(staffId) || validator.isEmpty(data.name) || validator.isEmpty(data.surname) || validator.isEmpty(data.telephoneNum)) {
	util.addMessage(res, 'message.error.validator.required', "error");
	validate = false;
    }

    if (!validator.isEmail(data.email)) {
	util.addMessage(res, 'message.error.validator.email', "error");
	validate = false;
    }

    if (!validate) {
	let resData = {
	    header : {
		renderStaffTable : false,
		renderStaffCrudPanel : true,
		renderStaffFacedImagesPanel : false,
	    },
	    body : {
		staff : null
	    }
	}
	resData.header.messages = res.locals.flash;
	resData.body.staff = data;
	res.render('secure/staff', resData);
	return;
    }

    let coll = mongodb.collection(staffCollName);
    let query = {
	_id : ObjectID(staffId)
    };

    coll.updateOne(query, data, function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	res.redirect('/staff');
    });
}

exports.deleteStaff = function(req, res, next) {

    var mongodb = req.db;
    let data = req.body;
    let staffId = req.params.staffId;

    let validate = true;

    if (validator.isEmpty(staffId)) {
	util.addMessage(res, 'message.error.validator.required', "error");
	validate = false;
    }

    if (!validate) {
	let resData = {
	    header : {
		renderStaffTable : false,
		renderStaffCrudPanel : true,
		renderStaffFacedImagesPanel : false,
	    },
	    body : {
		staff : null
	    }
	}
	resData.header.messages = res.locals.flash;
	resData.body.staff = data;
	res.render('secure/staff', resData);
	return;
    }

    const deleteStaffData = new Promise(function(resolve, reject) {
	let query = {
	    staffId : ObjectID(staffId)
	};
	let coll = mongodb.collection(staffDetectedFacedImageCollName);
	coll.deleteMany(query, function(err, result) {
	    if (err) {
		reject(err);
	    } else {
		resolve(result);
	    }
	});
    }).then(function(result) {
	let coll = mongodb.collection(staffCollName);
	let query = {
	    _id : ObjectID(staffId)
	};

	coll.deleteOne(query, function(err, result) {
	    if (err) {
		throw err;
	    }

	    res.redirect('/staff');
	});
    }).catch(function(err){
	util.addMessage(res, 'message.error.common.fail', "error");
	next(err);
    });

}

exports.deleteStaffFacedImage = function(req, res, next) {

    var mongodb = req.db;
    let data = req.body;
    let facedImageId = req.params.facedImageId;
    var staffId = req.params.staffId;

    if (validator.isEmpty(facedImageId) || validator.isEmpty(staffId)) {
	util.addMessage(res, 'message.error.validator.required', "error");
	return next(new Error("Validation error."));
    }

    let query = {
	_id : ObjectID(facedImageId)
    };

    let coll = mongodb.collection(staffDetectedFacedImageCollName);
    coll.deleteOne(query, function(err, result) {
	if (err) {
	    util.addMessage(res, 'message.error.common.fail', "error");
	    return next(err);
	}

	res.redirect('/staff/edit/' + staffId + '/facedImages');
    });
}
