var debug = require('debug')('digitalguardapp:server');
var http = require('http');
var express = require('express');

var hbs = require('hbs');
var hbsIntl = require('handlebars-intl');
hbsIntl.registerWith(hbs);

var app = express();
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var i18n = require('i18n');
var flash = require('express-flash-2');
var fs = require('fs');

// Create HTTP server.
var server = http.createServer(app);
const wsEndpoint = "/websocket";
var websocket = require('socket.io')(server).of(wsEndpoint);

// Performance
// const statusMonitor = require('express-status-monitor')();
// app.use(statusMonitor);
var dash = require('appmetrics-dash');
dash.monitor({server: server});

var guard = null;
var mongodb = null;
var mongodbClient = require('mongodb').MongoClient;
const dbName = "digital_guard";
const mongodbUrl = "mongodb://pi:pi@127.0.0.1:27017/" + dbName;
mongodbClient.connect(mongodbUrl, {
    useNewUrlParser : true
}, function(err, client) {
    if (err)
	throw err;
    console.log("Mongodb is created.");
    mongodb = client.db(dbName);
    guard = require('./services/guard')(mongodb, websocket, wsEndpoint);
    // guard.init();
});

// Get port from environment and store in Express.
var port = normalizePort(process.env.PORT || '5001');

// Listen on provided port, on all network interfaces.
server.listen(port, '0.0.0.0');
server.on('error', onError);
server.on('listening', onListening);
app.set('port', port);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.engine('hbs', hbs.__express);

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended : false
}));

app.use(cookieParser());

// Session
app.use(session({
    secret : 'secret',
    saveUninitialized : true,
    resave : true,
    cookie : {
	maxAge : 60000
    }
}));

// Digital Guard Web
// afp://anonymous@BASARIMOB-BAC.local/wls/osman/media
app.use('/public',  express.static(__dirname + '/public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));
app.use('/media',  express.static('/mnt/basarimobile-share/osman.demirci'));


// Navigate & Routes
app.get('/', function(req, res) {
    res.redirect('/main');
});

app.get('/*', function(req, res, next) {
    req.db = mongodb;
    next();
});

app.post('/*', function(req, res, next) {
    req.db = mongodb;
    next();
});

app.use(flash());

var main = require('./routes/main');
var staff = require('./routes/staff');
var dataLog = require('./routes/dataLog');
var videoPlayer = require('./routes/videoPlayer');

app.use('/main', main);
app.use('/staff', staff);
app.use('/dataLog', dataLog);
app.use('/videoPlayer', videoPlayer);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    res.render('404');
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

// multiple language
i18n.configure({
    locales : [ 'tr' ],
    directory : __dirname + '/public/locales',
    defaultLocale : 'tr',
    objectNotation : true
});
app.use(i18n.init);

hbs.registerHelper('texts', function() {
    return i18n.__.apply(this, arguments);
});

hbs.registerPartial('message', fs.readFileSync(__dirname + '/views/secure/message.hbs', 'utf8'));

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port))
	return val;
    if (port >= 0)
	return port;
    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
    if (error.syscall !== 'listen') {
	throw error;
    }
    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    switch (error.code) {
    case 'EACCES':
	console.error(bind + ' requires elevated privileges');
	process.exit(1);
	break;
    case 'EADDRINUSE':
	console.error(bind + ' is already in use');
	process.exit(1);
	break;
    default:
	throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    debug('Listening on ' + bind);
}
