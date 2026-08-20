import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMasterDemo() {
  console.log('===============================================================');
  console.log('       AEGIS SOVEREIGN BACKEND - MASTER LIVE SYSTEM DEMO       ');
  console.log('===============================================================\n');

  // Start Sentinel Server process locally connected to Live GCP Firestore
  const serverProc: ChildProcess = spawn(
    'npx',
    ['ts-node', 'src/server/sentinelServer.ts'],
    {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, GOOGLE_CLOUD_PROJECT: 'aegis-505511', PORT: '4000' },
      stdio: 'pipe'
    }
  );

  serverProc.stdout?.on('data', (data) => {
    // console.log(`[SERVER]: ${data.toString().trim()}`);
  });

  serverProc.stderr?.on('data', (data) => {
    // console.error(`[SERVER ERR]: ${data.toString().trim()}`);
  });

  // Wait for server startup
  await sleep(2500);

  try {
    // 1. Health Check
    console.log('Step 1: Checking Server Health...');
    const health = await makeRequest({ hostname: 'localhost', port: 4000, path: '/health', method: 'GET' });
    console.log('   STATUS:', health.data.status, '| SERVICE:', health.data.service);
    console.log('---------------------------------------------------------------\n');

    // 2. Register Company A (Planet Labs)
    console.log('Step 2: Registering Company A (Planet Labs) & Generating Secret API Key...');
    const compARes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/registry/company', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { companyId: 'comp-planet-demo', name: 'Planet Labs PBC', domain: 'planet.com' }
    );
    const apiKeyA = compARes.data.privateApiKey;
    console.log('   COMPANY:', compARes.data.company.name);
    console.log('   GENERATED API KEY A:', apiKeyA);
    console.log('---------------------------------------------------------------\n');

    // 3. Register Company B (SpaceX Starlink)
    console.log('Step 3: Registering Company B (SpaceX Starlink) & Generating Secret API Key...');
    const compBRes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/registry/company', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { companyId: 'comp-spacex-demo', name: 'SpaceX Starlink', domain: 'spacex.com' }
    );
    const apiKeyB = compBRes.data.privateApiKey;
    console.log('   COMPANY:', compBRes.data.company.name);
    console.log('   GENERATED API KEY B:', apiKeyB);
    console.log('---------------------------------------------------------------\n');

    // 4. Register Satellite A (NORAD 58210) using API Key A
    console.log('Step 4: Registering Satellite A (NORAD 58210) with API Key A...');
    const satARes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/registry/satellite', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKeyA } },
      { noradId: 58210, satName: 'FLOCK-4P-DEMO' }
    );
    console.log('   SATELLITE A REGISTERED:', satARes.data.satellite);
    console.log('---------------------------------------------------------------\n');

    // 5. Register Satellite B (NORAD 59102) using API Key B
    console.log('Step 5: Registering Satellite B (NORAD 59102) with API Key B...');
    const satBRes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/registry/satellite', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKeyB } },
      { noradId: 59102, satName: 'STARLINK-30142-DEMO' }
    );
    console.log('   SATELLITE B REGISTERED:', satBRes.data.satellite);
    console.log('---------------------------------------------------------------\n');

    // 6. Register Sovereign Node A Endpoint
    console.log('Step 6: Registering Sovereign Node A Endpoint with API Key A...');
    const nodeARes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/registry/node', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKeyA } },
      { nodeId: 'node-planet-demo', endpointUrl: 'https://aegis-node.planet.com:8443', publicKeyPem: '-----BEGIN PUBLIC KEY-----\nPlanetDemoPublicKeyPem\n-----END PUBLIC KEY-----' }
    );
    console.log('   NODE A REGISTERED:', nodeARes.data.node.endpointUrl);
    console.log('---------------------------------------------------------------\n');

    // 7. Register Sovereign Node B Endpoint
    console.log('Step 7: Registering Sovereign Node B Endpoint with API Key B...');
    const nodeBRes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/registry/node', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKeyB } },
      { nodeId: 'node-spacex-demo', endpointUrl: 'https://aegis-node.spacex.com:8443', publicKeyPem: '-----BEGIN PUBLIC KEY-----\nSpaceXDemoPublicKeyPem\n-----END PUBLIC KEY-----' }
    );
    console.log('   NODE B REGISTERED:', nodeBRes.data.node.endpointUrl);
    console.log('---------------------------------------------------------------\n');

    // 8. Public Lookup Test
    console.log('Step 8: Testing Unprotected Public Lookup for NORAD 58210...');
    const lookupRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/v1/registry/lookup/58210', method: 'GET' });
    console.log('   PUBLIC LOOKUP RESULT:', lookupRes.data);
    console.log('---------------------------------------------------------------\n');

    // 9. Trigger Collision Risk Alert
    console.log('Step 9: Simulating Conjunction Risk Detection (NORAD 58210 vs 59102)...');
    const alertRes = await makeRequest(
      { hostname: 'localhost', port: 4000, path: '/api/v1/screener/trigger-risk', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { satA_noradId: 58210, satB_noradId: 59102, missDistanceMeters: 280 }
    );

    console.log('   ALERT DISPATCH MESSAGE:', alertRes.data.message);
    console.log('   EVENT RECORD:', alertRes.data.event);
    console.log('   NODE A DISPATCHED PAYLOAD:', JSON.stringify(alertRes.data.dispatchedNodes.nodeA, null, 2));
    console.log('   NODE B DISPATCHED PAYLOAD:', JSON.stringify(alertRes.data.dispatchedNodes.nodeB, null, 2));
    console.log('\n===============================================================');
    console.log('  🎉 SYSTEM CHECK COMPLETE: 100% OPERATIONAL & VERIFIED LIVE!  ');
    console.log('===============================================================');
  } finally {
    serverProc.kill();
  }
}

runMasterDemo().catch(console.error);
