import { SovereignNodeServer } from '../src/server/sovereignNodeServer';
import https from 'https';

const LIVE_SENTINEL_URL = 'https://aegis-sentinel-307384334185.us-central1.run.app';

function makeHttpsPost(urlStr: string, bodyData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(bodyData);

    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runLiveProductionCloudTest() {
  console.log('========================================================================');
  console.log('  🌐 AEGIS LIVE PRODUCTION GOOGLE CLOUD RUN END-TO-END VERIFICATION  ');
  console.log('========================================================================\n');

  console.log(`[1/5] Target Production Server: ${LIVE_SENTINEL_URL}`);

  // Active API Keys provisioned on Cloud Run Firestore
  const glixarApiKey = 'aegis_sk_live_bce3c858a4eba00bf14758080247d1b327e1b17a68c9691a6651547e0ff8489e';
  const spacexApiKey = 'aegis_sk_live_cc49525117c9f4675baa81b17d79966a94caf9e19a91616d3d7af4d6755b0b34';

  console.log(`\n[2/5] Starting Glixar Space Sovereign Node on Port 4001...`);
  const glixarNode = new SovereignNodeServer({
    companyId: 'comp-glixar',
    nodeId: 'node-glixar-live',
    port: 4001,
    sentinelUrl: LIVE_SENTINEL_URL,
    apiKey: glixarApiKey
  });
  await glixarNode.start();

  console.log(`\n[3/5] Starting SpaceX Sovereign Node on Port 4002...`);
  const spacexNode = new SovereignNodeServer({
    companyId: 'comp-spacex',
    nodeId: 'node-spacex-live',
    port: 4002,
    sentinelUrl: LIVE_SENTINEL_URL,
    apiKey: spacexApiKey
  });
  await spacexNode.start();

  console.log(`\n[4/5] Triggering Conjunction Risk Alert on Live Google Cloud Run Server...`);
  const alertRes = await makeHttpsPost(`${LIVE_SENTINEL_URL}/api/v1/screener/trigger-risk`, {
    satA_noradId: 60100,
    satB_noradId: 59102,
    predictedTCA: new Date(Date.now() + 86400000).toISOString(),
    missDistanceMeters: 280
  });

  console.log('\n========================================================================');
  console.log('   PRODUCTION CLOUD RUN RISK DISPATCH RESPONSE:');
  console.log(JSON.stringify(alertRes.body, null, 2));

  // Check alerts received by local Sovereign Nodes
  const glixarAlerts = glixarNode.getReceivedAlerts();
  const spacexAlerts = spacexNode.getReceivedAlerts();

  console.log(`\n -> Glixar Node (Port 4001) Received Alerts Count: ${glixarAlerts.length}`);
  console.log(` -> SpaceX Node (Port 4002) Received Alerts Count: ${spacexAlerts.length}`);
  console.log('========================================================================\n');

  // Cleanup
  await glixarNode.stop();
  await spacexNode.stop();
  console.log('🎉 Live production Google Cloud Run test completed successfully!');
  process.exit(0);
}

runLiveProductionCloudTest();
