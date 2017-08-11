const express = require('express')
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var FlipDot = require('flipdot-display');
// var flippy = new FlipDot('/dev/tty.wchusbserial1420',5,7,56);
const SerialPort = require('serialport/test');
const MockBinding = SerialPort.Binding;

MockBinding.createPort('/dev/ROBOT', { echo: true });
var flippy = new FlipDot('/dev/ROBOT',5,7,56);

app.use(express.static('public'))

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

server.listen(3000, function(){
  console.log('listening on *:3000');
});

flippy.on("error", function(err) {
  console.log(err);
});

flippy.once("open", function() {

  io.on('connection', function(socket){
    flippy.clear();
    matrix = flippy.matrix();

    socket.on('flip', function(row, col) {
      matrix[row][col] = !matrix[row][col];
      flippy.send(flippy.writeMatrix(matrix));
    });

    socket.on('write text', function(text) {
      // data = flippy.writeText(text);
      var lines = text.split('\n');
      var frames = [];
      lines.forEach(function(line,i) {
        frames.push(flippy.writeText(line,undefined,undefined,undefined,false));
      });

      flippy.writeFrames(frames,1000);

      flippy.send();
    });

    flippy.on('sent', function() {
      var display = decode(flippy.packet.data);
      io.emit('update', display);
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


function asciiToByte(chars) {
  var b1 = String.fromCharCode(chars[1]);
  var b2 = String.fromCharCode(chars[0]);

  b2 = b2.concat(b1);

  return parseInt(b2,16);
}
