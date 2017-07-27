const express = require('express')
var app = express();
var io = require('socket.io')(http);


app.use(express.static('public'))

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.listen(3000, function(){
  console.log('listening on *:3000');
});