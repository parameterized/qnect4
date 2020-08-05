
import { targetWidth, defaultVolume, gfx } from './index.js';
import { utils } from './utils.js';

export class Volume {
    w = 75; h = 75; y = 30;
    muted = false;

    constructor() {
        this.x = targetWidth - 30 - this.w;

        let v = window.localStorage.getItem('muted');
        if (v !== null) {
            this.muted = boolean(v);
            if (this.muted) {
                masterVolume(0);
            }
        }
    }

    mousePressed() {
        if (utils.mouseInRect(this)) {
            this.muted = !this.muted;
            if (this.muted) {
                masterVolume(0);
            } else {
                masterVolume(defaultVolume);
            }
            window.localStorage.setItem('muted', this.muted);
        }
    }

    draw() {
        if (utils.mouseInRect(this)) {
            utils.setPointer();
        }
        image(this.muted ? gfx.speakerMute : gfx.speaker, this.x, this.y, this.w, this.h);
    }
}
