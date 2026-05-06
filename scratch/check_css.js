const fs = require('fs');
const content = fs.readFileSync('public/css/style.css', 'utf8');
let open = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
  const o = (line.match(/\{/g) || []).length;
  const c = (line.match(/\}/g) || []).length;
  open += o - c;
  if (open < 0) {
    console.log(`Unbalanced at line ${i + 1}: ${line}`);
    open = 0;
  }
});
console.log('Final open count:', open);
