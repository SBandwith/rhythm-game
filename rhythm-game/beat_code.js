var marker = 0;
var offsetX = 10;

var threshold = 0.5;
var beatThreshold = 0.8;
var peaks = [];

var tempoRange = [55,140];
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

//KEYS


let aud = document.getElementById("audio");
aud.volume = 1.0

// file import
// let songFileInput = document.getElementById('songFile');
// songFileInput.addEventListener('change', loadMusic);

var SONG_LIST_MP3S = {};
var SONG_LIST_DATA = {};



//////////////////    GENERIC FUNCTIONS   ///////////////


//checks if an element is in an array
function inArr(arr, e){
	if(arr.length == 0)
		return false;
	return arr.indexOf(e) !== -1
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

function loadSong(song_name){
	let song_data = SONG_LIST_DATA[song_name];
	if(!song_data)
		return;
	aud.src = song_data.file;
	aud.load();

	SONG_NAME = song_name;

	// use the measured values from songlist.json; only auto-detect if the bpm is missing
	if (song_data.bpm)
		SONG_BPM = song_data.bpm;
	SONG_OFFSET = song_data.offset || 0;
	if (song_data.level)
		HARDNESS = song_data.level;
	if (song_data.speed)
		OBS_SPEED = song_data.speed;
	updateBPMSlider();

	// Load the audio file from the SONG_LIST_MP3S object
	fetch(song_data.file)
		.then(response => response.arrayBuffer())
		.then(arrayBuffer => context.decodeAudioData(arrayBuffer))
		.then(audioBuffer => {
			song = context.createBufferSource();
			song.connect(context.destination);
			song.buffer = audioBuffer;
			console.log("got buffer for " + song_name);

			getPeaksAtThreshold([song.buffer.getChannelData(0), song.buffer.getChannelData(1)]);
			getBeats([song.buffer.getChannelData(0), song.buffer.getChannelData(1)]);
			calculateBPM(!song_data.bpm);
			resetMusic();
		})
		.catch(error => console.error('Error loading song:', error));

	// finally play the song
	playMusic();
	
}

function updateBPMSlider(){
	var bpmSlider = document.getElementById("bpm");
	if (bpmSlider) { bpmSlider.value = SONG_BPM; if (typeof updateSliderLabel === "function") updateSliderLabel("bpm"); }
}

function playSong(){
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


// rough BPM guess from loud peaks. Only used for songs without a bpm in songlist.json,
// because it's often off by a few BPM (enough to drift a whole beat within a minute).
function calculateBPM(useForGame = true){
	beatGroup = {};

	if(beats.length < 3)
		return;

	let sampleRate = song.buffer.sampleRate;	// was hard-coded to 48000 (most mp3s are 44100)

	//get the surrounding beat per beat
	for(let b=1;b<beats.length-1;b++){
		let tempo = (60 * sampleRate) / (beats[b+1] - beats[b]);	//tempo
		let tempo2 = (60 * sampleRate) / (beats[b] - beats[b-1]);	//tempo


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

		beatGroup[tempo] = (beatGroup[tempo] || 0) + 1;
		beatGroup[tempo2] = (beatGroup[tempo2] || 0) + 1;
	}


	bpm = Object.keys(beatGroup).reduce(function(a,b){return beatGroup[a] > beatGroup[b] ? a : b});
	bpm = parseInt(bpm);
	console.log("DETECTED BPM: " + bpm + (useForGame ? " (using it)" : " (using songlist.json bpm " + SONG_BPM + ")"));

	if(useForGame){
		SONG_BPM = bpm;
		SONG_OFFSET = 0;
		updateBPMSlider();
	}

	//make artificial beats
	totBeats = Math.round((SONG_BPM*song.buffer.duration)/60);
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
		aud.currentTime = 0;
		marker = 0;
		songMark = 0;
		bi = 0;
		abi = 0;
		ri = 0;
		marker = 0;
		hits = 0;
		good_jumps = 0;
		custom_beat_mark = [];
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

function audio_init(){
	//initialize audio context
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	context = new AudioContext();

	// import the songs from the songlist.json file
    fetch('songlist.json')
        .then(response => response.json())
        .then(data => {
            const songSelect = document.getElementById('songSelect');
            data.songs.forEach(song => {
                const option = document.createElement('option');
                option.value = song.title;
                option.innerHTML = song.title + " - " + song.artist;
                songSelect.appendChild(option);
				SONG_LIST_DATA[song.title] = song;		// Store the song data in the SONG_LIST_MP3S object
            });
        })
        .catch(error => console.error('Error loading song list:', error));

    
}

/////////////////   HTML5 FUNCTIONS  //////////////////

