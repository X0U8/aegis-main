import https from 'https';

function fetchTopCelesTrakRisks() {
  const url = 'https://celestrak.org/SOCRATES/table-socrates.php?NAME=,&ORDER=MINRANGE&MAX=10';
  
  https.get(url, (res) => {
    let html = '';
    res.on('data', (chunk) => (html += chunk));
    res.on('end', () => {
      const regex = /<td[^>]*>([0-9]{5})<\/td>\s*<td[^>]*>(.*?)<\/td>/g;
      const matches = [...html.matchAll(regex)];

      console.log('===============================================================');
      console.log('   TOP LIVE CELESTRAK ORBITAL COLLISION RISKS IN SPACE RIGHT NOW   ');
      console.log('===============================================================\n');

      matches.slice(0, 10).forEach((m, index) => {
        const noradId = m[1];
        const satName = m[2].replace(/<[^>]+>/g, '').trim();
        console.log(`[${index + 1}] NORAD ID: ${noradId} | Satellite: ${satName}`);
      });

      console.log('\n===============================================================');
      console.log('  Data source: Live CelesTrak SOCRATES Plus Supercomputer Feed ');
      console.log('===============================================================');
    });
  }).on('error', (err) => {
    console.error('Failed to fetch CelesTrak data:', err.message);
  });
}

fetchTopCelesTrakRisks();
