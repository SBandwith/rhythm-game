//set up the canvas
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
canvas.width = 600;
canvas.height = 400;

var size = 16;

var GROUND_Y = 320;         // y of the top of the ground

// ---- TIMING / PHYSICS (all in seconds and pixels, NOT frames) ----
// Everything is driven off the song clock so it can't drift away from the music
// (the old version moved things "per frame", so the timing changed with the frame rate).
var OBS_SPEED = 4;          // obstacle speed slider value; pixels per second = OBS_SPEED * 60
var JUMP_HEIGHT = 100;      // how high the jump peaks (px)
var AIR_BEATS = 0.75;       // how long the player is in the air, as a fraction of one beat
var MIN_AIR_TIME = 0.40;    // clamp so fast songs still give a usable jump (s)
var MAX_AIR_TIME = 0.80;    // clamp so slow songs don't feel floaty (s)

var GAME_OVER = true;

var SONG_BPM = 80;          // beats per minute of the current song
var SONG_NAME = "None";     // name of the current song
var SONG_OFFSET = 0;        // time (s) in the mp3 of the first beat (from songlist.json)
var musicOffset = 0;        // user calibration (s) for audio/keyboard lag; + = obstacles later
var HARDNESS = 1;

var LEAD_IN_BEATS = 4;      // no obstacles for the first few beats of the song

var UP_LEVEL_CT = 4;

var hits = 0;
var good_jumps = 0;
var custom_beat_mark = [];  // song times (s) of the player's jumps
var lastJumpError = null;   // how far the last jump was from the nearest beat (s)


//camera
var camera = {
	x : 0,
	y : 0
};


function gameObj(x,y,w,h,img,img_offset=null){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.velX = 0;
    this.velY = 0;
    this.img = img;
    this.img_offset = img_offset;
    this.bbox = new bBox(0, 0, w, h);
    this.cooldown = false;
    this.invincible = false;
    this.jumping = false;
    this.jumpStart = 0;     // song time (s) when the current jump started
}

class Obstacle{
    // arriveTime = song time (s) when this obstacle is centred under the player
    constructor(arriveTime, beatIndex, y, w, h){
        this.arriveTime = arriveTime;
        this.beatIndex = beatIndex;
        this.x = canvas.width;
        this.y = y;
        this.w = w;
        this.h = h;
        this.img = document.getElementById("spikeIMG");
        // slightly forgiving hitbox (spikes are pointy, the corners shouldn't count)
        this.bbox = new bBox(4, 6, w - 8, h - 6);
        this.alive = true;
        this.hit = false;       // did this obstacle hit the player?
        this.passed = false;    // has it gone past the player yet?
    }

    // position is calculated from the clock every frame, never accumulated
    update(t){
        this.x = playerCenterX() + (this.arriveTime - t) * obsSpeedPx() - this.w / 2;
        if(this.x + this.w <= 0) {
            this.alive = false;
        }
    }

    render(ctx, multiplier=1){
        if(this.alive && this.img != null) {
            ctx.drawImage(this.img, this.x, this.y, Math.floor(this.w*multiplier), Math.floor(this.h*multiplier));
        }
    }
}

//added function
function randomObstacle(obs) {
    let randomNum = Math.floor(Math.random() * 3);
    if(randomNum == 0) {
        obs.img = document.getElementById("spikeIMG");
    } else if (randomNum == 1) {
        obs.img = document.getElementById("waterIMG");
    // test with star -- replace star as collectable later
    } else {
        obs.img = document.getElementById("starIMG");
    } 
    return obs;
}

function bBox(x,y,w,h){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
}

var player = new gameObj(100,GROUND_Y-32,20,32,document.getElementById("player1Img"),{x:-21,y:-20});
var ground = new gameObj(0,GROUND_Y,canvas.width,100,null);

var ALL_OBJS = [player];
var ALL_OBSTACLES = [];

var nextBeat = 0;       // index of the next beat we haven't decided on yet



// directionals
var upKey = "ArrowUp";     //[Up]
var leftKey = "ArrowLeft";   //[Left]
var rightKey = "ArrowRight";  //[Rigt]
var downKey = "ArrowDown";   //[Down]
var moveKeySet = [upKey, leftKey, rightKey, downKey];

// A and b
var a_key = "KeyA";   //[Z]
var b_key = "KeyB";   //[X]
var shift_key = "ShiftLeft";  //[Shift]
var space_key = "Space";
var reset_key = "KeyR";
var actionKeySet = [shift_key,a_key, b_key,space_key, reset_key];

var keys = [];
var jumpQueued = null;  // song time of a jump press that update() hasn't handled yet


// image references
var bgIMG = document.getElementById("bgIMG");





//////////////////    GENERIC FUNCTIONS   ///////////////


