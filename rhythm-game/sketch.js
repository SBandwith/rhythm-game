var player = null;
var playerIMG = null;

function preload(){
    playerIMG = loadImage('assets/p5.png');
}

function setup() {
    createCanvas(800, 600);

    player = new Sprite(playerIMG, 0,0);
}




function draw() {
    background(220);

    // draw the ground
    fill(0,255,0);
    rect(0,450, width, height/4);

    // draw the character
    player.spr.draw();
}

function update(){
    if(kb.arrow)
}