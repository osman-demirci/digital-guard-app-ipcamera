var i18n = require('i18n');

exports.addMessage = function(res, messageKey, severity) {
    res.flash(severity, i18n.__(messageKey));
}

exports.convertObjectIdToNumber = function(object_id) {
    object_id = object_id.toString();
    let res = parseInt(object_id.substring(0, 8), 16).toString() + parseInt(object_id.substring(18, 24), 16).toString();
    return parseInt(res, 10);
}