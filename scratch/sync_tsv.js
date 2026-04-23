const fs = require('fs');
const content = fs.readFileSync('c:/Users/imai/workspace/dcgpj/data/cards.csv', 'utf8');
const tsvContent = content.replace(/,/g, '\t');
fs.writeFileSync('c:/Users/imai/workspace/dcgpj/data/cards_updated.tsv', tsvContent);
console.log('TSV sync completed.');
