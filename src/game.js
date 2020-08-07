
import { targetWidth, targetHeight, viewport, sfx, resetGame } from './index.js';
import { utils, ease } from './utils.js';

let circleD = 100;
let pad = 10;
let nx = 7;
let ny = 6;

let varsLoaded = false;

let bgCol, boardCol, p1Col, p2Col, highlightCol1, highlightCol2;
function loadColors() {
    bgCol = color('#E7E7E7');
    boardCol = color('#FDFFFC');
    p1Col = color('#C1292E');
    p2Col = color('#235789');
    highlightCol1 = color('#539987');
    highlightCol2 = color('#539987'); highlightCol2.setAlpha(100);
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
    activePlayerId = 1; // 1, 2
    turnNum = 1;
    fullCells = []; // [[i, j], ...]
    won = false;
    winningPieces = [];
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
                this.boardState[i][j] = [];
            }
        }

        this.loadActiveDisks();
    }

    newDisk() {
        let c = this.activePlayerId === 1 ? p1Col : p2Col;
        colorMode(HSB);
        c = color(
            utils.mod(hue(c) + random(-10, 10), 360),
            saturation(c) + random(-10, 10),
            brightness(c) + random(-5, 5)
        );
        colorMode(RGB);
        return { playerId: this.activePlayerId, turnNum: this.turnNum, color: c, superposition: [] };
    }

    splitDisk(disk) {
        let d2 = { ...disk };
        d2.superposition = [disk];
        for (let sd of disk.superposition) {
            d2.superposition.push(sd);
            sd.superposition.push(d2);
        }
        disk.superposition.push(d2);
        return d2;
    }

    addDisk(disk, i, j) {
        disk.i = i, disk.j = j;
        let cell = this.boardState[i][j];
        cell.push(disk);
        if (cell.length === 4) {
            this.fullCells.push([i, j]);
        }
    }

    removeDisk(disk) {
        // remove from superpositions
        for (let sd of disk.superposition) {
            let idx = sd.superposition.indexOf(disk);
            if (idx !== -1) {
                sd.superposition.splice(idx, 1);
                if (sd.superposition.length === 0) { // collapsed
                    // remove other disks in cell
                    let cell = this.boardState[sd.i][sd.j];
                    while (cell.length > 1) {
                        if (cell[0] === sd) {
                            this.removeDisk(cell[1]);
                        } else {
                            this.removeDisk(cell[0]);
                        }
                    }
                    this.checkWon(sd.i, sd.j);
                }
            }
        }
        // remove from board if on it
        if (disk.i !== undefined) {
            let cell = this.boardState[disk.i][disk.j];
            let idx = cell.indexOf(disk);
            if (idx !== -1) {
                cell.splice(idx, 1);
                // if cell was full, remove from fullCells
                for (let fci = 0; fci < this.fullCells.length; fci++) {
                    let [i, j] = this.fullCells[fci];
                    if (i === disk.i && j === disk.j) {
                        this.fullCells.splice(fci, 1);
                        break;
                    }
                }
                // if cell contains 1, remove any of remaining disk's superpositions that are above
                if (cell.length === 1) {
                    let cd = cell[0];
                    if (cd.j - 1 >= 0) {
                        let cell2 = this.boardState[cd.i][cd.j - 1];
                        let idx2 = cell2.findIndex(d => d.turnNum === cd.turnNum);
                        if (idx2 !== -1) {
                            this.removeDisk(cell2[idx2]);
                        }
                    }
                }
            }
        }
    }

    loadActiveDisks() {
        let d = this.newDisk();
        this.activeDisks = [d, this.splitDisk(d)];
    }

    checkNextTurn() {
        if (this.activeDisks.length === 0) {
            this.activePlayerId = this.activePlayerId % 2 + 1;
            this.turnNum++;
            this.loadActiveDisks();
        }
    }

    getHovered() {
        let mx = viewport.mouseX;
        return constrain(floor((mx - boardRect.x - pad / 2) / (pad + circleD)), 0, nx - 1);
    }

    checkWon(i, j) {
        let cell = this.boardState[i][j];
        if (cell.length !== 1) {
            return;
        }
        let playerId = cell[0].playerId;
        for (let dir of [[0, 1], [1, 1], [1, 0], [1, -1]]) {
            let consecutive = 1;
            let winningPieces = [this.boardState[i][j][0]];
            for (let n = 1; n <= 3; n++) { // check + dir
                let ni = i + dir[0] * n;
                let nj = j + dir[1] * n;
                if (!onBoard(ni, nj)) { break; }
                let c2 = this.boardState[ni][nj];
                if (c2.length === 1 && c2[0].playerId === playerId && c2[0].superposition.length === 0) {
                    consecutive++;
                    winningPieces.push(c2[0]);
                } else {
                    break;
                }
            }
            for (let n = 1; n <= 3; n++) { // check - dir
                let ni = i - dir[0] * n;
                let nj = j - dir[1] * n;
                if (!onBoard(ni, nj)) { break; }
                let c2 = this.boardState[ni][nj];
                if (c2.length === 1 && c2[0].playerId === playerId && c2[0].superposition.length === 0) {
                    consecutive++;
                    winningPieces.push(c2[0]);
                } else {
                    break;
                }
            }
            if (consecutive >= 4) {
                this.won = true;
                this.wonPlayer = playerId;
                this.winningPieces = winningPieces;
            }
        }
    }

    mousePressed() {
        if (this.won) {
            if (this.wonT > 1) {
                resetGame();
            }
        } else if (this.fullCells.length > 0 && this.activeDisks.length === 2) {
            // choose collapse if has full cells and not placing 2nd disk
            for (let [i, j] of this.fullCells) {
                if (!onBoard(i, j + 1) || this.boardState[i][j + 1][0].superposition.length === 0) {
                    let [cx, cy] = ij2xy(i, j);
                    let cell = this.boardState[i][j];
                    let diskClicked = false;
                    for (let k = 0; k < cell.length; k++) {
                        let x = cx - circleD / 4 + circleD / 2 * (k % 2);
                        let y = cy + circleD / 4 - circleD / 2 * floor(k / 2);
                        if (utils.mouseInCircle(boardRect.x + x, boardRect.y + y, circleD / 2)) {
                            diskClicked = true;
                            // collapse to selected disk (remove its superpositions)
                            // other disks in cell will be removed when disk has 0 superpositions
                            let disk = cell[k];
                            while (disk.superposition.length > 0) {
                                this.removeDisk(disk.superposition[0]);
                            }
                            sfx.collapse.play();
                            break;
                        }
                    }
                    if (diskClicked) { break; }
                }
            }
        } else if (utils.mouseInRect(boardRect)) {
            let i = this.getHovered();
            for (let j = ny - 1; j >= 0; j--) {
                let cell = this.boardState[i][j];
                if (cell.length === 0) { // clear
                    this.addDisk(this.activeDisks.shift(), i, j);
                    break;
                } else if (cell[0].superposition.length > 0) { // has spooky (cells above either spooky or clear)
                    let idx = cell.findIndex(disk => disk.turnNum === this.activeDisks[0].turnNum);
                    if (idx === -1) {
                        if (j === 0) {
                            this.addDisk(this.activeDisks.shift(), i, j);
                        } else {
                            this.addDisk(this.splitDisk(this.activeDisks[0]), i, j);
                        }
                    } else { // disk dropped in same place
                        this.removeDisk(this.activeDisks.shift());
                        break;
                    }
                }
            }
            this.checkNextTurn();
            sfx.hit.play();
        }
    }

    update(dt) {
        if (this.won) {
            this.wonT += dt * 2;
        }
    }

    draw() {
        if (this.won) {
            let t = ease.outQuad(min(this.wonT, 1)) * 0.3;
            background(lerpColor(bgCol, this.wonPlayer === 1 ? p1Col : p2Col, t));
        } else {
            background(bgCol);
        }

        fill('#08090A');
        textAlign(CENTER, CENTER);
        textFont('Georgia');
        textSize(56);
        text('Qnect4', targetWidth / 2, 40);

        textSize(40);
        if (this.won) {
            fill(this.wonPlayer === 1 ? p1Col : p2Col);
            text(`${this.wonPlayer === 1 ? 'Red' : 'Blue'} Won!`, targetWidth - boardRect.x / 2, 250);
        } else {
            fill(this.activePlayerId === 1 ? p1Col : p2Col);
            text(`${this.activePlayerId === 1 ? 'Red' : 'Blue'}'s turn`, targetWidth - boardRect.x / 2, 250);
        }

        push();
        translate(boardRect.x, boardRect.y);

        // disks
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < ny; j++) {
                let cell = this.boardState[i][j];
                let [cx, cy] = ij2xy(i, j);
                if (cell.length === 1) {
                    let disk = cell[0];
                    fill(disk.color);
                    let spooky = disk.superposition.length > 0;
                    circle(cx, cy, spooky ? circleD / 2 : circleD);
                    textSize(spooky ? 24 : 48);
                    fill(0);
                    text(disk.turnNum, cx, cy);
                } else {
                    for (let k = 0; k < cell.length; k++) {
                        let disk = cell[k];
                        fill(disk.color);
                        let x = cx - circleD / 4 + circleD / 2 * (k % 2);
                        let y = cy + circleD / 4 - circleD / 2 * floor(k / 2);
                        circle(x, y, circleD / 2);
                        textSize(24);
                        fill(0);
                        text(disk.turnNum, x, y);
                    }
                }
            }
        }

        image(boardImage, 0, 0);

        strokeWeight(3);
        if (this.fullCells.length > 0 && this.activeDisks.length === 2) {
            // outline collapsible full cells
            stroke(highlightCol1);
            noFill();
            for (let [i, j] of this.fullCells) {
                if (!onBoard(i, j + 1) || this.boardState[i][j + 1][0].superposition.length === 0) {
                    let [cx, cy] = ij2xy(i, j);
                    for (let k = 0; k < this.boardState[i][j].length; k++) {
                        let x = cx - circleD / 4 + circleD / 2 * (k % 2);
                        let y = cy + circleD / 4 - circleD / 2 * floor(k / 2);
                        noFill();
                        if (utils.mouseInCircle(boardRect.x + x, boardRect.y + y, circleD / 2)) {
                            utils.setPointer();
                            fill(highlightCol2);
                        }
                        circle(x, y, circleD / 2);
                    }
                }
            }
            noStroke();
        } else {
            let i = this.getHovered();
            if (!this.won && utils.mouseInRect(boardRect) && (this.boardState[i][0].length === 0 || this.boardState[i][0][0].superposition.length > 0)) {
                utils.setPointer();
                // selected column
                fill(0, 16);
                let sx = i > 0 ? pad / 2 + (pad + circleD) * i : 0;
                let sw = i === 0 || i === nx - 1 ? pad * 1.5 + circleD : pad + circleD;
                rect(sx, 0, sw, boardRect.h);
                // active disks
                let [x, y] = ij2xy(i, -1);
                y -= pad;
                fill(this.activeDisks[0].color);
                textSize(24);
                if (this.activeDisks.length === 2) {
                    circle(x - circleD / 4, y, circleD / 2);
                    circle(x + circleD / 4, y, circleD / 2);
                    fill(0);
                    text(this.turnNum, x - circleD / 4, y);
                    text(this.turnNum, x + circleD / 4, y);
                } else {
                    circle(x, y, circleD / 2);
                    fill(0);
                    text(this.turnNum, x, y);
                }
            }
        }

        // outline winning pieces
        if (this.won) {
            stroke(highlightCol1);
            fill(highlightCol2)
            for (let disk of this.winningPieces) {
                circle(...ij2xy(disk.i, disk.j), circleD);
            }
            noStroke();
        }

        pop();
    }
}
