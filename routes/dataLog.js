var express = require('express');
var dataLogController = require('../controllers/dataLog');
var router = express.Router();

router.get([ '/', '/list' ], function(req, res, next) {
    dataLogController.fetchAllDetectedFace(req, res, next);
});

router.post([ '/delete' ], function(req, res, next) {
    dataLogController.deleteAllDetectedFace(req, res, next);
});

router.post([ '/staffFacedImages' ], function(req, res, next) {
    dataLogController.saveAllStaffFacedImage(req, res, next);
});

module.exports = router;