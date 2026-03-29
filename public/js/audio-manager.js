// audio-manager.js
'use strict';

class SoundManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.mainGain = this.audioCtx.createGain();
    this.mainGain.connect(this.audioCtx.destination);
    this.bgmAudio = new Audio();
    this.bgmAudio.loop = true;
    this.bgmVolume = 0.3;
    this.seVolume = 0.3;
    this.files = {
      bgm: {
        game: '/assets/bgm/battle1.mp3',
        victory: '/assets/bgm/victory.mp3',
        defeat: '/assets/bgm/defeat.mp3',
      }
    };
  }

  playBGM(key, force = false) {
    const src = this.files.bgm[key];
    if (!src) return;
    if (!force && this.bgmAudio.src.endsWith(src) && !this.bgmAudio.paused) return;
    this.bgmAudio.src = src;
    this.bgmAudio.volume = this.bgmVolume;
    this.bgmAudio.play().catch(() => {
      document.addEventListener('pointerdown', () => this.bgmAudio.play(), { once: true });
    });
  }

  stopBGM() {
    this.bgmAudio.pause();
    this.bgmAudio.currentTime = 0;
  }

  playSE(type) {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const now = this.audioCtx.currentTime;
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(this.seVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    gain.connect(this.mainGain);

    const osc = this.audioCtx.createOscillator();
    osc.connect(gain);
    
    switch (type) {
      case 'click':
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.start(); osc.stop(now + 0.3);
        break;
      case 'levelUp':
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.5);
        osc.start(); osc.stop(now + 0.5);
        break;
      default:
        osc.frequency.setValueAtTime(440, now);
        osc.start(); osc.stop(now + 0.2);
    }
  }
}

window.audioManager = new SoundManager();
document.addEventListener('click', (e) => {
  const target = e.target.closest('button, .crystal-btn');
  if (target && window.audioManager) window.audioManager.playSE('click');
});
