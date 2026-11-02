//set up the canvas
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
canvas.width = 600;
canvas.height = 400;

var size = 16;

var GRAVITY = 4;
var JUMP = -8;
var OBS_SPEED = 4;

var GAME_OVER = true;


var SONG_BPM = 80;
var HARDNESS = 1;
var beat_ct = 0;

var UP_LEVEL_CT = 4;

var hits = 0;
var good_jumps = 0;


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
    this.velY = GRAVITY;
    this.img = img;
    this.img_offset = img_offset;
    this.bbox = new bBox(0, 0, w, h);
    this.cooldown = false;
    this.invincible = false;
}

class Obstacle{
    constructor(x, y, w, h){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.velX = 0;
        this.velY = 0;
        this.img = document.getElementById("spikeIMG");
        this.bbox = new bBox(0, 0, w, h);
        this.alive = true;
        this.cooldown = false;
    }

    update(){
        this.x -= OBS_SPEED;
        if(this.x + this.w <= 0) {
            this.alive = false;
        }
    }

    render(ctx){
        if(this.alive && this.img != null) {
            ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
        }
    }
}

function bBox(x,y,w,h){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
} 

var player = new gameObj(100,100,20,32,document.getElementById("player1Img"),{x:-21,y:-20});
var ground = new gameObj(0,300,canvas.width,100,null);
var firstObs = new gameObj(400,200,32,32,null);

var ALL_OBJS = [player];
var ALL_OBSTACLES = [];

var oi = 0;     // obstacle interval


// make a load image function






//KEYS

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

////////////////   GENERATOR FUNCTIONS   /////////////////

// makes generic spikes appear at the edge of the screen
function generateObstacle(){
    if(GAME_OVER)
        return;


    // reset the beat
    beat_ct++;
    if (beat_ct % 4 === 0) {
        beat_ct = 0;
    }

    if(HARDNESS == 2 && beat_ct % 2 != 0){
        return;
    }
    else if(HARDNESS == 1 && beat_ct != 0){
        return;
    }

    


    var x = canvas.width;
    var y = 270 ;
    var w = 32;
    var h = 32;
    var obs = new Obstacle(x, y, w, h);
    ALL_OBSTACLES.push(obs);
    // ALL_OBJS.push(obs);

    console.log("beat");
}

// oi = setInterval(generateObstacle, 1000/((SONG_BPM / 60)));


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
    return isColliding(spr, ground);
}

//////////////////  RENDER FUNCTIONS  ////////////////////

function render(){
	ctx.save();
	//ctx.translate(-camera.x, -camera.y);		//camera
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	//background
	ctx.fillStyle = "#dedede";
	ctx.fillRect(0,0,canvas.width, canvas.height);

    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0,300,canvas.width,100);

    ctx.fillStyle = "#000";
    ctx.fillRect(0,300,canvas.width,2)
	
	/*   add draw functions here  */
    if(player.img != null) {
        if(player.cooldown){
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#560000"; // red color to indicate cooldown
        }
        ctx.drawImage(player.img, player.x+player.img_offset.x, player.y+player.img_offset.y, 64,64);
        ctx.globalAlpha = 1; // reset alpha after drawing
    }
 
    // show first obstacle
    // ctx.fillStyle = "#2200ff";
    // if(firstObs) {
    //     ctx.fillRect(firstObs.x, firstObs.y, firstObs.w, firstObs.h );
    // }

    // draw all obstacles
    ctx.fillStyle = "#2200ff";
    ALL_OBSTACLES.forEach(function(obs) {
        if(obs.img != null) {
            obs.render();
        }else{
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        }
    });


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

    // apply to all objects affected by physics
    ALL_OBJS.forEach(function(obj) {
        if(obj.velY < GRAVITY) {
            obj.velY += GRAVITY / 10;
        }
        
        // falling logic
        if(!onGround(obj)) {
            obj.y += obj.velY;
        }
    });

    // jump
    if (keys[space_key] && onGround(player) && !player.jumping){
        console.log("Jumping!");
        player.jumping = true;
        player.velY = JUMP;
        player.y += player.velY;
    }else if(onGround(player)) {
        player.jumping = false;
    }


    // first obstacle logic
    // if(!GAME_OVER){
    //     firstObs.x -= OBS_SPEED;
    //     if(firstObs.x + firstObs.w <= 0) {
    //         firstObs.x = canvas.width-1;
    //     }

    //     if(isColliding(player,firstObs)){
    //         GAME_OVER = true;
    //     }
  
    // }else{
    //     if(keys[space_key]){
    //         GAME_OVER = false;
    //         firstObs.x = canvas.width-1;
    //     }
    // }

    // move the obstacles + check collisions
    if(!GAME_OVER){
        ALL_OBSTACLES.forEach(function(o){
            o.update();

            // if touching player, register a hit and apply cooldown
            if(!player.invincible && !player.cooldown && isColliding(player,o)){
                hits++;
                good_jumps = 0;
                player.cooldown = true;
                setTimeout(function(){
                    player.cooldown = false;
                }, 1000); // 1 second cooldown
            }else if(!player.cooldown && !o.cooldown && o.x + o.w < player.x){
                good_jumps++;
                o.cooldown = true;

                if(good_jumps > 0 && good_jumps % UP_LEVEL_CT == 0){
                    HARDNESS++; // increase hardness for every 10 good jumps
                    if(HARDNESS > 3){
                        HARDNESS = 3; // cap the maximum hardness
                    }
                }
            }
        });
    }


    // reduce the level until game over
    if(hits >= 3){
        if(HARDNESS == 1){
            GAME_OVER = true;
        }else{
            hits = 0; // reset hits for non-hard mode
            HARDNESS--; // reset hardness for non-hard mode
            good_jumps = 0; // reset good jumps for non-hard mode
        }
    }

    // increase the level
    

            
        

}

