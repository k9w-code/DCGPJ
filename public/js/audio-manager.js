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

  updateBGMVolume(val) {
    this.bgmVolume = parseFloat(val);
    this.bgmAudio.volume = this.bgmVolume;
  }

  updateSEVolume(val) {
    this.seVolume = parseFloat(val);
  }

  stopBGM() {
    this.bgmAudio.pause();
    this.bgmAudio.currentTime = 0;
  }

  playSE(type) {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const now = this.audioCtx.currentTime;
    
    // 基本となるマスターゲイン
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.value = this.seVolume;
    masterGain.connect(this.mainGain);

    switch (type) {
      case 'click':
        this._playSynthSound('sine', 800, 400, 0.05, 0.1, masterGain, now);
        break;
      
      case 'error':
        // エラー用の濁った音
        this._playSynthSound('triangle', 150, 100, 0.05, 0.3, masterGain, now);
        this._playSynthSound('sawtooth', 155, 105, 0.05, 0.3, masterGain, now);
        break;

      case 'levelUp':
        // レベルアップ用のファンファーレ的な音（アルペジオ）
        this._playSynthSound('square', 440, 440, 0.05, 0.15, masterGain, now);
        this._playSynthSound('square', 554, 554, 0.05, 0.15, masterGain, now + 0.15);
        this._playSynthSound('square', 659, 659, 0.05, 0.15, masterGain, now + 0.3);
        this._playSynthSound('sine', 880, 880, 0.05, 0.4, masterGain, now + 0.45);
        break;

      case 'attack':
        // 打撃音
        this._playSynthSound('square', 100, 20, 0.01, 0.2, masterGain, now);
        // ノイズ的な成分
        this._playSynthSound('sawtooth', 80, 10, 0.01, 0.2, masterGain, now);
        break;
        
      case 'select':
      case 'start':
        // 決定音/ゲーム開始音
        this._playSynthSound('sine', 600, 1200, 0.02, 0.3, masterGain, now);
        this._playSynthSound('triangle', 600, 1200, 0.02, 0.3, masterGain, now);
        break;

      default:
        // デフォルトのタップ音
        this._playSynthSound('sine', 440, 0, 0.05, 0.1, masterGain, now);
    }
  }

  // 汎用的なシンセサイザー再生関数
  _playSynthSound(type, freqStart, freqEnd, attackTime, decayTime, destination, startTime) {
    const osc = this.audioCtx.createOscillator();
    const env = this.audioCtx.createGain();
    
    osc.type = type;
    osc.connect(env);
    env.connect(destination);

    // ボリュームエンベロープ（Attack -> Decay）
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(1.0, startTime + attackTime);
    env.gain.exponentialRampToValueAtTime(0.01, startTime + attackTime + decayTime);

    // ピッチへのエンベロープ（任意）
    if(freqEnd > 0) {
        osc.frequency.setValueAtTime(freqStart, startTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), startTime + attackTime + decayTime);
    } else {
        osc.frequency.setValueAtTime(freqStart, startTime);
    }

    osc.start(startTime);
    osc.stop(startTime + attackTime + decayTime + 0.1);
  }
}

window.audioManager = new SoundManager();
document.addEventListener('click', (e) => {
  const target = e.target.closest('button, .crystal-btn');
  if (target && window.audioManager) window.audioManager.playSE('click');
});
