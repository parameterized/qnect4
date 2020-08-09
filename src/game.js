
import { targetWidth, targetHeight, viewport, sfx, resetGame } from './index.js';
import { utils, ease } from './utils.js';

let circleD = 100;
let pad = 10;
let nx = 7;
let ny = 6;

let varsLoaded = false;

let bgCol, boardCol, playerColors, highlightCol1, highlightCol2;
function loadColors() {
    bgCol = color('#E7E7E7');
    boardCol = color('#FDFFFC');
    highlightCol1 = color('#539987');
    highlightCol2 = color('#539987'); highlightCol2.setAlpha(100);
    playerColors = [color('#C1292E'), color('#235789'), highlightCol1]
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
    activePlayerId = 0; // 0, 1
    turnNum = 1;
    measurableCells = []; // [[i, j], ...]
    won = false;
    winningDisks = new Set();
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
        let c = playerColors[this.activePlayerId]
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
                // remove disks stacked higher than can be supported
                if (cell.length > 1 && cell[0].superposition.length > 0) {
                    for (let j = disk.j - cell.length; j >= 0; j--) {
                        let cell2 = this.boardState[disk.i][j];
                        for (let cd of cell2) {
                            this.removeDisk(cd);
                        }
                    }
                } else if (cell.length === 1 && disk.j > 0) {
                    let cell2 = this.boardState[disk.i][disk.j - 1];
                    for (let cd of cell2) {
                        if (cd.turnNum === cell[0].turnNum) {
                            this.removeDisk(cd);
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
            this.activePlayerId = (this.activePlayerId + 1) % 2;
            this.turnNum++;
            this.loadActiveDisks();
        }
    }

    getHovered() {
        let mx = viewport.mouseX;
        return constrain(floor((mx - boardRect.x - pad / 2) / (pad + circleD)), 0, nx - 1);
    }

    maxEmptyInColumn(i) {
        let checkedDisks = new Set();
        let minDisksInColumn = 0;
        for (let j = ny - 1; j >= 0; j--) {
            let cell = this.boardState[i][j];
            if (cell.length === 0) {
                break;
            }
            for (let disk of cell) {
                if (!checkedDisks.has(disk.turnNum)) {
                    let allInColumn = true;
                    for (let d2 of disk.superposition) {
                        if (d2.i !== i) {
                            allInColumn = false;
                            break;
                        }
                    }
                    if (allInColumn) {
                        minDisksInColumn++;
                    }
                    checkedDisks.add(disk.turnNum);
                }
            }
        }
        let maxEmpty = ny - minDisksInColumn;
        for (let j = 0; j < maxEmpty; j++) {
            let cell = this.boardState[i][j];
            if (cell.length > 0 && cell[0].superposition.length === 0) { // has classical
                return j;
            }
        }
        return maxEmpty;
    }

    updateMeasurableCells() {
        this.measurableCells = [];
        for (let i = 0; i < nx; i++) {
            let n = this.maxEmptyInColumn(i);
            for (let j = ny - 1; j >= 0; j--) {
                let cell = this.boardState[i][j];
                if (cell.length === 1 && cell[0].superposition.length === 0) { // classical
                    continue;
                }
                if (j < n && cell.length !== 4) { // cell can be empty and doesn't have 4 spooky disks
                    break;
                }
                this.measurableCells.push([i, j]);
            }
        }
    }

    checkWon(i, j) {
        let cell = this.boardState[i][j];
        if (cell.length !== 1) {
            return;
        }
        let playerId = cell[0].playerId;
        for (let dir of [[0, 1], [1, 1], [1, 0], [1, -1]]) {
            let consecutive = 1;
            let possibleWinningDisks = [this.boardState[i][j][0]];
            for (let n = 1; n <= 3; n++) { // check + dir
                let ni = i + dir[0] * n;
                let nj = j + dir[1] * n;
                if (!onBoard(ni, nj)) { break; }
                let c2 = this.boardState[ni][nj];
                if (c2.length === 1 && c2[0].playerId === playerId && c2[0].superposition.length === 0) {
                    consecutive++;
                    possibleWinningDisks.push(c2[0]);
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
                    possibleWinningDisks.push(c2[0]);
                } else {
                    break;
                }
            }
            if (consecutive >= 4) {
                this.won = true;
                if (this.wonPlayer !== undefined && this.wonPlayer !== playerId) {
                    this.wonPlayer = 2;
                } else {
                    this.wonPlayer = playerId;
                }
                for (let disk of possibleWinningDisks) {
                    this.winningDisks.add(disk);
                }
            }
        }
    }

    mousePressed() {
        if (this.won) {
            if (this.wonT > 1) {
                resetGame();
            }
        } else if (this.measurableCells.length > 0 && this.activeDisks.length === 2) {
            // measure cell
            for (let [i, j] of this.measurableCells) {
                let [cx, cy] = ij2xy(i, j);
                let cell = this.boardState[i][j];
                let measured = false;
                for (let k = 0; k < cell.length; k++) {
                    let x = cx - circleD / 4 + circleD / 2 * (k % 2);
                    let y = cy + circleD / 4 - circleD / 2 * floor(k / 2);
                    if (utils.mouseInCircle(boardRect.x + x, boardRect.y + y, circleD / 2)) {
                        // collapse to selected disk (remove its superpositions)
                        // other disks in cell will be removed by removeDisk when disk has 0 superpositions
                        let disk = cell[k];
                        while (disk.superposition.length > 0) {
                            this.removeDisk(disk.superposition[0]);
                        }
                        measured = true;
                        break;
                    }
                }
                if (measured) {
                    this.updateMeasurableCells();
                    sfx.collapse.play();
                    break;
                }
            }
        } else if (utils.mouseInRect(boardRect)) {
            // place disk
            let i = this.getHovered();
            let j0 = this.maxEmptyInColumn(i) - 1;
            let diskPlaced = false;
            for (let j = j0; j >= 0; j--) {
                let cell = this.boardState[i][j];
                if (cell.length === 0) { // clear
                    this.addDisk(this.activeDisks.shift(), i, j);
                    diskPlaced = true;
                    break;
                } else if (cell[0].superposition.length > 0) { // has spooky disk
                    let idx = cell.findIndex(disk => disk.turnNum === this.activeDisks[0].turnNum);
                    diskPlaced = true;
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
            if (diskPlaced) {
                this.updateMeasurableCells();
                this.checkNextTurn();
                sfx.hit.play();
            }
        }
    }

    update(dt) {
        if (this.won) {
            this.wonT += dt * 2;
        }
    }

    draw() {
        // win bg
        if (this.won) {
            let t = ease.outQuad(min(this.wonT, 1)) * 0.3;
            background(lerpColor(bgCol, playerColors[this.wonPlayer], t));
        } else {
            background(bgCol);
        }

        // title
        fill('#08090A');
        textAlign(CENTER, CENTER);
        textFont('Georgia');
        textSize(56);
        text('Qnect4', targetWidth / 2, 40);

        // game state message
        {
            textSize(40);
            let x = targetWidth - boardRect.x / 2;
            let y = 250;
            if (this.won) {
                fill(playerColors[this.wonPlayer]);
                if (this.wonPlayer === 2) {
                    text('Game Tied!', x, y);
                } else {
                    text(`${this.wonPlayer === 0 ? 'Red' : 'Blue'} Won!`, x, y);
                }
            } else {
                fill(playerColors[this.activePlayerId]);
                text(`${this.activePlayerId === 0 ? 'Red' : 'Blue'}'s turn`, x, y);
            }
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
        if (this.measurableCells.length > 0 && this.activeDisks.length === 2) {
            // outline collapsible full cells
            stroke(highlightCol1);
            noFill();
            for (let [i, j] of this.measurableCells) {
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
            noStroke();
        } else {
            // show placement guide
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

        // outline winning disks
        if (this.won) {
            stroke(highlightCol1);
            fill(highlightCol2)
            for (let disk of this.winningDisks) {
                circle(...ij2xy(disk.i, disk.j), circleD);
            }
            noStroke();
        }

        pop();
    }
}
