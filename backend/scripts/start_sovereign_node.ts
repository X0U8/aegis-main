import { SovereignNodeServer } from '../src/server/sovereignNodeServer';

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      options[key] = value;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  // Any company can pass their own parameters via CLI flags or Environment Variables
  const companyId = options.company || options.c || process.env.COMPANY_ID || 'comp-glixar';
  const port = Number(options.port || options.p || process.env.NODE_PORT || 4001);
  const sentinelUrl = options.sentinel || options.s || process.env.SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
  let apiKey = options.key || options.k || process.env.AEGIS_API_KEY || '';

  // Auto-detect standalone --aegis_sk_demo_... or --aegis_sk_live_... flag key or value
  for (const [k, v] of Object.entries(options)) {
    if (k.startsWith('aegis_sk_demo_') || k.startsWith('aegis_sk_live_')) {
      apiKey = k;
    } else if (typeof v === 'string' && (v.startsWith('aegis_sk_demo_') || v.startsWith('aegis_sk_live_'))) {
      apiKey = v;
    }
  }
  const nodeSecret = options.secret || options.password || process.env.NODE_SECRET || apiKey;
  const nodeEndpointUrl = options.endpoint || options.e || process.env.NODE_ENDPOINT_URL || `http://localhost:${port}`;

  const nodeId = options.nodeId || `node-${companyId}-primary`;

  const nodeServer = new SovereignNodeServer({
    companyId,
    nodeId,
    port,
    sentinelUrl,
    apiKey,
    nodeSecret,
    nodeEndpointUrl
  });

  await nodeServer.start();
  console.log('Press [t] + Enter (or Enter) to view local telemetry status report.');
  console.log('Press Ctrl+C to stop.\n');

  if (process.stdin.isTTY) {
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (data) => {
      const input = data.toString().trim().toLowerCase();
      if (input === 't' || input === 'status' || input === '') {
        nodeServer.printLocalTelemetryReport();
      }
    });
  }

  process.on('SIGINT', async () => {
    await nodeServer.stop();
    process.exit(0);
  });
}

main().catch(console.error);