//checks if an element is in an array
function inArr(arr, e){
	if(arr.length == 0)
		return false;
	return arr.indexOf(e) !== -1
}


////////////////   TIMING FUNCTIONS   /////////////////

function beatSec(){ return 60 / SONG_BPM; }
function obsSpeedPx(){ return OBS_SPEED * 60; }
function playerCenterX(){ return player.x + player.w / 2; }

// air time follows the song tempo so the jump always "fits" the beat
function airTime(){
    return Math.min(MAX_AIR_TIME, Math.max(MIN_AIR_TIME, AIR_BEATS * beatSec()));
}

// smooth audio clock: aud.currentTime only updates every ~20-50ms in some
// browsers, which makes obstacles stutter. Run a performance.now() clock and
// snap it back to the real audio time if they ever disagree.
var clockPerf = 0, clockAudio = 0;
function audioNow(){
    if(aud.paused)
        return aud.currentTime;
    let est = clockAudio + (performance.now() - clockPerf) / 1000 * aud.playbackRate;
    if(Math.abs(est - aud.currentTime) > 0.05){
        clockAudio = aud.currentTime;
        clockPerf = performance.now();
        est = clockAudio;
    }
    return est;
}

// song time measured from the first beat: beat k happens at songTime() == k * beatSec()
function songTime(){
    return audioNow() - SONG_OFFSET - musicOffset;
}

// how many beats apart obstacles are at each level
function beatSpacing(){
    if(HARDNESS >= 3) return 1;
    if(HARDNESS == 2) return 2;
    return 4;
}

// how long an obstacle is on screen before it reaches the player
function lookAhead(){
    return (canvas.width - playerCenterX() + 32) / obsSpeedPx();
}

// the player should PRESS jump on beat k, and the obstacle is under them at the
// top of the jump, i.e. half the air time later
function arriveTimeForBeat(k){
    return k * beatSec() + airTime() / 2;
}

// start scheduling from the first beat whose obstacle hasn't come on screen yet
function resyncBeatSchedule(){
    let t = songTime() + lookAhead() - airTime() / 2;
    nextBeat = Math.max(LEAD_IN_BEATS, Math.ceil(t / beatSec()));
}


////////////////   GENERATOR FUNCTIONS   /////////////////

// spawn obstacles ahead of time so each one reaches the player on its beat
function scheduleObstacles(t){
    if(GAME_OVER || aud.paused)
        return;

    while(arriveTimeForBeat(nextBeat) - lookAhead() <= t){
        let k = nextBeat++;
        if(k % beatSpacing() != 0)
            continue;
        if(arriveTimeForBeat(k) - lookAhead() < t - 0.25)
            continue;   // we skipped ahead (seek / lag spike): don't spawn obstacles mid-screen
        
        let o = new Obstacle(arriveTimeForBeat(k), k, GROUND_Y-32, 32, 32);
        o = randomObstacle(o);
        console.log(o);
        ALL_OBJS.push(o);
        ALL_OBSTACLES.push(o);
    }
}


////////////////   COLLISIONS FUNCTIONS   /////////////////

function isColliding(sprA, sprB) {
    let sA = {
        x1: sprA.bbox.x + sprA.x,
        y1: sprA.bbox.y + sprA.y,
        x2: sprA.bbox.x + sprA.x + sprA.bbox.w,
        y2: sprA.bbox.y + sprA.y + sprA.bbox.h
    }

    let sB = {
        x1: sprB.bbox.x + sprB.x,
        y1: sprB.bbox.y + sprB.y,
        x2: sprB.bbox.x + sprB.x + sprB.bbox.w,
        y2: sprB.bbox.y + sprB.y + sprB.bbox.h
    }


    return sA.x1 < sB.x2 &&
           sA.x2 > sB.x1 &&
           sA.y1 < sB.y2 &&
           sA.y2 > sB.y1;
}

function onGround(spr) {
    return !spr.jumping;
}

// how early/late (s) a jump can be and still clear an obstacle
function timingWindow(){
    let T = airTime();
    let obsTop = 270 + 6;                              // top of obstacle hitbox
    let needRise = GROUND_Y - obsTop;                  // how far the player's feet must rise
    if(needRise >= JUMP_HEIGHT) return 0;
    let timeAbove = T * Math.sqrt(1 - needRise / JUMP_HEIGHT);
    let crossTime = (player.bbox.w + (32 - 8)) / obsSpeedPx();
    return Math.max(0, (timeAbove - crossTime) / 2);
}

//////////////////  RENDER FUNCTIONS  ////////////////////

