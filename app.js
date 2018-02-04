// Modules
const express = require('express')
var app = express();
var server = require('http').createServer(app)
var io = require('socket.io')(server);
var figlet = require('figlet');
var Twitter = require('twitter');
require('dotenv').config()
var args = require('args')

// process.env.PORT lets the port be set by Heroku
var server_port = process.env.PORT || 3000;

args
  .option('port', 'The serial device to attach FlipDot', '/dev/ttyUSB0')
  .option('emulate', 'Emulate a flip-dot display', false)
  .option('rows', 'Number of rows on display', 7)
  .option('columns', 'Number of columns on display', 56)
  .option('address', 'Address of display (sent in header)', 5)
  .option('invert', 'Invert display', false)

const flags = args.parse(process.argv)

// Flipdot stuff
var dateFormat = require('dateformat')
var FlipDot = require('flipdot-display')
// Mock serial port in case emulating

// Make the port
// Emulate if no args passed or asked to
if (flags.emulate ||  (process.argv.length < 3)) {
  const SerialPort = require('serialport/test')
  const MockBinding = SerialPort.Binding
  MockBinding.createPort('/dev/ROBOT', { echo: true })
  var flippy = new FlipDot('/dev/ROBOT',flags.address,flags.rows,flags.columns);
} else {
  var flippy = new FlipDot(flags.port,flags.address,flags.rows,flags.columns);
}

// Twitter streams
var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});
var flipdot_stream = null
var arttrail_stream = null

var clockTask = null
var resumeClock = false
var glitterTask = null
var matrix = null
var fonts = null

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

server.listen(server_port, function(){
  console.log('listening on port: ' + server_port)
})

figlet.fonts(function(err, figfonts) {
  if (err) {
      console.log('something went wrong...');
      console.dir(err);
      return;
  }
  fonts = figfonts
});

flippy.on("error", function(err) {
  console.log(err);
});

flippy.once("open", function() {
  flippy.writeText('Flipping On!', '3x5');
  flippy.send();

  io.on('connection', function(socket){
    flippy.clear();
    matrix = flippy.matrix();

    socket.on('flip', function(row, col) {
      matrix[row][col] = !matrix[row][col];
      flippy.send(flippy.writeMatrix(matrix));
    });

    socket.on('write text', function(text, font, refresh) {
      // data = flippy.writeText(text);
      var lines = text.split('\n');
      var frames = [];
      lines.forEach(function(line,i) {
        frames.push(flippy.writeText(line,font,undefined,undefined,false));
      });

      if (isNaN(refresh))
        flippy.writeFrames(frames);
      else
        flippy.writeFrames(frames,refresh);

      flippy.send();
    });

    socket.on('clear', function() {
      console.log('clear');
      if (clockTask !== null) {
        clearInterval(clockTask);
        clockTask = null;
        resumeClock = false;
      }
      if (glitterTask !== null) {
        clearInterval(glitterTask);
        glitterTask = null;
      }
      flippy.clear();
      flippy.send();
    });

    socket.on('fill', function() {
      flippy.fill(0xFF);
      flippy.send();
    });

    socket.on('clock', startClockTask );

    socket.on('glitter', function() {
      if (glitterTask === null) {
        glitterTask = startGlitter(1000, false);
      } else {
        clearInterval(glitterTask);
        glitterTask = null;
      }
    });

    flippy.on('sent', function() {
      var display = decode(flippy.packet.data);
      matrix = dataToMatrix(display);
      io.emit('update', display);
    });

    // Resume clock if running
    flippy.on('free', function() {
      if (resumeClock && clockTask === null) {
        setTimeout( startClockTask, 5000 ); // restart clock task after 5s delay
        resumeClock = false;
      }
    });

    socket.on('loaded', function() {
      io.emit('fill-fonts',fonts);
      io.emit('raster', [flags.rows, flags.columns]);
    });

    socket.on('twitter', function(set) {
      if (set && (flipdot_stream === null) ) {
        flipdot_stream = client.stream('statuses/filter', {track: '@FlipDotDisplay'});
        arttrail_stream = client.stream('statuses/filter', {track: '@frontroomart'});
        flipdot_stream.on('data', (event) => displayTweet(event, '@FlipDotDisplay') )
        arttrail_stream.on('data', (event) => displayTweet(event, '@FlipDotDisplay') )
        flipdot_stream.on('error', (event) => console.log(event) )
        arttrail_stream.on('error', (event) => console.log(event) )
        console.log('Twitter listeners added')
      } else {
        flipdot_stream.removeAllListeners('data')
        arttrail_stream.removeAllListeners('data')
        flipdot_stream.removeAllListeners('error')
        arttrail_stream.removeAllListeners('error')
        flipdot_stream = null;
        arttrail_stream = null;
        console.log('Twitter listeners removed')
      }
    });

  });

   
});

function decode(data) {
  var hex_data = [];
  for (var i = 0; i < data.length; i += 2) {
    hex_data.push( asciiToByte( [data[i], data[i+1]] ) );
  }

  return hex_data;
}

function dataToMatrix(hex_data) {
  var matrix = flippy.matrix();

  for (var j = 0; j < flippy.columns; j++) {
    // walk bits in byte constructing hex value
    for (var i = 0; i < flippy.rows; i++) {
      var bit = (hex_data[j] >> i) & 0x01;
      matrix[i][j] = bit;
    }
  }

  return matrix;
}

function asciiToByte(chars) {
  var b1 = String.fromCharCode(chars[1]);
  var b2 = String.fromCharCode(chars[0]);

  b2 = b2.concat(b1);

  return parseInt(b2,16);
}

function startClock(seconds = false, font = 'Banner', offset = [0,0], invert = false) {
  var format = "HH:MM"
  if (seconds) {
    format = format.concat(":ss")
  }
  
  var lastString = [];
  var task = setInterval( function() {
    var now = new Date();
    var timeString = dateFormat(now,format);
    if (timeString != lastString) {
      flippy.writeText(timeString, {font: font}, offset, invert);
      flippy.send();
      lastString = timeString;
    }
  }, 1000);
  
  return task;
}

function startClockTask() {
  if (clockTask === null) {
    clockTask = startClock(true, font='3x5', offset = [0,12]);
  } else {
    clearInterval(clockTask);
    clockTask = null;
  }
}

function startGlitter(update = 1000, invert = false) {
  var task = setInterval( function() {
    for (var j = 0; j < flippy.columns; j++) {
      // walk bits in byte constructing hex value
      for (var i = 0; i < flippy.rows; i++) {
        matrix[i][j] = Math.round(Math.random());
      }
    }
    flippy.send(flippy.writeMatrix(matrix));
  }, update);
  
  return task;
}

function displayTweet(event, user) {
  // stop clock task if running and resume after writting
  if (clockTask !== null) {
    clearInterval(clockTask);
    clockTask = null;
    resumeClock = true;
  }

  words = event.text.split(' ')
  // trim if mentioning
  if (words[0] === user) {
    words.shift()
    flippy.writeText(words.join(' '), {font: 'Banner'});
    console.log(words.join(' '))
  } else {
    flippy.writeText(event.text, {font: 'Banner'});
    console.log(event.text)
  }
  flippy.send()
}
