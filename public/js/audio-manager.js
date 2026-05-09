// audio-manager.js
'use strict';

class SoundManager {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.mainGain = this.audioCtx.createGain();
    this.mainGain.connect(this.audioCtx.destination);
    this.bgmAudio = new Audio();
    this.bgmSource = null;
    this.bgmAudio.loop = true;
    this.bgmVolume = 0.3;
    this.seVolume = 0.3;
    this.files = {
      bgm: {
        game: '/assets/bgm/battle1.mp3',
        battle1: '/assets/bgm/battle1.mp3',
        battle2: '/assets/bgm/battle2.mp3',
        battle3: '/assets/bgm/battle3.mp3',
        battle4: '/assets/bgm/battle4.mp3',
        battle5: '/assets/bgm/battle5.mp3',
        battle6: '/assets/bgm/battle6.mp3',
        battle7: '/assets/bgm/battle7.mp3',
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
    this.bgmAudio.crossOrigin = "anonymous";
    
    if (!this.bgmSource) {
      this.bgmSource = this.audioCtx.createMediaElementSource(this.bgmAudio);
      this.bgmSource.connect(this.mainGain);
    }
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    this.bgmAudio.play().catch(() => {
      const playOnce = () => {
        this.bgmAudio.play();
        document.removeEventListener('pointerdown', playOnce);
      };
      document.addEventListener('pointerdown', playOnce);
    });
  }

  updateBGMVolume(val) {
    this.bgmVolume = parseFloat(val);
    this.bgmAudio.volume = this.bgmVolume;
    if (this.mainGain) if (this.mainGain && this.mainGain.gain) this.mainGain.gain.setTargetAtTime(this.bgmVolume, this.audioCtx.currentTime, 0.05);
    this.bgmVolume = parseFloat(val);
    this.bgmAudio.volume = this.bgmVolume;
  }

  updateSEVolume(val) {
    this.seVolume = parseFloat(val);
    this.seVolume = parseFloat(val);
  }

  stopBGM() {
    this.bgmAudio.pause();
    this.bgmAudio.currentTime = 0;
  }

  playSE(type) {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const now = this.audioCtx.currentTime;
    
    // \u57fa\u672c\u3068\u306a\u308b\u30de\u30b9\u30bf\u30fc\u30b2\u30a4\u30f3
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.value = this.seVolume;
    masterGain.connect(this.mainGain);

    switch (type) {
      // ========================================
      // \u30b7\u30fc\u30eb\u30c9\u30d6\u30ec\u30a4\u30af \u2014 \u30ac\u30e9\u30b9\u7834\u7815\u97f3 + \u91cd\u4f4e\u97f3
      // ========================================
      case 'shield_break':
        this._playSynthSound('square', 200, 50, 0.02, 0.4, masterGain, now);
        this._playSynthSound('sawtooth', 350, 60, 0.03, 0.5, masterGain, now);
        this._playSynthSound('sine', 80, 10, 0.01, 0.8, masterGain, now);
        this._playNoise(0.04, 0.3, masterGain, now, 2000);       // \u7834\u7815\u30ce\u30a4\u30ba
        this._playNoise(0.02, 0.2, masterGain, now + 0.1, 3000); // \u6b8b\u97ff\u30ce\u30a4\u30ba
        break;

      // ========================================
      // \u30af\u30ea\u30c3\u30af \u2014 \u30af\u30ea\u30b9\u30bf\u30eb\u30bf\u30c3\u30d7
      // ========================================
      case 'click':
        this._playSynthSound('sine', 1200, 800, 0.015, 0.08, masterGain, now);
        this._playSynthSound('triangle', 2400, 1600, 0.01, 0.05, masterGain, now);
        break;

      // ========================================
      // \u30a8\u30e9\u30fc \u2014 \u77ed\u3044\u4e0d\u5354\u548c\u97f3
      // ========================================
      case 'error':
        this._playSynthSound('triangle', 220, 150, 0.03, 0.15, masterGain, now);
        this._playSynthSound('square', 185, 130, 0.03, 0.15, masterGain, now);
        break;

      // ========================================
      // \u30ec\u30d9\u30eb\u30a2\u30c3\u30d7 \u2014 \u30d5\u30a1\u30f3\u30d5\u30a1\u30fc\u30ec\u30a2\u30eb\u30da\u30b8\u30aa
      // ========================================
      case 'levelUp':
        this._playSynthSound('square', 440, 440, 0.04, 0.12, masterGain, now);
        this._playSynthSound('square', 554, 554, 0.04, 0.12, masterGain, now + 0.12);
        this._playSynthSound('square', 659, 659, 0.04, 0.12, masterGain, now + 0.24);
        this._playSynthSound('sine', 880, 880, 0.04, 0.35, masterGain, now + 0.36);
        this._playSynthSound('triangle', 1320, 1320, 0.03, 0.3, masterGain, now + 0.36);
        break;

      // ========================================
      // \u6226\u95d8\u885d\u6483 \u2014 \u91cd\u539a\u306a\u6253\u6483\u97f3
      // ========================================
      case 'attack':
      case 'impact':
        this._playSynthSound('triangle', 250, 40, 0.01, 0.25, masterGain, now);
        this._playSynthSound('sine', 120, 20, 0.005, 0.35, masterGain, now);
        this._playSynthSound('square', 80, 15, 0.01, 0.2, masterGain, now);
        this._playNoise(0.02, 0.15, masterGain, now, 800);
        break;
        
      // ========================================
      // \u53ec\u559a \u2014 \u9b54\u6cd5\u7684\u4e0a\u6607\u97f3 + \u30cf\u30fc\u30e2\u30cb\u30af\u30b9
      // ========================================
      case 'summon':
        this._playSynthSound('sine', 300, 900, 0.15, 0.5, masterGain, now);
        this._playSynthSound('triangle', 450, 1350, 0.1, 0.55, masterGain, now);
        this._playSynthSound('sine', 600, 1800, 0.08, 0.4, masterGain, now + 0.05);
        this._playSynthSound('sine', 150, 300, 0.12, 0.6, masterGain, now);  // \u4f4e\u97f3\u306e\u571f\u53f0
        break;

      // ========================================
      // \u6c7a\u5b9a/\u958b\u59cb \u2014 \u4e0a\u6607\u30c1\u30e3\u30a4\u30e0
      // ========================================
      case 'select':
      case 'start':
        this._playSynthSound('sine', 600, 1200, 0.02, 0.25, masterGain, now);
        this._playSynthSound('triangle', 600, 1200, 0.02, 0.25, masterGain, now);
        this._playSynthSound('sine', 900, 1800, 0.015, 0.2, masterGain, now + 0.08);
        break;

      // ========================================
      // \u30ab\u30fc\u30c9\u30c9\u30ed\u30fc \u2014 \u7d19\u3081\u304f\u308a\u98a8
      // ========================================
      case 'draw':
        this._playNoise(0.01, 0.06, masterGain, now, 5000);
        this._playSynthSound('sine', 800, 1400, 0.01, 0.08, masterGain, now);
        this._playSynthSound('triangle', 1200, 2000, 0.008, 0.06, masterGain, now + 0.02);
        break;

      // ========================================
      // \u30bf\u30fc\u30f3\u958b\u59cb \u2014 \u8358\u53b3\u306a\u30d9\u30eb\u30c1\u30e3\u30a4\u30e0
      // ========================================
      case 'turn_start':
        this._playSynthSound('sine', 523, 523, 0.05, 0.4, masterGain, now);      // C5
        this._playSynthSound('sine', 659, 659, 0.04, 0.35, masterGain, now);     // E5
        this._playSynthSound('sine', 784, 784, 0.03, 0.45, masterGain, now);     // G5
        this._playSynthSound('triangle', 523, 523, 0.03, 0.3, masterGain, now);  // \u500d\u97f3
        break;

      // ========================================
      // \u30e6\u30cb\u30c3\u30c8\u6483\u7834 \u2014 \u4f4e\u97f3\u306e\u5d29\u58ca\u97f3
      // ========================================
      case 'death':
        this._playSynthSound('sawtooth', 200, 30, 0.02, 0.5, masterGain, now);
        this._playSynthSound('sine', 100, 15, 0.01, 0.6, masterGain, now);
        this._playNoise(0.03, 0.25, masterGain, now, 600);
        this._playSynthSound('triangle', 60, 10, 0.01, 0.8, masterGain, now + 0.1);
        break;

      // ========================================
      // \u56de\u5fa9 \u2014 \u6696\u8272\u7cfb\u30c1\u30e3\u30a4\u30e0\uff08\u7652\u3057\uff09
      // ========================================
      case 'heal':
        this._playSynthSound('sine', 523, 784, 0.05, 0.3, masterGain, now);      // C\u2192G \u4e0a\u6607
        this._playSynthSound('sine', 659, 988, 0.04, 0.35, masterGain, now + 0.1); // E\u2192B \u4e0a\u6607
        this._playSynthSound('triangle', 784, 1175, 0.03, 0.4, masterGain, now + 0.2); // G\u2192D \u4e0a\u6607
        break;

      // ========================================
      // \u30b9\u30da\u30eb\u4f7f\u7528 \u2014 \u9b54\u6cd5\u8a60\u5531\u98a8\u306e\u3046\u306d\u308a
      // ========================================
      case 'spell':
        this._playSynthSound('sine', 200, 600, 0.1, 0.4, masterGain, now);
        this._playSynthSound('triangle', 300, 900, 0.08, 0.45, masterGain, now);
        this._playSynthSound('sine', 150, 450, 0.06, 0.5, masterGain, now + 0.05);
        this._playSynthSound('square', 400, 1200, 0.03, 0.3, masterGain, now + 0.1);
        break;

      // ========================================
      // \u4e0d\u5c48\u767a\u52d5 \u2014 \u91d1\u5c5e\u8cea\u306e\u885d\u6483 + \u53cd\u97ff
      // ========================================
      case 'endure':
        this._playSynthSound('square', 300, 600, 0.02, 0.2, masterGain, now);
        this._playSynthSound('sine', 600, 1200, 0.03, 0.3, masterGain, now);
        this._playSynthSound('triangle', 450, 900, 0.04, 0.35, masterGain, now);
        this._playSynthSound('sine', 200, 400, 0.05, 0.5, masterGain, now + 0.1); // \u53cd\u97ff
        break;

      // ========================================
      // \u30c0\u30a4\u30ec\u30af\u30c8\u30a2\u30bf\u30c3\u30af \u2014 \u91cd\u4f4e\u97f3\u885d\u6483
      // ========================================
      case 'direct_attack':
        this._playSynthSound('sine', 60, 10, 0.01, 1.0, masterGain, now);
        this._playSynthSound('sawtooth', 150, 20, 0.02, 0.6, masterGain, now);
        this._playSynthSound('square', 250, 40, 0.03, 0.4, masterGain, now);
        this._playNoise(0.05, 0.4, masterGain, now, 400);
        this._playNoise(0.03, 0.3, masterGain, now + 0.15, 200);
        break;

      // ========================================
      // \u5171\u9cf4 \u2014 \u6ce2\u7d0b\u306e\u3088\u3046\u306a\u5e83\u304c\u308a
      // ========================================
      case 'resonance':
        this._playSynthSound('sine', 440, 880, 0.08, 0.5, masterGain, now);
        this._playSynthSound('sine', 554, 1108, 0.06, 0.45, masterGain, now + 0.08);
        this._playSynthSound('triangle', 660, 1320, 0.05, 0.4, masterGain, now + 0.16);
        break;

      default:
        // \u30c7\u30d5\u30a9\u30eb\u30c8\u306e\u30bf\u30c3\u30d7\u97f3
        this._playSynthSound('sine', 440, 0, 0.04, 0.08, masterGain, now);
    }
  }

  // \u6c4e\u7528\u7684\u306a\u30b7\u30f3\u30bb\u30b5\u30a4\u30b6\u30fc\u518d\u751f\u95a2\u6570
  _playSynthSound(type, freqStart, freqEnd, attackTime, decayTime, destination, startTime) {
    const osc = this.audioCtx.createOscillator();
    const env = this.audioCtx.createGain();
    
    osc.type = type;
    osc.connect(env);
    env.connect(destination);

    // \u30dc\u30ea\u30e5\u30fc\u30e0\u30a8\u30f3\u30d9\u30ed\u30fc\u30d7\uff08Attack -> Decay\uff09
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(1.0, startTime + attackTime);
    env.gain.exponentialRampToValueAtTime(0.01, startTime + attackTime + decayTime);

    // \u30d4\u30c3\u30c1\u3078\u306e\u30a8\u30f3\u30d9\u30ed\u30fc\u30d7\uff08\u4efb\u610f\uff09
    if(freqEnd > 0) {
        osc.frequency.setValueAtTime(freqStart, startTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), startTime + attackTime + decayTime);
    } else {
        osc.frequency.setValueAtTime(freqStart, startTime);
    }

    osc.start(startTime);
    osc.stop(startTime + attackTime + decayTime + 0.1);
  }

