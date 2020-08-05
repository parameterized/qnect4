
import { targetWidth, targetHeight, viewport, sfx, resetGame } from './index.js';
import { utils } from './utils.js';

let circleD = 100;
let pad = 10;
let nx = 7;
let ny = 6;
let pixelsPerMeter = 1000;

let varsLoaded = false;

let bgCol, boardCol, p1Col, p2Col;
function loadColors() {
    bgCol = color('#E7E7E7');
    boardCol = color('#FDFFFC');
    p1Col = color('#C1292E');
    p2Col = color('#235789');
}

let boardRect;
function loadBoardRect() {
    let w = (pad + circleD) * nx + pad;
    let h = (pad + circleD) * ny + pad;
    let x = targetWidth / 2 - w / 2;
    let y = targetHeight - 40 - h;
    boardRect = { x: x, y: y, w: w, h: h };
}

let boardImage;
function generateBoardImage() {
    let g = createGraphics(boardRect.w, boardRect.h);
    g.background(boardCol);
    g.blendMode(REMOVE);
    g.noStroke();
    g.fill(255);
    for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
            g.circle(...ij2xy(i, j), circleD);
        }
    }
    g.blendMode(BLEND);
    boardImage = g;
}

let ij2xy = (i, j) => [(pad + circleD) * i + pad + circleD / 2, (pad + circleD) * j + pad + circleD / 2];
let onBoard = (i, j) => i >= 0 && i < nx && j >= 0 && j < ny;

export class Game {
    activePlayerId = 1;
    lastPlaced = [-1, -1];
    dropAnim = { t: 0, hitPlayed: false, x: 0, y1: 0, y2: 0, y3: 0, t1: 0, t2: 0 };
    won = false;
    wonT = 0;

    constructor() {
        if (!varsLoaded) {
            loadColors();
            loadBoardRect();
            generateBoardImage();
            varsLoaded = true;
        }

        this.boardState = [];
        for (let i = 0; i < nx; i++) {
            this.boardState[i] = [];
            for (let j = 0; j < ny; j++) {
                this.boardState[i][j] = 0; // 0: empty, 1: p1, 2: p2
            }
        }
    }

    getHovered() {
        let mx = viewport.mouseX;
        return constrain(floor((mx - boardRect.x - pad / 2) / (pad + circleD)), 0, nx - 1);
    }

    checkWon(i, j) {
        let v = this.boardState[i][j];
        for (let dir of [[0, 1], [1, 1], [1, 0], [1, -1]]) {
            let consecutive = 1;
            for (let n = 1; n <= 3; n++) { // check + dir
                let ni = i + dir[0] * n;
                let nj = j + dir[1] * n;
                if (!onBoard(ni, nj) || this.boardState[ni][nj] !== v) {
                    break;
                } else {
                    consecutive++;
                }
            }
            for (let n = 1; n <= 3; n++) { // check - dir
                let ni = i - dir[0] * n;
                let nj = j - dir[1] * n;
                if (!onBoard(ni, nj) || this.boardState[ni][nj] !== v) {
                    break;
                } else {
                    consecutive++;
                }
            }
            if (consecutive >= 4) {
                this.won = true;
            }
        }
    }

    mousePressed() {
        let da = this.dropAnim;
        if (this.won) {
            if (da.t > da.t1) {
                resetGame();
            }
        } else if (utils.mouseInRect(boardRect)) {
            let i = this.getHovered();
            for (let j = ny - 1; j >= 0; j--) {
                if (this.boardState[i][j] === 0) {
                    this.boardState[i][j] = this.activePlayerId;
                    this.activePlayerId = this.activePlayerId % 2 + 1;

                    if (!da.hitPlayed && this.lastPlaced[0] !== -1) {
                        sfx.hit.play();
                    }
                    this.lastPlaced = [i, j];
                    let lp = this.lastPlaced;
                    da.t = 0;
                    da.hitPlayed = false;
                    let [x, y1] = ij2xy(lp[0], -1); // top
                    da.x = x; da.y1 = y1;
                    da.y2 = ij2xy(...lp)[1]; // bottom
                    da.y3 = da.y2 + (da.y1 - da.y2) * 0.1; // top of bounce
                    da.t1 = sqrt(2 * (da.y2 - da.y1) / (9.8 * pixelsPerMeter)); // time to hit
                    da.t2 = sqrt(2 * (da.y2 - da.y3) / (9.8 * pixelsPerMeter)); // half time of bounce

                    this.checkWon(i, j);
                    break;
                }
            }
        }
    }

    update(dt) {
        let da = this.dropAnim;
        da.t += dt;
        if (this.won && da.t > da.t1) {
            this.wonT += dt;
        }
    }

    draw() {
        if (this.won) {
            let t = sin(min(this.wonT * 3, HALF_PI)) * 0.3;
            background(lerpColor(bgCol, this.activePlayerId === 1 ? p2Col : p1Col, t));
        } else {
            background(bgCol);
        }

        fill('#08090A');
        textAlign(CENTER, CENTER);
        textFont('Georgia');
        textSize(56);
        text('Qnect4', targetWidth / 2, boardRect.y / 4);

        push();
        translate(boardRect.x, boardRect.y);

        let lp = this.lastPlaced;
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                let v = this.boardState[i][j];
                if (v !== 0 && !(i === lp[0] && j === lp[1])) {
                    fill(v === 1 ? p1Col : p2Col);
                    circle(...ij2xy(i, j), circleD);
                }
            }
        }
        // bounce animation
        if (lp[0] !== -1) {
            let v = this.boardState[lp[0]][lp[1]];
            fill(v === 1 ? p1Col : p2Col);
            let da = this.dropAnim;
            let t = da.t;
            let y;
            if (t < da.t1) {
                y = da.y1 + 4.9 * pixelsPerMeter * sq(t);
            } else {
                t = abs(t - (da.t1 + da.t2));
                y = min(da.y3 + 4.9 * pixelsPerMeter * sq(t), da.y2);
                if (!da.hitPlayed) {
                    sfx.hit.play();
                    da.hitPlayed = true;
                }
            }
            circle(da.x, y, circleD);
        }

        image(boardImage, 0, 0);

        let i = this.getHovered();
        if (!this.won && utils.mouseInRect(boardRect) && this.boardState[i][0] === 0) {
            utils.setPointer();
            fill(0, 16);
            let sx = i > 0 ? pad / 2 + (pad + circleD) * i : 0;
            let sw = i === 0 || i === nx - 1 ? pad * 1.5 + circleD : pad + circleD;
            rect(sx, 0, sw, boardRect.h);
            fill(this.activePlayerId === 1 ? p1Col : p2Col);
            circle(...ij2xy(i, -1), circleD);
        }

        pop();
    }
}
