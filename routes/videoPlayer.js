var express = require('express');
var fs = require('fs');
var SMB2 = require('smb2');
var URL = require('url').URL;
var streamBuffers = require('stream-buffers');
const rtspStream = require('node-rtsp-stream')


// create an SMB2 instance
var smb2Client = new SMB2({
	share:'smb:\\\\10.1.1.25\\2953\\25-2018\\131\\002\\002', 
	domain:'', 
	username:'admin', 
	password:'123qQ'
});


var router = express.Router();
router.get('/', function(req, res, next) {
	res.render('secure/videoPlayer');
});

router.get('/video', function(req, res, next) {
	
	console.log("-----------")
	
	smb2Client.readFile('REC00003.MOV', function(err, data){
	    if(err) {
	    	throw err;
	    }
	    
	  

	    
	    console.log("-----------22222222222")
		const fileSize = data.length;
		console.log(fileSize);
		const range = req.headers.range;
		
		if (range) {

			const parts = range.replace(/bytes=/, "").split("-");
			const start = parseInt(parts[0], 10);

			const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
			const chunksize = (end - start) + 1;
			console.log(start +' ->> '+end);
			console.log(data.slice(start, end));
			const file = data.slice(start, end);

			const head = {
				'Content-Range' : 'bytes ${start}-${end}/${fileSize}',
				'Accept-Ranges' : 'bytes',
				'Content-Length' : chunksize,
				'Content-Type' : 'video/mp4',
			};
			res.writeHead(206, head);
			file.pipe(res);

		} else {
			const head = {
				'Content-Length' : fileSize,
				'Content-Type' : 'video/mp4',
			}
			res.writeHead(200, head)
			fs.createReadStream(path).pipe(res)
		}
	    
	});
	
	

});

module.exports = router;
