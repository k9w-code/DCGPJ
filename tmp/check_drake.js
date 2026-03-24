const http = require('http');

http.get('http://localhost:3000/api/cards', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const cards = JSON.parse(data);
      const drake = cards.find(c => c.name.includes('ファイアドレイク'));
      console.log('--- Fire Drake Data ---');
      console.log(JSON.stringify(drake, null, 2));
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('Error fetching cards:', err.message);
});
