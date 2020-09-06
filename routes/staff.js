var express = require('express');
var staffController = require('../controllers/staff');
var router = express.Router();

router.get([ '/', '/list' ], function(req, res, next) {
    staffController.fetchAllStaff(req, res, next);
});

router.get('/create', function(req, res, next) {
    staffController.createStaff(req, res, next);
});

router.post('/create', function(req, res, next) {
    staffController.saveStaff(req, res, next);
});

router.get('/edit/:staffId', function(req, res, next) {
    staffController.fetchStaff(req, res, next);
});

router.get('/edit/:staffId/facedImages', function(req, res, next) {
    staffController.fetchAllStaffFacedImage(req, res, next);
});

router.post('/edit/:staffId', function(req, res, next) {
    staffController.updateStaff(req, res, next);
});

router.post('/delete/:staffId', function(req, res, next) {
    staffController.deleteStaff(req, res, next);
});

router.post('/edit/:staffId/facedImages/:facedImageId', function(req, res, next) {
    staffController.deleteStaffFacedImage(req, res, next);
});

module.exports = router;
