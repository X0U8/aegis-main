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
  const sentinelUrl = options.sentinel || options.s || process.env.SENTINEL_URL || 'https://aegis-sentinel-307384334185.us-central1.run.app';
  const apiKey = options.key || options.k || process.env.AEGIS_API_KEY || '';
  const nodeEndpointUrl = options.endpoint || options.e || process.env.NODE_ENDPOINT_URL || `http://localhost:${port}`;

  const nodeId = options.nodeId || `node-${companyId}-primary`;

  console.log('========================================================================');
  console.log(`  🚀 LAUNCHING AEGIS SOVEREIGN NODE FOR OPERATOR: ${companyId.toUpperCase()}  `);
  console.log('========================================================================\n');

  if (!apiKey) {
    console.warn('⚠️ WARNING: No API Secret Key provided (--key=aegis_sk_live_...). Sentinel auto-registration may fail if key is missing.');
  }

  const nodeServer = new SovereignNodeServer({
    companyId,
    nodeId,
    port,
    sentinelUrl,
    apiKey,
    nodeEndpointUrl
  });

  await nodeServer.start();

  console.log('\n========================================================================');
  console.log(` ✅ Sovereign Node for [${companyId}] is live on port ${port}`);
  console.log(` 🌐 Published Endpoint URL: ${nodeEndpointUrl}`);
  console.log(` 📡 Connected Sentinel Registry: ${sentinelUrl}`);
  console.log(' Press Ctrl + C to stop the node server.');
  console.log('========================================================================\n');

  process.on('SIGINT', async () => {
    console.log('\n[STOPPING NODE] Shutting down Sovereign Node gracefully...');
    await nodeServer.stop();
    process.exit(0);
  });
}

main().catch(console.error);