function render(){
	ctx.save();
	//ctx.translate(-camera.x, -camera.y);		//camera
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	//background
	// ctx.fillStyle = "#dedede";
	// ctx.fillRect(0,0,canvas.width, canvas.height);

    ctx.drawImage(bgIMG, 0, 0, canvas.width, canvas.height);

    // ctx.fillStyle = "#00ff00";
    // ctx.fillRect(0,GROUND_Y,canvas.width,100);

    ctx.fillStyle = "#F00";
    ctx.fillRect(0,GROUND_Y,canvas.width,2)

    // beat pulse under the player: flashes when you should press jump
    if(!aud.paused && SONG_BPM > 0){
        let phase = ((songTime() / beatSec()) % 1 + 1) % 1;
        let pulse = Math.max(0, 1 - phase * 4);
        ctx.fillStyle = "rgba(255,200,0," + pulse + ")";
        ctx.fillRect(player.x - 10, GROUND_Y + 4, player.w + 20, 6);
    }

	/*   add draw functions here  */
    if(player.img != null) {
        if(player.cooldown){
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#560000"; // red color to indicate cooldown
        }
        ctx.drawImage(player.img, player.x+player.img_offset.x, player.y+player.img_offset.y, 64,64);
        ctx.globalAlpha = 1; // reset alpha after drawing
    }

    // draw all obstacles
    ctx.fillStyle = "#2200ff";
    ALL_OBSTACLES.forEach(function(obs) {
        if(obs.img != null) {
            obs.render(ctx, 1.5); // draw obstacles at 1.5x size
        }else{
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        }
    });


    // fonts setting
    ctx.fillStyle = "#5F3B36";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // song title
    ctx.font = "32px Squartiqa, Impact, sans-serif";
    ctx.fillText("Song: " + SONG_NAME, 10, 10);

    // level
    ctx.font = "24px Squartiqa, Impact, sans-serif";
    ctx.fillText("Level: " + HARDNESS, 10, 50);

    // star count
    ctx.font = "24px Squartiqa, Impact, sans-serif";
    ctx.fillText("Stars: ", canvas.width-150, 20);

    // score
    ctx.font = "24px Squartiqa, Impact, sans-serif";
    ctx.fillText("Score: " + good_jumps, canvas.width-100, 50);





    // DEBUG: render the bounding boxes of all objects

    // debug render the bounding boxes of all objects
    ALL_OBJS.forEach(function(obj) {
        ctx.strokeStyle = "#ff0000";
        ctx.strokeRect(obj.bbox.x + obj.x, obj.bbox.y + obj.y, obj.bbox.w, obj.bbox.h);
    });

    ctx.strokeStyle = "#0000ff";
    ctx.strokeRect(player.bbox.x + player.x, player.bbox.y + player.y, player.bbox.w, player.bbox.h);


	ctx.restore();
}


//////////////  UPDATE FUNCTION   //////////////////

function update(){
    let t = songTime();
    let standY = GROUND_Y - player.h;

    // jump (starts at the moment the key was pressed, not the next frame)
    if(jumpQueued !== null){
        if(!player.jumping){
            player.jumping = true;
            player.jumpStart = jumpQueued;
            custom_beat_mark.push(jumpQueued);

            // how close to the beat was it?
            let b = beatSec();
            lastJumpError = jumpQueued - Math.round(jumpQueued / b) * b;
        }
        jumpQueued = null;
    }

    // jump arc: exact parabola from the jump start time (frame-rate independent)
    // height(τ) = 4H·(τ/T)·(1 − τ/T), peaks at H when τ = T/2
    if(player.jumping){
        let T = airTime();
        let u = (t - player.jumpStart) / T;
        if(u >= 1 || u < 0 || aud.paused){
            player.jumping = false;
            player.y = standY;
        }else{
            player.y = standY - 4 * JUMP_HEIGHT * u * (1 - u);
        }
    }else{
        player.y = standY;
    }

    scheduleObstacles(t);

    // move the obstacles + check collisions
    if(!GAME_OVER){
        ALL_OBSTACLES.forEach(function(o){
            o.update(t);

            // if touching player, register a hit and apply cooldown
            if(!o.hit && isColliding(player,o)){
                o.hit = true;
                if(!player.cooldown){
                    hits++;
                    good_jumps = 0;
                    player.cooldown = true;
                    setTimeout(function(){
                        player.cooldown = false;
                    }, 1000); // 1 second cooldown
                }
            }else if(!o.passed && o.x + o.bbox.x + o.bbox.w < player.x + player.bbox.x){
                o.passed = true;
                if(o.hit)
                    return;
                good_jumps++;

                if(good_jumps > 0 && good_jumps % UP_LEVEL_CT == 0){
                    HARDNESS++; // increase hardness every UP_LEVEL_CT good jumps
                    if(HARDNESS > 3){
                        HARDNESS = 3; // cap the maximum hardness
                    }
                }
            }
        });
        ALL_OBSTACLES = ALL_OBSTACLES.filter(o => o.alive);
    }


    // reduce the level until game over
    if(hits >= 3){
        if(HARDNESS == 1 && !player.invincible){
            GAME_OVER = true;
        }else{
            hits = 0; // reset hits for non-hard mode
            HARDNESS--; // reset hardness for non-hard mode
            good_jumps = 0; // reset good jumps for non-hard mode
        }
    }
}

