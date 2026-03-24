// audio-manager.js
// BGMおよび合成による仮SEを管理・再生するためのクラス

class SoundManager {
  constructor() {
    this.bgmAudio = new Audio();
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.3; // デフォルトBGM音量
    
    // Web Audio APIによる合成音用
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContext();

    this.seVolume = 0.3; // デフォルトSE音量
    
    // 将来的に入れ替えるBGMファイルのパス（今は仮置き）
    this.files = {
      bgm: {
        lobby: '/assets/bgm/lobby.mp3',
        deck: '/assets/bgm/deck.mp3',
        game: '/assets/bgm/battle.mp3',
        victory: '/assets/bgm/victory.mp3',
        defeat: '/assets/bgm/defeat.mp3'
      }
    };
  }

  // --- BGM関連 ---
  playBGM(key) {
    if (!this.files.bgm[key]) return;
    if (this.bgmAudio.src.endsWith(this.files.bgm[key])) return;
    
    this.bgmAudio.src = this.files.bgm[key];
    this.bgmAudio.play().catch(e => {
      console.warn('BGM自動再生ブロック。ユーザー操作を待ちます。', e);
      const playOnAction = () => {
        this.bgmAudio.play().catch(() => {});
        document.removeEventListener('click', playOnAction);
      };
      document.addEventListener('click', playOnAction);
    });
  }

  stopBGM() {
    this.bgmAudio.pause();
    this.bgmAudio.currentTime = 0;
  }

  // --- SE関連 (Web Audio API 合成音) ---
  
  // 内部でオシレーターを鳴らす便利関数
  _playSynth(type, freqs, duration, volScale = 1.0) {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = type;
    const now = this.audioCtx.currentTime;
    
    // 周波数エンベロープ
    osc.frequency.setValueAtTime(freqs[0], now);
    if (freqs.length > 1) {
      osc.frequency.exponentialRampToValueAtTime(freqs[1], now + duration);
    }

    // 音量エンベロープ（アタック0, ディケイ〜リリース）
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.seVolume * volScale, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  // 外部から呼ぶSEの種類名（例: 'click', 'attack' など）
  playSE(type) {
    switch (type) {
      case 'click':
        // 短いポッという音
        this._playSynth('sine', [800, 600], 0.1, 0.4);
        break;
      case 'playCard':
        // しゅっというカードを置く音
        this._playSynth('triangle', [300, 150], 0.15, 0.5);
        break;
      case 'attack':
        // ザシュッという攻撃の鋭い音
        this._playSynth('sawtooth', [400, 100], 0.2, 0.7);
        break;
      case 'damage':
        // ドスッという低いダメージ音
        this._playSynth('square', [150, 50], 0.3, 0.8);
        break;
      case 'levelUp':
        // ピロリンというレベルアップ音（連続で鳴らす）
        this._playSynth('sine', [500, 800], 0.2, 0.6);
        setTimeout(() => this._playSynth('sine', [800, 1200], 0.4, 0.6), 100);
        break;
      case 'shieldBreak':
        // パリーンという高い衝撃音
        this._playSynth('square', [1200, 400], 0.3, 0.8);
        setTimeout(() => this._playSynth('sawtooth', [1000, 200], 0.2, 0.6), 50);
        break;
      case 'error':
        // ブブーというエラー音
        this._playSynth('sawtooth', [100, 100], 0.3, 0.5);
        break;
      default:
        // 基本のクリック音
        this._playSynth('sine', [600, 400], 0.1, 0.4);
        break;
    }
  }
}

// グローバルにインスタンスを公開
if (typeof window !== 'undefined') {
  window.audioManager = new SoundManager();
  
  // UI上の汎用クリックSEの自動バインド
  document.addEventListener('click', (e) => {
    // 汎用的なボタン、タブ、カード要素をクリックしたときに自動で鳴らす
    if (e.target.closest('.btn') || e.target.closest('.tab') || e.target.closest('.mode-card') || e.target.closest('.tribe-raise-btn')) {
      window.audioManager.playSE('click');
    }
  });
}
