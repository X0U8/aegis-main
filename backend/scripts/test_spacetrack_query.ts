import http from 'http';
import https from 'https';
import { URL } from 'url';

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        const [key, value] = arg.slice(2).split('=');
        options[key] = value;
      } else {
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = 'true';
        }
      }
    }
  }
  return options;
}

function makePostRequest(urlStr: string, bodyData: string): Promise<{ statusCode: number; cookies: string[]; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyData)
      }
    }, (res) => {
      let body = '';
      const cookies = (res.headers['set-cookie'] || []) as string[];
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode || 200, cookies, body }));
    });
    req.on('error', reject);
    req.write(bodyData);
    req.end();
  });
}

function makeGetRequest(urlStr: string, cookies: string[]): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Aegis-Sovereign-SpaceTrack-Adapter/1.0'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode || 200, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const options = parseArgs();
  const username = options.user || options.username || process.env.SPACETRACK_USER;
  const password = options.pass || options.password || process.env.SPACETRACK_PASS;
  const noradId = options.norad || options.noradId || '25544';

  console.log(`\n========================================================================`);
  console.log(`  🛡️ US SPACE FORCE SPACE-TRACK.ORG GOLD STANDARD QUERY`);
  console.log(`  Target NORAD Cat ID: #${noradId}`);
  console.log(`========================================================================\n`);

  if (!username || !password) {
    console.error(`❌ ERROR: Missing Space-Track.org Credentials!`);
    console.error(`Usage: npm run spacetrack -- --user YOUR_USERNAME --pass YOUR_PASSWORD --norad ${noradId}\n`);
    process.exit(1);
  }

  try {
    console.log(`🔑 [1/2] Authenticating with Space-Track.org (ajaxauth/login)...`);
    const loginBody = `identity=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const loginRes = await makePostRequest('https://www.space-track.org/ajaxauth/login', loginBody);

    if (loginRes.statusCode !== 200 || loginRes.cookies.length === 0) {
      console.error(`❌ Authentication Failed! HTTP ${loginRes.statusCode}: Check username/password.`);
      process.exit(1);
    }

    console.log(`  ✔ Authenticated successfully! Received session cookie.`);

    console.log(`📡 [2/2] Querying US Space Force 18 SDS GP Telemetry for NORAD #${noradId}...`);
    const queryUrl = `https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/${noradId}/orderby/EPOCH%20desc/limit/1/format/json`;
    const queryRes = await makeGetRequest(queryUrl, loginRes.cookies);

    if (queryRes.statusCode === 200) {
      const data = JSON.parse(queryRes.body);
      if (Array.isArray(data) && data.length > 0) {
        const gp = data[0];
        console.log(`\n========================================================================`);
        console.log(`  ✅ SPACE-TRACK.ORG GP TELEMETRY RECEIVED FOR ${gp.OBJECT_NAME || 'NORAD ' + noradId}`);
        console.log(`========================================================================`);
        console.log(`  • OBJECT_NAME:              ${gp.OBJECT_NAME}`);
        console.log(`  • NORAD_CAT_ID:             ${gp.NORAD_CAT_ID}`);
        console.log(`  • OBJECT_ID:                ${gp.OBJECT_ID}`);
        console.log(`  • EPOCH:                    ${gp.EPOCH}`);
        console.log(`  • INCLINATION (deg):        ${gp.INCLINATION}`);
        console.log(`  • RA_OF_ASC_NODE (deg):     ${gp.RA_OF_ASC_NODE}`);
        console.log(`  • ECCENTRICITY:             ${gp.ECCENTRICITY}`);
        console.log(`  • ARG_OF_PERICENTER (deg):  ${gp.ARG_OF_PERICENTER}`);
        console.log(`  • MEAN_ANOMALY (deg):       ${gp.MEAN_ANOMALY}`);
        console.log(`  • MEAN_MOTION (rev/day):    ${gp.MEAN_MOTION}`);
        console.log(`  • BSTAR:                    ${gp.BSTAR}`);
        console.log(`  • CLASSIFICATION_TYPE:      ${gp.CLASSIFICATION_TYPE}`);
        console.log(`========================================================================\n`);
      } else {
        console.log(`⚠️ Query returned 0 records for NORAD #${noradId}. Raw response: ${queryRes.body}`);
      }
    } else {
      console.error(`❌ Query Failed! HTTP ${queryRes.statusCode}: ${queryRes.body}`);
    }
  } catch (err: any) {
    console.error(`❌ Request Error:`, err.message);
  }
}

main();