//////////////   GAME LOOP FUNCTIONS   //////////////////

//game initialization function
function init(){
    player.img = document.getElementById("player1IMG");
    player.invincible = document.getElementById("invincible").checked;

    audio_init();
}

function resetMap(){
    GAME_OVER = false;
    ALL_OBSTACLES = [];
    ALL_OBJS = [player];
    player.x = 100;
    player.y = GROUND_Y - player.h;
    player.jumping = false;
    jumpQueued = null;
    resyncBeatSchedule();
}

var levelText = document.getElementById("level");
var goodJumpsText = document.getElementById("good_jumps");
var hitsText = document.getElementById("hits");

document.getElementById("offsetMusic").addEventListener("input", function(){
    musicOffset = parseFloat(this.value);
    ALL_OBSTACLES = [];
    resyncBeatSchedule();
});


//main game loop
function main(){
	requestAnimationFrame(main);
	canvas.focus();

	//panCamera();
    update();
	render();
    renderBEAT();

	//keyboard ticks
	var akey = anyKey();
	if(akey && kt == 0){
		kt = setInterval(function(){keyTick+=1}, 75);
	}else if(!akey){
		clearInterval(kt);
		kt = 0;
		keyTick=0;
	}

	if(song != null)
		marker = (aud.currentTime * (canvas.width-2*offsetX) / aud.duration)

	if(!aud.paused){
		songMark = (aud.currentTime/aud.duration);
	}

    // the player's tapped tempo from their last few jumps (song times are in seconds)
    let calculatedBPM = 0;
    let n = custom_beat_mark.length;
    if(n > 1){
        let first = Math.max(0, n - 5);
        let avgInterval = (custom_beat_mark[n-1] - custom_beat_mark[first]) / (n - 1 - first);
        if(avgInterval > 0)
            calculatedBPM = Math.round(60 / avgInterval);
    }


    // reset
    if(keys[reset_key]){
        resetMap();
    }

	//debug
	var settings = "Song BPM: " + SONG_BPM;
    settings += " | Beat: " + Math.floor(songTime() / beatSec());
    settings += " | Your tempo: " + calculatedBPM;
    if(lastJumpError !== null)
        settings += " | Last jump: " + (lastJumpError >= 0 ? "+" : "") + Math.round(lastJumpError * 1000) + "ms";
    settings += " | Window: ±" + Math.round(timingWindow() * 1000) + "ms";

    levelText.innerHTML = "Level: " + HARDNESS;
    goodJumpsText.innerHTML = "Good Jumps: " + good_jumps;
    hitsText.innerHTML = "Hits: " + hits;

	document.getElementById('debug').innerHTML = settings;
}


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


/////////////////   HTML5 FUNCTIONS  //////////////////

//determine if valud key to press
document.body.addEventListener("keydown", function (e) {
	if(inArr(moveKeySet, e.code)){
		keys[e.code] = true;
	}else if(inArr(actionKeySet, e.code)){
		// one jump per press (holding space no longer auto-jumps), timed at the key press
		if(e.code == space_key && !e.repeat)
			jumpQueued = songTime();
		keys[e.code] = true;
	}
});


// touchscreen down
document.body.addEventListener("pointerdown", function (e) {
    if(inArr(moveKeySet, e.code)){
		keys[e.code] = true;
	}else if(inArr(actionKeySet, e.code)){
		// one jump per press (holding space no longer auto-jumps), timed at the key press
		if(e.code == space_key && !e.repeat)
			jumpQueued = songTime();
		keys[e.code] = true;
	}
});

//check for key released
document.body.addEventListener("keyup", function (e) {
	if(inArr(moveKeySet, e.code)){
		keys[e.code] = false;
	}else if(inArr(actionKeySet, e.code)){
		keys[e.code] = false;
	}
});

//check for key released
document.body.addEventListener("pointerup", function (e) {
	if(inArr(moveKeySet, e.code)){
		keys[e.code] = false;
	}else if(inArr(actionKeySet, e.code)){
		keys[e.code] = false;
	}
});

//prevent scrolling with the game
window.addEventListener("keydown", function(e) {
    if(inArr(moveKeySet, e.code) || (e.code === 'Space' && e.target === document.body)) {
        e.preventDefault();
    }
}, false);




main();
