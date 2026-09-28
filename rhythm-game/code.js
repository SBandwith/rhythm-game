//set up the canvas
var canvas = document.getElementById("game");
var ctx = canvas.getContext("2d");
canvas.width = 600;
canvas.height = 400;

var size = 16;

var GRAVITY = 4;
var JUMP = -8;
var OBS_SPEED = 4;

var GAME_OVER = false;

//camera
var camera = {
	x : 0,
	y : 0
};


function gameObj(x,y,w,h,img){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.velX = 0;
    this.velY = GRAVITY;
    this.img = img;
    this.bbox = new bBox(0, 0, w, h);
}


function obstacle(x,y){
    this.x = x;
    this.y = y;
    this.velX = 0;
    this.velY = 0;
    this.bbox = new bBox(0, 0, 64, 64);
}

function bBox(x,y,w,h){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
}

var player = new gameObj(100,100,64,64,null);
var ground = new gameObj(0,300,canvas.width,100,null);
var firstObs = new gameObj(400,200,32,32,null);

var ALL_OBJS = [player,firstObs];


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
var actionKeySet = [shift_key,a_key, b_key,space_key];

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
        ctx.drawImage(player.img, player.x, player.y, 64,64);
    }
 
    // show first obstacle
    ctx.fillStyle = "#2200ff";
    if(firstObs) {
        ctx.fillRect(firstObs.x, firstObs.y, firstObs.w, firstObs.h );
    }

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


    // obstacle logic
    if(!GAME_OVER){
        firstObs.x -= OBS_SPEED;
        if(firstObs.x + firstObs.w <= 0) {
            firstObs.x = canvas.width-1;
        }

        if(isColliding(player,firstObs)){
            GAME_OVER = true;
        }
  
    }else{
        if(keys[space_key]){
            GAME_OVER = false;
            firstObs.x = canvas.width-1;
        }
    }
    

}

//////////////   GAME LOOP FUNCTIONS   //////////////////

//game initialization function
function init(){
    player.img = document.getElementById("playerIMG");
}

//main game loop
function main(){
	requestAnimationFrame(main);
	canvas.focus();

	//panCamera();
    update();
	render();

	//keyboard ticks
	var akey = anyKey();
	if(akey && kt == 0){
		kt = setInterval(function(){keyTick+=1}, 75);
	}else if(!akey){
		clearInterval(kt);
		kt = 0;
		keyTick=0;
	}

	//debug
	var settings = "debug here";

	//document.getElementById('debug').innerHTML = settings;
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