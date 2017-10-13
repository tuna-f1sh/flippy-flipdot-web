var socket = io();

var dotOn = '#d2ff4d';
var dotOff = '#303030';

// Setup the parameters for our grid. These are the values you can change.
var dotMargin = 0;
var numRows = 7;
var numCols = 56;
var clock = false;
var glitter = false;
var twitter = false;

// Setup (explained earlier)
var canvas = $('canvas.dots');

var context = canvas[0].getContext('2d');
var canvasWidth = canvas.width();
var canvasHeight = canvas.height(); // this one is new
canvas.attr({height: canvasHeight, width: canvasWidth});

// Because we don't know which direction (x vs. y) is the limiting sizing
// factor, we'll calculate both first.
var dotWidth = ((canvasWidth - (2 * dotMargin)) / numCols) - dotMargin;
var dotHeight = ((canvasHeight - (2 * dotMargin)) / numRows) - dotMargin;

// Now, we use the limiting dimension to set the diameter.
if( dotWidth > dotHeight ) {
  var dotDiameter = dotHeight;
  var xMargin = (canvasWidth - ((2 * dotMargin) + (numCols * dotDiameter))) / numCols;
  var yMargin = dotMargin;
} else {
  var dotDiameter = dotWidth;
  var xMargin = dotMargin;
  var yMargin = (canvasHeight - ((2 * dotMargin) + (numRows * dotDiameter))) / numRows;
}

// Radius is still half of the diameter, because ... math.
var dotRadius = dotDiameter * 0.5;

// Now, we have to iterate in both directions, so we need a loop within a loop.
// This loop is a little more complicated because the margin in the direction
// with more space is not going to be the value you set.
for(var i = 0; i < numRows; i++) { // i is the row iterator
  for(var j = 0; j < numCols; j++) { // j is the column iterator
  drawDot(i, j, false);
  }
}

canvas[0].addEventListener('mousedown', function(evt) {
  var mousePos = getMousePos(canvas[0], evt);
  pos = getDot(mousePos.x, mousePos.y, dotRadius);
  
  console.log(pos);

  // drawDot(pos.row,pos.col,true);
  socket.emit('flip',pos.row,pos.col);
}, false);

function drawDot(i, j, active) {
  context.beginPath();
  var x = (j * (dotDiameter + xMargin)) + dotMargin + (xMargin / 2) + dotRadius;
  var y = (i * (dotDiameter + yMargin)) + dotMargin + (yMargin / 2) + dotRadius;
  var colour = (active ? dotOn : dotOff);
  context.arc(x, y, dotRadius, 0, 2 * Math.PI, false);
  context.fillStyle = colour;
  context.fill();
}

function getDot(x, y, radius) {
  return {
    col : Math.abs(Math.round((x - radius - (xMargin / 2) - dotMargin) / (dotDiameter + xMargin))),
    row : Math.abs(Math.round((y - radius - (yMargin / 2) - dotMargin) / (dotDiameter + yMargin)))
  };
}

function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((evt.clientX-rect.left)/(rect.right-rect.left)*canvas.width),
    y: Math.round((evt.clientY-rect.top)/(rect.bottom-rect.top)*canvas.height)
  };
}

$('form').submit(function(){
  var e = document.getElementById('write-text-font');
  var font = e.options[e.selectedIndex].text;
  socket.emit('write text', $('#write-text-msg').val(), font, parseInt($('#write-text-refresh').val()) );
  return false;
});

function populateFonts(fonts) {
  var sel = document.getElementById('write-text-font');
  for(var i = 0; i < fonts.length; i++) {
      var opt = document.createElement('option');
      opt.innerHTML = fonts[i];
      opt.value = fonts[i];
      sel.appendChild(opt);
  }
}

function updateDisplay(data) {
  console.log('update');
  // walk columns of bytes
  for (var j = 0; j < 56; j++) {
    // walk bits in byte constructing hex value
    for (var i = 0; i < 8; i++) {
      var bit = (data[j] >> i) & 0x01;
      drawDot(i,j,bit);
    }
  }
}

socket.on('update', function(data) {
  updateDisplay(data);
});

socket.on('fill-fonts', function(fonts) {
  populateFonts(fonts);
});

function clearDisplay() {
  socket.emit('clear');
  if (clock) {
    clock = false;
    $('#clock-btn').removeAttr('style');
    $('#clock-btn').text("Clock")
  }
  if (glitter) {
    glitter = false;
    $('#glitter-btn').removeAttr('style');
    $('#glitter-btn').text("Glitter")
  }
}

function fillDisplay() {
  socket.emit('fill');
}

function clockTask() {
  socket.emit('clock');
  var id = $('#clock-btn');

  if (!clock) {
    clock = true;
    id.css('color',"red")
    id.text("stop")
  } else {
    clock = false;
    id.removeAttr('style');
    id.text("Clock")
  }
}

function glitterTask() {
  socket.emit('glitter');
  var id = $('#glitter-btn');

  if (!glitter) {
    glitter = true;
    id.css('color',"red")
    id.text("stop")
  } else {
    glitter = false;
    id.removeAttr('style');
    id.text("Glitter")
  }
}

function twitterSet() {
  twitter = !twitter;
  socket.emit('twitter', twitter);
  if (twitter) {
    $('#twitter-btn').text('Twitter: On')
  } else {
    $('#twitter-btn').text('Twitter: Off')
  }
}

// sent page loaded event
socket.emit('loaded');
