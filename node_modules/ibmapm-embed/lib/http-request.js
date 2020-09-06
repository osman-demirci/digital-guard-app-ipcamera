// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: ibmapm
// This file is licensed under the Apache License 2.0.
// License text available at https://opensource.org/licenses/Apache-2.0

function HttpRequest(req, responseTime) {
    this.reqUrl = req.url;
    this.hitCount = 1;
    this.errorCount = 0;
    this.totalResponseTime = responseTime;
    this.averageResponseTime = responseTime;
    this.latestResponseTime = responseTime;
    this.method = req.method;
    this.goodResps = [];
    this.badResps = [];

    var responseJson = {
        resp: responseTime,
        timestamp: req.time,
        statusCode: req.statusCode
    };

    if (req.requestHeader && req.requestHeader.host) {
        var protocol = 'http';
        if (req.header && req.header.indexOf('HTTPS') >= 0) {
            protocol = 'https';
        }
        responseJson.url_prefix = protocol + '://' + req.requestHeader.host;
    } else {
        responseJson.url_prefix = '';
    }

    if (req.statusCode >= 400) {
        this.errorCount = 1;
        this.badResps.push(responseJson);
    } else {
        this.goodResps.push(responseJson);
    }

    this.errorRate = this.errorCount / this.hitCount;
}

HttpRequest.prototype.updateResponseTime = function updateResponseTime(req, responseTime) {
    this.reqUrl = req.url;
    this.hitCount++;
    this.totalResponseTime += responseTime;
    this.averageResponseTime = this.totalResponseTime / this.hitCount;
    this.latestResponseTime = responseTime;

    var responseJson = {
        resp: responseTime,
        timestamp: req.time,
        statusCode: req.statusCode
    };

    if (req.requestHeader && req.requestHeader.host) {
        var protocol = 'http';
        if (req.header && req.header.indexOf('HTTPS') >= 0) {
            protocol = 'https';
        }
        responseJson.url_prefix = protocol + '://' + req.requestHeader.host;
    } else {
        responseJson.url_prefix = '';
    }

    if (req.statusCode >= 400) {
        this.errorCount += 1;
        this.badResps.push(responseJson);
    } else {
        this.goodResps.push(responseJson);
    }
    this.errorRate = this.errorCount / this.hitCount;
};

module.exports = HttpRequest;