//////////////   GAME LOOP FUNCTIONS   //////////////////

//game initialization function
function init(){
    player.img = document.getElementById("player1IMG");
}

function resetMap(){
    GAME_OVER = false;
    ALL_OBSTACLES = [];
    ALL_OBJS = [player];
    player.x = 100;
    player.y = 200;
    player.velY = 0;
    player.jumping = false;
}

var levelText = document.getElementById("level");
var goodJumpsText = document.getElementById("good_jumps");
var hitsText = document.getElementById("hits");


var songBeatNum = 0;
var lastBeat = 0;
var musicOffset = 0.23;
document.getElementById("offsetMusic").addEventListener("input", function(){
    musicOffset = parseFloat(this.value);
});

oi = setInterval(function(){
    if(songBeatNum != lastBeat){
        lastBeat = songBeatNum;
        generateObstacle();
    }
}, 1);


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


	// renderBEAT();

	if(song != null)
		marker = (aud.currentTime * (canvas.width-2*offsetX) / aud.duration)

	if(!aud.paused){
		songMark = (aud.currentTime/aud.duration);
		songBeatNum = Math.floor((songMark + musicOffset) * totBeats);


        
	
		// if(bi < beatConv.length-1 && songMark >= beatConv[bi]){
		// 	//beatHeart();
		// 	bi++;
		// }
		// if(abi < artBeatConv.length-1 && songMark >= artBeatConv[abi]){
		// 	//beatOuterHeart();

		// 	// updateBackground();
		// 	abi++;
		// }
		// if(ri < rhythmConv.length-1 && songMark >= rhythmConv[ri]){
		// 	//beatHeart();
		// 	ri++;
		// }
	}



    // reset
    if(keys[reset_key]){
        resetMap();
    }

	//debug
	var settings = "Song Mark: " + songMark;
    settings += " | Song Beat Num: " + songBeatNum;

    levelText.innerHTML = "Level: " + HARDNESS;
    goodJumpsText.innerHTML = "Good Jumps: " + good_jumps;
    hitsText.innerHTML = "Hits: " + hits;

	document.getElementById('debug').innerHTML = settings;
}


/////////////////   HTML5 FUNCTIONS  //////////////////

//determine if valud key to press
document.body.addEventListener("keydown", function (e) {
	if(inArr(moveKeySet, e.code)){
		keys[e.code] = true;
	}else if(inArr(actionKeySet, e.code)){
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

//prevent scrolling with the game
window.addEventListener("keydown", function(e) {
    // space and arrow keys
    if(([32, 37, 38, 39, 40].indexOf(e.code) > -1)){
        e.preventDefault();
    }
}, false);


main();