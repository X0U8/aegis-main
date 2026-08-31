import { SovereignNodeServer } from '../src/server/sovereignNodeServer';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

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

function getSavedSession() {
  const sessionPath = path.join(process.cwd(), '.aegis-cli-session.json');
  if (fs.existsSync(sessionPath)) {
    try {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const options = parseArgs();
  const savedSession = getSavedSession();

  let companyId = options.company || options.c || process.env.COMPANY_ID || savedSession?.companyId || '';
  let portStr = options.port || options.p || process.env.NODE_PORT || '';
  let apiKey = options.key || options.k || process.env.AEGIS_API_KEY || savedSession?.apiKey || '';
  let nodeSecret = options.secret || options.password || process.env.NODE_SECRET || '';
  let noradIdStr = options.noradId || options.norad || process.env.NORAD_ID || '';


  for (const [k, v] of Object.entries(options)) {
    if (k.startsWith('aegis_sk_demo_') || k.startsWith('aegis_sk_live_')) {
      apiKey = k;
    } else if (typeof v === 'string' && (v.startsWith('aegis_sk_demo_') || v.startsWith('aegis_sk_live_'))) {
      apiKey = v;
    }
  }

  console.log(chalk.bold.cyan('\n[SOVEREIGN SERVER STARTUP]\n'));


  const prompts: any[] = [];
  if (!companyId) {
    prompts.push({
      type: 'input',
      name: 'companyId',
      message: 'Node Operator Company ID (4-20 chars):',
      validate: (input: string) => (input.trim().length >= 4 && input.trim().length <= 20) || 'Company ID must be between 4 and 20 characters.'
    });
  }
  if (!portStr) {
    prompts.push({
      type: 'input',
      name: 'port',
      message: 'Local Listening Port:',
      default: '4001',
      validate: (input: string) => (!isNaN(Number(input)) && Number(input) > 0) || 'Enter a valid numeric port.'
    });
  }
  if (!apiKey) {
    prompts.push({
      type: 'password',
      name: 'apiKey',
      message: 'Private Secret Key (aegis_sk_demo_...):',
      mask: '*',
      validate: (input: string) => input.trim().length > 10 || 'Private Secret Key is required.'
    });
  }
  if (!nodeSecret) {
    prompts.push({
      type: 'password',
      name: 'nodeSecret',
      message: 'Set Node Security Password:',
      mask: '*',
      validate: (input: string) => input.trim().length >= 4 || 'Password must be at least 4 characters.'
    });
  }

  if (prompts.length > 0 && process.stdin.isTTY) {
    const answers = await inquirer.prompt(prompts);
    if (answers.companyId) companyId = answers.companyId.trim();
    if (answers.port) portStr = answers.port.trim();
    if (answers.apiKey) apiKey = answers.apiKey.trim();
    if (answers.nodeSecret) nodeSecret = answers.nodeSecret.trim();
  }

  const port = Number(portStr || 4001);
  const sentinelUrl = options.sentinel || options.s || process.env.SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
  const nodeEndpointUrl = options.endpoint || options.e || process.env.NODE_ENDPOINT_URL || `http://localhost:${port}`;
  const nodeId = options.nodeId || (noradIdStr ? `node-${noradIdStr}` : `node-${companyId}-primary`);
  const noradId = noradIdStr ? Number(noradIdStr) : undefined;

  const nodeServer = new SovereignNodeServer({
    companyId,
    nodeId,
    noradId,
    port,
    sentinelUrl,
    apiKey,
    nodeSecret,
    nodeEndpointUrl
  });

  await nodeServer.start();
  console.log('\nPress [t] + Enter (or Enter) to view local telemetry status report.');
  console.log('Press [p] + Enter to manually ping & sync public telemetry.');
  console.log('Press Ctrl+C to stop.\n');

  if (process.stdin) {
    process.stdin.setEncoding('utf-8');
    process.stdin.resume();
    process.stdin.on('data', async (data) => {
      const input = data.toString().trim().toLowerCase();
      if (input === 'p' || input === 'ping' || input === 'sync') {
        await nodeServer.triggerManualFirestoreSync();
      } else if (input === 't' || input === 'status' || input === '') {
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
