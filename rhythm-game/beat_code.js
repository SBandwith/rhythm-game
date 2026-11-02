var marker = 0;
var offsetX = 10;

var threshold = 0.5;
var beatThreshold = 0.8;
var peaks = [];

var tempoRange = [85,170];
var beatGroup = {};
var bpm = 0;
var totBeats = 0;

var beatConv = [];		//converted beat 0-1
var artBeatConv = [];	//converted artificial beat 0-1
var rhythmConv = [];	//converted rhythm 0-1

let bi = 0;		//beat index
let abi = 0;	//artificial beat index
let ri = 0;		//rhythm index


let songMark = 0;
let energy = 0;
let energyThresh = 80;

//KEYS

/*
// directionals
var upKey = 38;     //[Up]
var leftKey = 37;   //[Left]
var rightKey = 39;  //[Rigt]
var downKey = 40;   //[Down]
var moveKeySet = [upKey, leftKey, rightKey, downKey];

// A and b
var a_key = 90;   //[Z]
var b_key = 88;   //[X]
var actionKeySet = [a_key, b_key];

var keys = [];
*/


let aud = document.getElementById("audio");
aud.volume = 1.0
let songFileInput = document.getElementById('songFile');
songFileInput.addEventListener('change', loadMusic);


//////////////////    GENERIC FUNCTIONS   ///////////////


//checks if an element is in an array
function inArr(arr, e){
	if(arr.length == 0)
		return false;
	return arr.indexOf(e) !== -1
}


////////////////   KEYBOARD FUNCTIONS  //////////////////


// key events
var keyTick = 0;
var kt = null; 

function anyKey(){
	return anyMoveKey() || anyActionKey();
}

//check if any directional key is held down
function anyMoveKey(){
	return (keys[upKey] || keys[downKey] || keys[leftKey] || keys[rightKey])
}

function anyActionKey(){
	return (keys[a_key] || keys[b_key]);
}


///////////////////   AUDIO FUNCTIONS   //////////////////


var song = null;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = new AudioContext();

function loadMusic(e){
	let file = e.target.files[0];
	aud.src = URL.createObjectURL(file);
	console.log(file.name);


	file.onend = function(e){
		URL.revokeObjectURL(this.src);
	}

	let freader = new FileReader();
	freader.onload = function(q){
		let arrBuf = q.target.result;
		context.decodeAudioData(arrBuf, function(buf){
			song = context.createBufferSource();
			song.connect(context.destination);
			song.buffer = buf;
			console.log("got buffer");

			/*
			//create lowpass filter
			let lowpass = context.createBiquadFilter();
			lowpass.type = "lowpass";
			lowpass.frequency.value = 150;
			lowpass.Q.value = 1;

			song.connect(lowpass);
			lowpass.connect(context.destination);

			song.start(0);
			context.startRendering();
			context.oncomplete = function(e){
				getPeaksAtThreshold(e.renderedBuffer.getChannelData(0));
			}
			*/
			getPeaksAtThreshold([song.buffer.getChannelData(0), song.buffer.getChannelData(1)]);
			getBeats([song.buffer.getChannelData(0), song.buffer.getChannelData(1)]);
			calculateBPM();
			resetMusic();

		});
	}
	freader.readAsArrayBuffer(file);

	playMusic();
}

//find the peaks of the song
function getPeaksAtThreshold(data){
	peaks = [];
	for(let i=0;i<(data[0].length);){
		let avg = (data[0][i] + data[1][i])/2
		if(avg > threshold){
			peaks.push(i);
			//skip forward?
			i += 100;
		}
		i++;
	}
	rhythmConv = peaks.map(b => b/song.buffer.length);
}

function getBeats(data){
	beats = [];
	for(let i=0;i<(data[1].length);){
		let avg = (data[0][i] + data[1][i])/2

		if(avg > beatThreshold){
			beats.push(i);
			//skip forward?
			i += 10000;
		}
		i++;
	}
	beatConv = beats.map(b => b/song.buffer.length);
}