  // \u30ce\u30a4\u30ba\u751f\u6210\uff08\u7834\u7815\u97f3\u3001\u885d\u6483\u97f3\u306a\u3069\u306e\u30c6\u30af\u30b9\u30c1\u30e3\u7528\uff09
  _playNoise(attackTime, decayTime, destination, startTime, filterFreq) {
    const bufferSize = this.audioCtx.sampleRate * (attackTime + decayTime + 0.1);
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 2000;

    const env = this.audioCtx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.5, startTime + attackTime);
    env.gain.exponentialRampToValueAtTime(0.01, startTime + attackTime + decayTime);

    noise.connect(filter);
    filter.connect(env);
    env.connect(destination);

    noise.start(startTime);
    noise.stop(startTime + attackTime + decayTime + 0.1);
  }
}

window.audioManager = new SoundManager();
document.addEventListener('click', (e) => {
  // \u3059\u3067\u306b\u500b\u5225\u306e\u30cf\u30f3\u30c9\u30e9\u3067SE\u304c\u9cf4\u3089\u3055\u308c\u3066\u3044\u308b\u5834\u5408\u3084\u3001\u7279\u5b9a\u306e\u8981\u7d20\u306f\u7121\u8996\u3059\u308b
  const target = e.target.closest('button, .crystal-btn, .hand-card, .deck-item, .selectable');
  if (!target) return;
  
  // no-click-se\u30af\u30e9\u30b9\u304c\u3042\u308b\u5834\u5408\u306f\u30b9\u30ad\u30c3\u30d7
  if (target.classList.contains('no-click-se')) return;
  
  // \u30b7\u30fc\u30eb\u30c9\u30d6\u30ec\u30a4\u30af\u30e2\u30fc\u30c0\u30eb\u5185\u3067\u306e\u30af\u30ea\u30c3\u30af\u306f\u500b\u5225\u306b\u7ba1\u7406\u3059\u308b\u305f\u3081\u30b9\u30ad\u30c3\u30d7
  if (e.target.closest('#shield-break-overlay')) return;

  if (window.audioManager) {
    // \u9023\u7d9a\u30af\u30ea\u30c3\u30af\u306b\u3088\u308b\u7206\u97f3\u9632\u6b62\u306e\u305f\u3081\u3001\u5c11\u3057\u30c7\u30a3\u30ec\u30a4\u3092\u8a2d\u3051\u308b\u304b\u3001
    // \u76f4\u524d\u306eSE\u518d\u751f\u304b\u3089\u306e\u6642\u9593\u3092\u30c1\u30a7\u30c3\u30af\u3059\u308b\u3053\u3068\u3082\u53ef\u80fd\u3060\u304c\u3001
    // \u307e\u305a\u306f\u57fa\u672c\u7684\u306a\u30ac\u30fc\u30c9\u3092\u512a\u5148\u3002
    window.audioManager.playSE('click');
  }
});
