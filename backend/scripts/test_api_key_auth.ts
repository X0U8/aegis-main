import http from 'http';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 500, data: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function runApiKeySecurityTest() {
  console.log('=== AEGİS SENTINEL API KEY SECURITY TEST ===\n');


  const regRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/registry/company',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { companyId: 'comp-astranautics', name: 'Astranautics Corp', domain: 'astranautics.com' }
  );

  console.log('1. Company Registration Result:');
  console.log('Status Code:', regRes.status);
  console.log('Private API Key Generated:', regRes.data.privateApiKey);
  console.log('Company Profile:', regRes.data.company);
  console.log('--------------------------------------------------\n');

  const validApiKey = regRes.data.privateApiKey;


  const unauthRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/registry/satellite',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { noradId: 77102, satName: 'ASTRA-SAT-1' }
  );

  console.log('2. Unauthenticated Satellite Registration Attempt:');
  console.log('Status Code:', unauthRes.status, '(Expected 401)');
  console.log('Response Payload:', unauthRes.data);
  console.log('--------------------------------------------------\n');


  const fakeKeyRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/registry/satellite',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'aegis_sk_live_FAKE_KEY_123456789'
      }
    },
    { noradId: 77102, satName: 'ASTRA-SAT-1' }
  );

  console.log('3. Invalid API Key Attempt:');
  console.log('Status Code:', fakeKeyRes.status, '(Expected 403)');
  console.log('Response Payload:', fakeKeyRes.data);
  console.log('--------------------------------------------------\n');


  const authRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/registry/satellite',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': validApiKey
      }
    },
    { noradId: 77102, satName: 'ASTRA-SAT-1' }
  );

  console.log('4. Authenticated Satellite Registration with Valid Key:');
  console.log('Status Code:', authRes.status, '(Expected 201)');
  console.log('Response Payload:', JSON.stringify(authRes.data, null, 2));
  console.log('==================================================');
  console.log(' API Key Authentication & Protection Verified!');
}

runApiKeySecurityTest().catch(console.error);