function calculateBPM(){
	beatGroup = {};

	if(beats.length == 0)
		return;

	//get the surrounding beat per beat
	for(let b=1;b<beats.length-1;b++){
		let tempo = (60 * 48000) / (beats[b+1] - beats[b]);	//tempo
		let tempo2 = (60 * 48000) / (beats[b] - beats[b-1]);	//tempo


		while (tempo < tempoRange[0])
			tempo *= 2;
		while (tempo2 < tempoRange[0])
			tempo2 *= 2;

		while (tempo > tempoRange[1])
			tempo /= 2;
		while (tempo2 > tempoRange[1])
			tempo2 /= 2;

		tempo = Math.round(tempo);
		tempo2 = Math.round(tempo2);

		if (tempo in beatGroup)
			beatGroup[tempo]++;
		else 
			beatGroup[tempo] = 1;

		if (tempo in beatGroup)
			beatGroup[tempo2]++;
		else 
			beatGroup[tempo2] = 1;
	}


	bpm = Object.keys(beatGroup).reduce(function(a,b){return beatGroup[a] > beatGroup[b] ? a : b});
	bpm = parseInt(bpm);
	console.log(bpm);
	SONG_BPM = bpm;

	//make artificial beats
	totBeats = Math.round((bpm*aud.duration)/60);
	let spread = 1.0/totBeats;
	artBeatConv = [];
	for(let t=0;t<totBeats;t++){
		let b = t*spread;
		artBeatConv.push(b);
	}
}

//plays the imported music
function playMusic(){
	if(song != null){
		if(aud.paused){
			aud.play();
			resetMap();
			return;
		}else{
			aud.pause();
			return;
		}
		
	}
}

//resets the song
function resetMusic(){
	if(song != null){
		aud.pause();
		energy = 0;
		aud.currentTime = 0;
		marker = 0;
		songMark = 0;
		bi = 0;
		abi = 0;
		ri = 0;
		marker = 0;
		//document.getElementById('playBtn').innerHTML = "Play Song";
	}
}




//////////////////  RENDER FUNCTIONS  ////////////////////


function showPeaksnBeats(){
	//draw background
	// btx.save();
	// btx.clearRect(0,0,beatCanvas.width, beatCanvas.height);
	// btx.fillStyle = "#ffffff";
	// btx.fillRect(0,0,beatCanvas.width, beatCanvas.height);

	let y = 300;

	//beginning marker
	ctx.fillStyle = "#ff0000";
	ctx.fillRect(offsetX-4, y, 4,20);

	// ctx.translate(marker, 0);




	//draw rhythm and noise peaks
	// btx.fillStyle = "#000000";
	// for(let p=0;p<peaks.length;p++){
	// 	btx.fillRect(offsetX+1+(peaks[p]*splitWidth), y, 1, 10);
	// }

	// //draw beats
	ctx.fillStyle = "#000000";
	for(let p=0;p<beats.length;p++){
		ctx.fillRect(offsetX+1+(beats[p]), y+20, 1, 10);
	}

	//draw calculated beats
	// if(bpm != 0 && song != null){
	// 	ctx.fillStyle = "#000000";
	// 	for(let b=0;b<totBeats;b++){
	// 		ctx.fillRect(offsetX+1+(b*(canvas.width/totBeats)), y+20,1,10);
	// 	}
	// }


	//end marker
	ctx.fillStyle = "#ff0000";
	ctx.fillRect(canvas.width-offsetX, y, 4, 20);


	//marker
	ctx.fillStyle = "#0000ff";
	ctx.fillRect(offsetX+1+marker,y, 1,40);

	ctx.restore();


	// show small version on the zoomed in beat canvas
	// ctx.drawImage(
	// 	beatCanvas, marker-10, 0, Math.floor(beatCanvas.width/16), beatCanvas.height, 
	// 	0,0,zoomBeatCanvas.width,zoomBeatCanvas.height
	// );
}


function renderBEAT(){
	ctx.save();
	//ctx.translate(-camera.x, -camera.y);		//camera
	// ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	//background
	// drawBackground();
	
	/*   add draw functions here  */
	
	if(peaks.length > 0)
		showPeaksnBeats();
	

	// drawHeart();
	//drawColors();
	
	ctx.restore();
}



//////////////   GAME LOOP FUNCTIONS   //////////////////



function hitAMark(){
	let b = beatConv[bi];
	let a = artBeatConv[abi];
	let r = rhythmConv[ri];

	let o = artBeatConv[1]/3.0;		//offset safety mark

	if(songMark >= (b-o) && songMark <= (b+o))
		return true;
	if(songMark >= (a-o) && songMark <= (a+o))
		return true;
	if(songMark >= (r-o) && songMark <= (r+o))
		return true;

	return false;
}

/////////////////   HTML5 FUNCTIONS  //////////////////

