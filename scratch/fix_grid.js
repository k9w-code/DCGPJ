const fs = require('fs');
let c = fs.readFileSync('public/css/style.css', 'utf8');

// Ensure board-half uses 1 column to stack rows
c = c.replace(/\.board-half \{/, '.board-half {\n  display: grid;\n  grid-template-columns: 1fr;');

// Fix opponent board stacking
c = c.replace(/#opponent-board\s*\{[\s\S]*?grid-template-areas:\s*\"back\"\s*\"front\";/, 
`#opponent-board {
  grid-template-areas: "back" "front";
  grid-template-columns: 1fr;
  grid-template-rows: repeat(2, 224px);`);

// Fix player board stacking
c = c.replace(/#player-board\s*\{[\s\S]*?grid-template-areas:\s*\"front\"\s*\"back\";/, 
`#player-board {
  grid-template-areas: "front" "back";
  grid-template-columns: 1fr;
  grid-template-rows: repeat(2, 224px);`);

fs.writeFileSync('public/css/style.css', c, 'utf8');
console.log('Grid layout fixed.');
