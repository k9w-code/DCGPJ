const fs = require('fs');
let c = fs.readFileSync('public/css/style.css', 'utf8');

const premiumSB = `
/* --- Premium Shield Break Modal --- */
.shield-break-modal {
  position: relative; display: flex; flex-direction: column;
  align-items: center; gap: 30px; max-width: 900px; width: 90%;
}
.sb-burst-ring {
  position: absolute; top: 50%; left: 50%;
  width: 200px; height: 200px; border-radius: 50%;
  border: 6px solid rgba(239, 68, 68, 0.7);
  animation: sb-burst-expand 1s ease-out forwards;
  pointer-events: none;
}
.sb-burst-ring-2 { animation-delay: 0.15s; border-color: rgba(255, 120, 50, 0.5); }
@keyframes sb-burst-expand { 0% { transform: scale(0) rotate(0deg); opacity: 0.8; } 100% { transform: scale(3) rotate(45deg); opacity: 0; } }

.sb-title {
  font-family: var(--font-fantasy); font-size: 80px; font-weight: 900;
  color: #ef4444; text-shadow: 0 0 40px rgba(239,68,68,0.9), 4px 4px 0 #7f1d1d;
  letter-spacing: 6px; animation: sb-title-in 0.6s cubic-bezier(0.17, 0.67, 0.35, 1.2) forwards;
}
@keyframes sb-title-in { 0% { opacity: 0; transform: scale(2) translateY(-30px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }

.sb-content {
  display: flex; gap: 50px; align-items: center;
  background: linear-gradient(135deg, rgba(60,10,10,0.9), rgba(20,5,5,0.95));
  border: 2px solid rgba(239,68,68,0.6); border-radius: 20px;
  padding: 30px 40px; box-shadow: 0 0 60px rgba(239,68,68,0.4);
  animation: sb-content-slide 0.5s 0.3s ease-out both;
}
@keyframes sb-content-slide { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }

.sb-card-wrapper { width: 180px; height: 252px; perspective: 800px; flex-shrink: 0; }
.sb-card-inner { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.sb-card-wrapper.flipped .sb-card-inner { transform: rotateY(180deg); }
.sb-card-front, .sb-card-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 12px; border: 3px solid #ef4444; }
.sb-card-back { background: linear-gradient(135deg, #450a0a, #991b1b); }
.sb-card-front { transform: rotateY(180deg); background-size: cover; background-position: center; }

.sb-info { display: flex; flex-direction: column; gap: 15px; }
.sb-card-name { font-family: var(--font-fantasy); font-size: 36px; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); }
.sb-trigger-row { display: flex; align-items: center; gap: 12px; }
.sb-trigger-badge { padding: 4px 10px; background: #ef4444; color: #fff; border-radius: 4px; font-weight: 900; font-size: 12px; }
.sb-trigger-effect { font-size: 20px; color: var(--gold); font-weight: 600; }
.sb-hint { margin-top: 20px; color: rgba(255,255,255,0.4); animation: blink 1.5s infinite; }
`;

// Replace old definitions
const startIndex = c.indexOf('.shield-break-modal {');
// Find end of last SB related class (heuristically)
let endIndex = c.indexOf('}', c.indexOf('.sb-info h2 {'));
if (endIndex === -1) endIndex = c.indexOf('}', c.indexOf('.sb-skill-desc {'));
if (endIndex === -1) endIndex = c.indexOf('}', c.indexOf('.sb-burst-effect {'));
if (endIndex === -1) endIndex = c.indexOf('}', c.indexOf('.sb-card {'));

if (startIndex !== -1 && endIndex !== -1) {
    c = c.substring(0, startIndex) + premiumSB + c.substring(endIndex + 1);
} else {
    c += premiumSB;
}

fs.writeFileSync('public/css/style.css', c, 'utf8');
console.log('Shield break premium styles updated.');
