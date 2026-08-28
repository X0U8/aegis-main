import http from 'http';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function testSentinelServer() {
  console.log('--- Testing Aegis Public Sentinel Registry Server ---');


  const health = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/health',
    method: 'GET'
  });
  console.log('1. Health Check:', health);


  const lookupA = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/registry/lookup/58210',
    method: 'GET'
  });
  console.log('2. Lookup NORAD 58210 (Planet):', lookupA);


  const lookupB = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/registry/lookup/59102',
    method: 'GET'
  });
  console.log('3. Lookup NORAD 59102 (SpaceX):', lookupB);


  const alertResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/screener/trigger-risk',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      satA_noradId: 58210,
      satB_noradId: 59102,
      missDistanceMeters: 320
    }
  );
  console.log('4. Trigger Conjunction Risk Alert:', JSON.stringify(alertResponse, null, 2));

  console.log('\n--- Aegis Sentinel Public Registry Verification Complete! ---');
}

testSentinelServer().catch(console.error);
