const fs = require('fs');
const path = require('path');

const tsvPath = path.join(__dirname, 'data', 'cards_updated.tsv');

try {
  const content = fs.readFileSync(tsvPath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split('\t');
  const records = lines.slice(1).map(line => {
    const values = line.split('\t');
    const record = {};
    headers.forEach((header, i) => {
      record[header] = values[i];
    });
    return record;
  });

  console.log(`Verified Records: ${records.length}`);
  console.log(`Headers Found: ${headers.join(', ')}`);

  // 属性別カウント
  const counts = {};
  records.forEach(r => {
    counts[r.color] = (counts[r.color] || 0) + 1;
  });

  console.log('--- Color Distribution ---');
  console.log(JSON.stringify(counts, null, 2));

  // 特定の重要カードの確認 (例: RE002の速攻付与)
  const scout = records.find(r => r.id === 'RE002');
  console.log('--- RE002 (Wilderness Scout) Check ---');
  console.log(`ID: ${scout.id}, Name: ${scout.name}, Keywords: ${scout.keywords}`);

  // エラーチェック
  if (records.length !== 150) {
    console.error('ERROR: Record count mismatch (Expected 150)');
  }
  if (headers.length !== 18) {
    console.error(`ERROR: Header count mismatch (Expected 18, got ${headers.length})`);
  }

} catch (err) {
  console.error('Verification failed:', err);
}
