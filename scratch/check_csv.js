const fs = require('fs');
const content = fs.readFileSync('c:/Users/imai/workspace/dcgpj/data/cards.csv', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  const quoteCount = (line.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    console.log(`Line ${index + 1} has odd number of quotes (${quoteCount}):`);
    console.log(line);
  }
});
