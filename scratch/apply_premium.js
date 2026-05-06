const fs = require('fs');
let c = fs.readFileSync('public/css/style.css', 'utf8');

// 既存の文字化けをもう一度除去
c = c.replace(/[^\x00-\x7F]/g, ' ');

const premium = `
/* --- PREMIUM VISUALS --- */
.unit-shake { animation: unit-shake 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
@keyframes unit-shake {
  0% { transform: translate(0, 0); }
  20% { transform: translate(-4px, 2px) rotate(-1deg); }
  40% { transform: translate(4px, -2px) rotate(1deg); }
  60% { transform: translate(-3px, 1px) rotate(-0.5deg); }
  80% { transform: translate(3px, -1px) rotate(0.5deg); }
  100% { transform: translate(0, 0); }
}

.screen-shake { animation: screen-shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes screen-shake {
  0% { margin: 0; }
  10% { margin: -4px -4px; }
  20% { margin: 4px 2px; }
  30% { margin: -4px 4px; }
  40% { margin: 4px -2px; }
  50% { margin: -2px 2px; }
  60% { margin: 2px -4px; }
  70% { margin: -2px -2px; }
  80% { margin: 4px 4px; }
  90% { margin: -4px 2px; }
  100% { margin: 0; }
}

@keyframes arrow-flow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
#attack-arrow-line { animation: arrow-flow 0.5s linear infinite; }

.ability-trigger-label {
  position: absolute; transform: translateX(-50%);
  padding: 4px 15px; background: rgba(0, 0, 0, 0.8);
  border: 1px solid var(--gold); border-radius: 4px;
  color: #fff; font-weight: bold; font-size: 18px;
  text-shadow: 0 0 8px var(--gold); white-space: nowrap;
  animation: ability-trigger-pop 1.8s ease-out forwards; z-index: 17000;
}
@keyframes ability-trigger-pop {
  0% { opacity: 0; transform: translate(-50%, 20px) scale(0.5); }
  20% { opacity: 1; transform: translate(-50%, -10px) scale(1.1); }
  80% { opacity: 1; transform: translate(-50%, -15px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -40px) scale(0.9); }
}

.card-badges { position: absolute; top: 5px; right: 5px; display: flex; flex-direction: column; gap: 4px; z-index: 20; }
.badge { width: 24px; height: 24px; background: rgba(0, 0, 0, 0.7); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.5); animation: badge-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
@keyframes badge-pop { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.badge-barrier { border-color: #fbbf24; box-shadow: 0 0 10px rgba(251, 191, 36, 0.6); }
.badge-endure { border-color: #22c55e; box-shadow: 0 0 10px rgba(34, 197, 94, 0.6); }
.badge-stealth { opacity: 0.8; filter: grayscale(0.5); }
.badge-frozen { border-color: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6); }
.badge-decay { border-color: #a855f7; box-shadow: 0 0 10px rgba(168, 85, 247, 0.6); }

.unit-card.has-barrier { box-shadow: 0 0 15px 5px rgba(251, 191, 36, 0.4); }
.unit-card.is-stealth { opacity: 0.6; filter: saturate(0.5) contrast(0.8) brightness(1.2); }

/* --- Fixed Turn Splash --- */
.turn-splash {
  position: fixed; inset: 0;
  display: none !important; align-items: center; justify-content: center;
  flex-direction: column; gap: 20px; z-index: 100000;
  pointer-events: none; background: rgba(0,0,0,0.2);
  backdrop-filter: blur(2px);
}
.turn-splash.splash-fade-in { display: flex !important; animation: splash-fade-in 0.5s ease-out forwards; }
.turn-splash.splash-fade-out { display: flex !important; animation: splash-fade-out 0.5s ease-in forwards; }
@keyframes splash-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes splash-fade-out { from { opacity: 1; } to { opacity: 0; } }

.splash-content {
  font-family: var(--font-fantasy); font-size: 80px; font-weight: 900;
  color: #fff; text-shadow: 0 0 30px var(--gold), 0 4px 10px #000;
  letter-spacing: 10px; animation: splash-pop 0.6s cubic-bezier(0.17, 0.67, 0.35, 1.2) both;
}
@keyframes splash-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.turn-splash-victory .splash-content { color: #fde68a; text-shadow: 0 0 40px #f59e0b; }
.turn-splash-enemy .splash-content { color: #fca5a5; text-shadow: 0 0 40px #ef4444; }

.splash-sub { font-size: 24px; color: rgba(255,255,255,0.8); letter-spacing: 4px; text-transform: uppercase; }

/* Resonance / Shield Hit Labels */
.resonance-label { position: absolute; transform: translateX(-50%); font-family: var(--font-fantasy); font-size: 28px; font-weight: 900; color: #a78bfa; text-shadow: 0 0 15px rgba(167,139,250,0.9); pointer-events: none; white-space: nowrap; animation: resonance-label-float 2s ease-out forwards; z-index: 16000; }
@keyframes resonance-label-float { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.8); } 100% { opacity: 0; transform: translate(-50%, -55px) scale(0.9); } }

.shield-hit-label { position: absolute; transform: translateX(-50%); font-family: var(--font-fantasy); font-size: 26px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.9); pointer-events: none; white-space: nowrap; animation: shield-hit-float 1.4s ease-out forwards; z-index: 16000; }
.shield-break-label { color: #ef4444; font-size: 30px; text-shadow: 0 0 20px rgba(239,68,68,0.9); }
@keyframes shield-hit-float { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.7); } 100% { opacity: 0; transform: translate(-50%, -60px) scale(0.9); } }

.endure-label { position: absolute; transform: translateX(-50%); font-family: var(--font-fantasy); font-size: 32px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 15px rgba(251,191,36,1); pointer-events: none; white-space: nowrap; animation: endure-pop 1.5s cubic-bezier(0.17, 0.67, 0.3, 1.2) forwards; z-index: 17000; }
@keyframes endure-pop { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); } 100% { opacity: 0; transform: translate(-50%, -70px) scale(0.8); } }
`;

fs.writeFileSync('public/css/style.css', c + premium, 'utf8');
console.log('Premium styles applied successfully.');
