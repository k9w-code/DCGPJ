const https = require('https');
const { parse } = require('csv-parse/sync');

const CARDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=0';

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return https.get(res.headers.location, handleResponse).on('error', reject);
      }
      handleResponse(res);
      function handleResponse(response) {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = parse(data, { columns: true, skip_empty_lines: true, trim: true });
            resolve(parsed);
          } catch(e) { reject(e); }
        });
      }
    }).on('error', reject);
  });
}

fetchCSV(CARDS_URL).then(cards => {
  const drake = cards.find(c => c.id === 'R003' || c.name === 'ファイアドレイク');
  console.log('--- Fire Drake Data ---');
  console.log(JSON.stringify(drake, null, 2));
  console.log('--- All Headers ---');
  if (cards.length > 0) console.log(Object.keys(cards[0]));
}).catch(console.error);
