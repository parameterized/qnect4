
import { Viewport } from './viewport.js';
import { Volume } from './volume.js';
import { Game } from './game.js';

export let targetWidth = 1600;
export let targetHeight = 900;
export let viewport, volume;
export let gfx, sfx;

export let defaultVolume = 0.5;
export let touchUsed = false;
export let touchIsPressed = false;
export let touchTimer = 1; // disable mouse if touch use in last 0.5s
export let ptouches = []; // touches before callback
export let touch = null; // set to what callback is referencing

let fixedDt = 1 / 60;
let dtTimer = 0;

//export let game;

window.preload = function () {
    gfx = {
        speaker: loadImage('gfx/speaker.png'),
        speakerMute: loadImage('gfx/speakerMute.png')
    };

    sfx = {
        hit: loadSound('sfx/hit.wav'),
        collapse: loadSound('sfx/collapse.wav')
    };
    masterVolume(defaultVolume);
    sfx.hit.setVolume(0.3);
    sfx.collapse.setVolume(0.6);
}

window.setup = function () {
    let canvas = createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent('sketch');

    // prevent default for right click, double click, and tab
    canvas.elt.addEventListener('contextmenu', e => {
        e.preventDefault();
    });
    canvas.elt.addEventListener('mousedown', e => {
        if (e.detail > 1) {
            e.preventDefault();
        }
    });
    document.addEventListener('keydown', e => {
        if (e.keyCode === 9) { // Tab
            e.preventDefault();
        }
    });

    strokeJoin(ROUND);
    smooth();

    viewport = new Viewport(targetWidth, targetHeight);
    volume = new Volume();
    window.game = new Game();
}

export function resetGame() {
    game = new Game();
}

function pressed() {
    volume.mousePressed();
    game.mousePressed();
}
function released() { }

window.mousePressed = function (event) {
    event.preventDefault();
    if (touchTimer > 0.5) {
        pressed();
    }
}
window.touchStarted = function (event) {
    event.preventDefault();
    touchUsed = true;
    // first element in touches that isn't in ptouches
    touch = touches.filter(t => ptouches.findIndex(pt => pt.id === t.id) === -1)[0];
    touchIsPressed = true;
    if (touch) {
        mouseX = touch.x;
        mouseY = touch.y;
        viewport.updateMouse();
    }
    pressed();
    ptouches = [...touches];
    touch = null;
}

window.mouseReleased = function (event) {
    event.preventDefault();
    if (touchTimer > 0.5) {
        released();
    }
}
window.touchEnded = function (event) {
    event.preventDefault();
    // first element in ptouches that isn't in touches
    touch = ptouches.filter(pt => touches.findIndex(t => t.id === pt.id) === -1)[0];
    if (touches.length === 0) {
        touchIsPressed = false;
    }
    released();
    ptouches = [...touches];
    touch = null;
}

window.mouseDragged = function (event) {
    event.preventDefault();
}
window.touchMoved = function (event) {
    event.preventDefault();
}
window.mouseWheel = function (event) {
    event.preventDefault();
}

window.keyPressed = function () {

}

function update() {
    document.body.style.cursor = 'default';
    let dt = min(1 / frameRate(), 1 / 10);
    dtTimer += dt;
    while (dtTimer > 0) {
        dtTimer -= fixedDt;
        fixedUpdate(fixedDt);
    }

    viewport.updateMouse();
    if (touchIsPressed) {
        touchTimer = 0;
    } else {
        touchTimer += dt;
    }
}

function fixedUpdate(dt) {
    game.update(dt);
}

window.draw = function () {
    update();
    noStroke();

    viewport.set();

    game.draw();
    volume.draw();

    // cover top/bottom off-screen graphics
    fill('#08090A');
    let v = viewport;
    rect(v.fullX, v.fullY, v.fullW, 0 - v.fullY);
    rect(v.fullX, v.targetHeight, v.fullW, v.fullY + v.fullH - v.targetHeight);
    // cover sides
    rect(v.fullX, v.fullY, 0 - v.fullX, v.fullH);
    rect(v.targetWidth, v.fullY, v.fullX + v.fullW - v.targetWidth, v.fullH);

    viewport.reset();
}

window.windowResized = function () {
    resizeCanvas(windowWidth, windowHeight);
    if (viewport) {
        viewport.updateSize();
    }
}
