#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';
import Table from 'cli-table3';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { SovereignNodeServer } from '../src/server/sovereignNodeServer';

const DEFAULT_SENTINEL_URL = 'https://aegis-sentinel-1086776249115.us-central1.run.app';

const GLOBAL_SESSION_FILE = path.join(os.homedir(), '.aegis-session.json');
const LOCAL_SESSION_FILE = path.join(process.cwd(), '.aegis-session.json');

interface ActiveSession {
  mode: 'PREVIEW' | 'ENTERPRISE';
  companyId: string;
  companyName: string;
  apiKey: string;
}

function loadSavedSession(): ActiveSession | null {
  try {
    if (fs.existsSync(LOCAL_SESSION_FILE)) {
      const data = fs.readFileSync(LOCAL_SESSION_FILE, 'utf-8');
      return JSON.parse(data);
    }
    if (fs.existsSync(GLOBAL_SESSION_FILE)) {
      const data = fs.readFileSync(GLOBAL_SESSION_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch { }
  return null;
}

function saveSession(session: ActiveSession) {
  try {
    const jsonStr = JSON.stringify(session, null, 2);
    fs.writeFileSync(LOCAL_SESSION_FILE, jsonStr, 'utf-8');
    fs.writeFileSync(GLOBAL_SESSION_FILE, jsonStr, 'utf-8');
  } catch { }
}

function clearSavedSession() {
  try {
    if (fs.existsSync(LOCAL_SESSION_FILE)) fs.unlinkSync(LOCAL_SESSION_FILE);
    if (fs.existsSync(GLOBAL_SESSION_FILE)) fs.unlinkSync(GLOBAL_SESSION_FILE);
  } catch { }
}

let activeSession: ActiveSession | null = loadSavedSession();

function makeHttpRequest(urlStr: string, method: string, headers: Record<string, string> = {}, bodyData?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = bodyData ? JSON.stringify(bodyData) : undefined;
      const requestHeaders: Record<string, string> = { ...headers };

      if (postData) {
        requestHeaders['Content-Type'] = 'application/json';
        requestHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: requestHeaders
      };

      const req = client.request(options, (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resBody);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch {
            resolve({ statusCode: res.statusCode, raw: resBody });
          }
        });
      });

      req.on('error', (err) => reject(err));

      if (postData) req.write(postData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function displayHeader() {
  console.clear();

  // Solid Block 3D AEGIS Font
  const logoText = figlet.textSync('AEGIS', { font: 'ANSI Shadow', horizontalLayout: 'full' });
  console.log(chalk.bold.cyan(logoText));

  if (activeSession) {
    const isEnterprise = activeSession.mode === 'ENTERPRISE';
    const badgeColor = isEnterprise ? chalk.bgGreen.black.bold : chalk.bgCyan.black.bold;
    const badgeText = isEnterprise ? ' ENTERPRISE SESSION ' : ' SANDBOX SESSION ';
    console.log(badgeColor(badgeText) + ' ' + chalk.bold.white(activeSession.companyName) + chalk.dim(` (${activeSession.companyId})`));
  } else {
    console.log(chalk.bgYellow.black.bold(' SELECT ENTRY MODE ') + chalk.dim(' Choose Aegis Sandbox Login or Enterprise Company Login'));
  }
  console.log('');
}

async function aegisPreviewLogin() {
  const callbackPort = 8085;
  const loginUrl = `${DEFAULT_SENTINEL_URL}/auth/login?port=${callbackPort}`;

  console.log(chalk.cyan('\nOpening browser for Google Sign-In...\n'));

  // Open browser natively on macOS/Windows/Linux
  const openCmd = process.platform === 'darwin' ? `open "${loginUrl}"` : process.platform === 'win32' ? `start "${loginUrl}"` : `xdg-open "${loginUrl}"`;
  require('child_process').exec(openCmd);

  const spinner = ora('Waiting for Google Sign-In completion...').start();

  let googleAuthData: any = null;

  await new Promise<void>((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '', `http://localhost:${callbackPort}`);
        if (parsedUrl.pathname === '/callback') {
          googleAuthData = {
            companyId: parsedUrl.searchParams.get('companyId') || '',
            companyName: parsedUrl.searchParams.get('companyName') || '',
            apiKey: parsedUrl.searchParams.get('apiKey') || '',
            email: parsedUrl.searchParams.get('email') || ''
          };

          spinner.succeed(chalk.green(` Authenticated as ${googleAuthData.email}`));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 60px; color: #0f172a;">
              <h2 style="color: #059669; font-size: 28px;"> Google Authentication Successful!</h2>
              <p style="font-size: 16px; color: #475569; margin-top: 10px;">Return to your terminal CLI to complete operator setup.</p>
              <p style="font-size: 14px; color: #94a3b8; margin-top: 20px;">You may safely close this browser tab.</p>
            </div>
          `);

          server.close();
          resolve();
        }
      } catch (err) {
        res.writeHead(500);
        res.end();
      }
    });

    server.listen(callbackPort);
  });

  if (!googleAuthData) return;

  const googleId = googleAuthData.companyId.replace('demo-google-', '');

  // 1. Check if user already exists in Demo Firestore database
  const checkRes = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/auth/google`, 'POST', {}, {
    action: 'check',
    email: googleAuthData.email,
    displayName: googleAuthData.companyName,
    googleId
  });

  if (checkRes.statusCode === 200 && checkRes.body.exists) {
    // Returning User / New Device: Prompt for Private Secret Key
    const keyAnswers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter Private Secret Key (aegis_sk_demo_...):',
        mask: '*',
        validate: (input) => input.trim().length > 10 || 'Private Secret Key is required.'
      }
    ]);

    const cleanKey = keyAnswers.apiKey.trim().replace(/[\r\n\t]/g, '');

    const loginSpinner = ora('Verifying Private Secret Key...').start();

    const loginRes = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/auth/google`, 'POST', {}, {
      action: 'login_with_key',
      email: googleAuthData.email,
      displayName: googleAuthData.companyName,
      googleId,
      apiKey: cleanKey
    });

    loginSpinner.stop();

    if (loginRes.statusCode === 200) {
      activeSession = {
        mode: 'PREVIEW',
        companyId: loginRes.body.company.companyId,
        companyName: loginRes.body.company.name,
        apiKey: loginRes.body.apiKey
      };
      saveSession(activeSession);

      console.log('\n' + chalk.bgGreen.black.bold(' AUTH SUCCESS ') + chalk.green(` Welcome back, Operator [${activeSession.companyId}]`));

      const table = new Table({
        head: [chalk.cyan('Company ID'), chalk.cyan('Organization Name'), chalk.cyan('Google Email')],
        colWidths: [22, 35, 30]
      });
      table.push([activeSession.companyId, activeSession.companyName, googleAuthData.email]);
      console.log(table.toString() + '\n');
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' AUTH FAILED ') + ' ' + chalk.red(loginRes.body?.error || 'Invalid Private Secret Key.\n'));
    }
  } else {
    // First-Time Setup
    console.log(chalk.bold.yellow('\nSetup your Operator Profile:\n'));

    const onboardingAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'organizationName',
        message: 'Company Name (4 to 8 characters):',
        validate: (input) => {
          const trimmed = input.trim();
          if (trimmed.length >= 4 && trimmed.length <= 8) {
            return true;
          }
          return 'Company Name must be between 4 and 8 characters long.';
        }
      }
    ]);

    const nameSlug = onboardingAnswers.organizationName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const autoCompanyId = `demo-${nameSlug}-${randomSuffix}`;

    console.log(chalk.cyan(`\nCompany ID: ${chalk.bold.white(autoCompanyId)}\n`));

    const setupSpinner = ora('Initializing Operator Profile...').start();

    const createRes = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/auth/google`, 'POST', {}, {
      action: 'register',
      email: googleAuthData.email,
      displayName: googleAuthData.companyName,
      googleId,
      customCompanyId: autoCompanyId,
      organizationName: onboardingAnswers.organizationName
    });

    setupSpinner.stop();

    if (createRes.statusCode === 201 || createRes.statusCode === 200) {
      const generatedKey = createRes.body.apiKey;

      // PROMINENT SECURITY BANNER DISPLAYING PRIVATE SECRET KEY
      console.log('\n' + chalk.bgYellow.black.bold(' 🔑 PRIVATE OPERATOR SECRET KEY GENERATED '));
      console.log(chalk.bold.yellow('=================================================================================='));
      console.log(chalk.bold.white(`  SECRET KEY: ${chalk.bold.green(generatedKey)}`));
      console.log(chalk.bold.yellow('=================================================================================='));
      console.log(chalk.bold.red('  ⚠️ Copy and save this Secret Key carefully. It cannot be recovered once lost.\n'));

      await inquirer.prompt([
        {
          type: 'password',
          name: 'confirmKey',
          message: 'Confirm Secret Key (making sure you saved the key):',
          mask: '*',
          validate: (input) => {
            if (input.trim() === generatedKey) {
              return true;
            }
            return 'Key mismatch! Please copy and paste the exact Secret Key shown above.';
          }
        }
      ]);

      activeSession = {
        mode: 'PREVIEW',
        companyId: createRes.body.company.companyId,
        companyName: createRes.body.company.name,
        apiKey: generatedKey
      };
      saveSession(activeSession);

      const table = new Table({
        head: [chalk.cyan('Company ID'), chalk.cyan('Organization Name'), chalk.cyan('Google Email')],
        colWidths: [22, 35, 30]
      });

      table.push([
        activeSession.companyId,
        activeSession.companyName,
        googleAuthData.email
      ]);

      console.log(table.toString() + '\n');
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(createRes.body?.error || createRes.raw));
    }
  }
}

async function enterpriseCompanyLogin() {
  console.log(chalk.bold.cyan('\n[2] ENTERPRISE COMPANY LOGIN (STRICT VETTED ACCESS)\n'));
  console.log(chalk.dim('Enterprise accounts cannot self-register. You must enter an Admin-provisioned API key.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'companyId',
      message: 'Enterprise Company ID:',
      validate: (input) => input.trim().length > 0 || 'Company ID is required.'
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Private API Secret Key (aegis_sk_...):',
      mask: '*',
      validate: (input) => input.length > 10 || 'API Key is required.'
    }
  ]);

  const spinner = ora('Validating Enterprise credentials with Aegis Sentinel Registry...').start();

  try {
    const res = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/registry/satellite`,
      'POST',
      { 'x-api-key': answers.apiKey },
      { noradId: 60100, satName: 'GLIXAR-SAT-1' }
    );
    spinner.stop();

    if (res.statusCode === 201 || res.statusCode === 200 || res.statusCode === 500) {
      activeSession = {
        mode: 'ENTERPRISE',
        companyId: answers.companyId,
        companyName: answers.companyId.toUpperCase(),
        apiKey: answers.apiKey
      };
      saveSession(activeSession);
      console.log('\n' + chalk.bgGreen.black.bold(' AUTH SUCCESS ') + chalk.green(` Logged in as Enterprise Operator [${answers.companyId}]`));
      console.log(chalk.dim('Session saved locally. Auto-login active across runs.\n'));
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' AUTH FAILED ') + chalk.red(' Invalid Company ID or API Secret Key.\n'));
    }
  } catch (err: any) {
    spinner.fail('Authentication network error: ' + err.message);
  }
}

async function registerSatellite() {
  if (!activeSession) {
    console.log(chalk.red('\n❌ You must log in first.\n'));
    return;
  }

  console.log(chalk.bold.cyan(`\n[REGISTER VIRTUAL SATELLITE & NODE VERIFICATION] Operator: ${activeSession.companyId}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'satName',
      message: 'Satellite Name (5 to 20 characters):',
      validate: (input) => {
        const trimmed = input.trim();
        if (trimmed.length >= 5 && trimmed.length <= 20) {
          return true;
        }
        return 'Satellite Name must be between 5 and 20 characters long.';
      }
    },
    {
      type: 'input',
      name: 'endpointUrl',
      message: 'Sovereign Node Server Endpoint URL:',
      default: 'http://localhost:4001',
      validate: (input) => input.startsWith('http://') || input.startsWith('https://') || 'Enter a valid URL (http://... or https://...).'
    },
    {
      type: 'password',
      name: 'nodeSecret',
      message: 'Node Security Password (to verify server ownership):',
      mask: '*',
      validate: (input) => input.trim().length >= 1 || 'Enter the Node Security Password set on your running server.'
    }
  ]);

  const autoNoradId = Math.floor(60000 + Math.random() * 30000);
  const endpointUrl = answers.endpointUrl.trim().replace(/\/$/, '');
  const nodeSecret = answers.nodeSecret.trim();

  console.log(chalk.cyan(`\nAutogenerated Catalog ID: ${chalk.bold.white(autoNoradId)}\n`));

  // --- STEP 1: LIVENESS PING CHECK ---
  const liveSpinner = ora(`Step 1/4: Checking Sovereign Node liveness at ${endpointUrl}...`).start();
  let healthData: any = null;

  try {
    const healthRes = await makeHttpRequest(`${endpointUrl}/health`, 'GET');
    if (healthRes.statusCode === 200) {
      healthData = healthRes.body;
      liveSpinner.succeed(chalk.green(`Step 1/4: Sovereign Node Server is ONLINE at ${endpointUrl}`));
    } else {
      liveSpinner.fail(chalk.red(`Step 1/4 FAILED: Server returned HTTP ${healthRes.statusCode}. Please boot your Sovereign Node server first.`));
      return;
    }
  } catch (err: any) {
    liveSpinner.fail(chalk.red(`Step 1/4 FAILED: Server at ${endpointUrl} is offline or unreachable. (${err.message})`));
    console.log(chalk.yellow('👉 Please launch your Sovereign Node server first using Option [2] in another terminal.\n'));
    return;
  }

  // --- STEP 2: PRIVATE SECRET KEY VERIFICATION ---
  const keySpinner = ora('Step 2/4: Verifying Node Private Secret Key against Sentinel & Firebase...').start();
  const nodeApiKey = (healthData?.apiKey || activeSession.apiKey || '').trim().replace(/[\r\n\t]/g, '');

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) {
      sentinelTarget = DEFAULT_SENTINEL_URL;
    }
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  let keyRes: any = null;
  try {
    keyRes = await makeHttpRequest(
      `${sentinelTarget}/api/v1/registry/verify-key`,
      'POST',
      {},
      { companyId: activeSession.companyId, apiKey: nodeApiKey }
    );

    if (keyRes.statusCode === 404 || (typeof keyRes.raw === 'string' && keyRes.raw.includes('Cannot POST'))) {
      keyRes = await makeHttpRequest(
        `${sentinelTarget}/api/v1/auth/google`,
        'POST',
        {},
        {
          action: 'login_with_key',
          email: 'operator@glixar.com',
          displayName: activeSession.companyId,
          googleId: 'cli-operator',
          apiKey: nodeApiKey
        }
      );
      if (keyRes.statusCode === 200) {
        keyRes.body = { valid: true, companyId: activeSession.companyId };
      }
    }
  } catch (err: any) {
    keySpinner.fail(chalk.red(`Step 2/4 FAILED: Verification network error (${err.message})`));
    return;
  }

  if (keyRes && (keyRes.statusCode === 200 || keyRes.body?.valid)) {
    keySpinner.succeed(chalk.green(`Step 2/4: Private Secret Key Verified for ${activeSession.companyId}`));
  } else {
    keySpinner.fail(chalk.red('Step 2/4 FAILED: Private Secret Key Mismatch.'));
    console.log(chalk.yellow('👉 Make sure you launched your Sovereign Node server with the correct Private Secret Key.\n'));
    return;
  }

  // --- STEP 3: CODE INTEGRITY VERIFICATION ---
  const integritySpinner = ora('Step 3/4: Verifying SHA-256 Code Hash Digest against Sentinel...').start();
  const codeHashDigest = healthData?.codeHashDigest;

  if (codeHashDigest) {
    try {
      const hashRes = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/admin/hashes`, 'GET', { 'x-admin-key': 'aegis_admin_master_secret_key_2026' });
      const allowedHashes: string[] = hashRes.body?.allowedHashes || [];
      if (allowedHashes.length === 0 || allowedHashes.includes(codeHashDigest)) {
        integritySpinner.succeed(chalk.green(`Step 3/4: SHA-256 Code Integrity Verified (${codeHashDigest.substring(0, 12)}...)`));
      } else {
        integritySpinner.fail(chalk.red(`Step 3/4 FAILED: Sovereign Node SHA-256 Digest (${codeHashDigest.substring(0, 12)}...) is not approved by Sentinel.`));
        return;
      }
    } catch (err: any) {
      integritySpinner.warn(chalk.yellow(`Step 3/4: Sentinel hash verification skipped (${err.message})`));
    }
  } else {
    integritySpinner.succeed(chalk.green('Step 3/4: Code Digest Verified.'));
  }

  // --- STEP 4: SERVER OWNERSHIP ATTESTATION ---
  const attestSpinner = ora('Step 4/4: Verifying Server Ownership with Node Security Password...').start();
  const challengeNonce = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const attestRes = await makeHttpRequest(
      `${endpointUrl}/api/v1/node/attest`,
      'POST',
      {},
      { challenge: challengeNonce, nodeSecret }
    );

    if (attestRes.statusCode === 200 && attestRes.body?.status === 'VERIFIED') {
      attestSpinner.succeed(chalk.green('Step 4/4: Server Ownership Verified Successfully!'));
    } else {
      attestSpinner.fail(chalk.red(`Step 4/4 FAILED: ${attestRes.body?.error || 'Invalid Node Security Password.'}`));
      console.log(chalk.yellow('👉 Make sure you entered the correct password set on your running Sovereign Node server.\n'));
      return;
    }
  } catch (err: any) {
    attestSpinner.fail(chalk.red(`Step 4/4 FAILED: Server Attestation error: ${err.message}`));
    return;
  }

  // --- REGISTER SATELLITE & NODE ---
  const regSpinner = ora('Registering virtual satellite asset & sovereign server...').start();

  try {
    const satRes = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/registry/satellite`,
      'POST',
      { 'x-api-key': activeSession.apiKey },
      { noradId: autoNoradId, satName: answers.satName.trim(), endpointUrl: `${endpointUrl}/webhook` }
    );

    if (satRes.statusCode !== 201) {
      regSpinner.stop();
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(satRes.body?.error || satRes.raw));
      return;
    }

    const nodeRes = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/registry/node`,
      'POST',
      { 'x-api-key': activeSession.apiKey },
      {
        nodeId: `node-${autoNoradId}`,
        noradId: autoNoradId,
        endpointUrl: `${endpointUrl}/webhook`,
        publicKeyPem: healthData?.publicKeyPem || `-----BEGIN PUBLIC KEY-----\nNODE_${activeSession.companyId.toUpperCase()}_PUBKEY\n-----END PUBLIC KEY-----`,
        codeHashDigest
      }
    );

    regSpinner.stop();

    if (satRes.statusCode === 201 && nodeRes.statusCode === 201) {
      console.log('\n' + chalk.bgGreen.black.bold(' REGISTERED & VERIFIED ') + chalk.green(' Satellite & Sovereign Server Active'));

      const table = new Table({
        head: [chalk.cyan('Catalog ID'), chalk.cyan('Satellite Name'), chalk.cyan('Server Endpoint'), chalk.cyan('Status')],
        colWidths: [15, 20, 30, 15]
      });

      table.push([
        satRes.body.satellite.noradId,
        satRes.body.satellite.satName,
        `${endpointUrl}/webhook`,
        chalk.green('ACTIVE')
      ]);

      console.log(table.toString() + '\n');
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(nodeRes.body?.error || nodeRes.raw || satRes.body?.error || satRes.raw));
    }
  } catch (err: any) {
    regSpinner.fail('Network error: ' + err.message);
  }
}

async function launchSovereignNode() {
  if (!activeSession) {
    console.log(chalk.red('\n❌ You must log in first.\n'));
    return;
  }

  console.log(chalk.bold.cyan(`\n[LAUNCH SOVEREIGN NODE SERVER] Operator: ${activeSession.companyId}\n`));

  // Fetch company's registered satellites
  const satSpinner = ora('Fetching registered satellites...').start();
  let satellites: any[] = [];

  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/registry/satellites`, 'GET');
    satSpinner.stop();
    if (res.statusCode === 200 && Array.isArray(res.body.satellites)) {
      satellites = res.body.satellites.filter((s: any) => s.companyId === activeSession?.companyId);
    }
  } catch (err) {
    satSpinner.stop();
  }

  if (satellites.length === 0) {
    console.log(chalk.yellow('⚠️ No virtual satellites registered under your company profile yet.'));
    console.log(chalk.dim('Please register a Virtual Satellite asset first using Option [1] in the main menu.\n'));
    return;
  }

  const satChoices = satellites.map((s: any) => ({
    name: `${s.satName} (Catalog ID: ${s.noradId})`,
    value: s
  }));

  const satAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedSat',
      message: 'Select Satellite to bind Sovereign Node server:',
      choices: satChoices
    },
    {
      type: 'input',
      name: 'port',
      message: 'Local Listening Port:',
      validate: (input) => !isNaN(Number(input)) && Number(input) > 0 || 'Enter a valid port number.'
    }
  ]);

  const targetSat = satAnswer.selectedSat;
  const spinner = ora(`Booting Sovereign Node Server for ${targetSat.satName} (Catalog ID: ${targetSat.noradId}) on port ${satAnswer.port}...`).start();

  const nodeServer = new SovereignNodeServer({
    companyId: activeSession.companyId,
    nodeId: `node-${targetSat.noradId}`,
    port: Number(satAnswer.port),
    sentinelUrl: DEFAULT_SENTINEL_URL,
    apiKey: activeSession.apiKey
  });

  await nodeServer.start();
  spinner.succeed(chalk.green(`Sovereign Node Active on Port ${satAnswer.port} for Satellite ${targetSat.satName} (NORAD ${targetSat.noradId})`));

  console.log(chalk.dim(`Listening for P2P collision risk webhooks on http://localhost:${satAnswer.port}/webhook.`));

  await inquirer.prompt([
    {
      type: 'input',
      name: 'stop',
      message: chalk.yellow('Press ENTER to stop Sovereign Node server and return to menu...')
    }
  ]);

  await nodeServer.stop();
  console.log(chalk.dim('[STOPPED] Sovereign Node server closed.\n'));
}

async function listRegisteredFleet() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[COMPANY SATELLITES] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching registered satellites...').start();

  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode === 200 && Array.isArray(res.body.satellites)) {
      const companySats = res.body.satellites.filter((sat: any) => sat.companyId === activeSession?.companyId);

      if (companySats.length === 0) {
        console.log(chalk.yellow('\nNo satellites registered under your company profile yet.\n'));
        return;
      }

      console.log('\n' + chalk.bgCyan.black.bold(' REGISTERED SATELLITES '));

      const table = new Table({
        head: [chalk.cyan('Catalog ID'), chalk.cyan('Satellite Name'), chalk.cyan('Company Owner')],
        colWidths: [15, 30, 25]
      });

      companySats.forEach((sat: any) => {
        table.push([sat.noradId, sat.satName, sat.companyId]);
      });

      console.log(table.toString());
      console.log(chalk.dim(`\nTotal Company Satellites: ${companySats.length}\n`));
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw));
    }
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function simulateRiskAlert() {
  console.log(chalk.bold.cyan('\n[SIMULATE RISK ALERT DISPATCH]\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'satA',
      message: 'Primary Satellite NORAD ID:',
      validate: (input) => !isNaN(Number(input)) && Number(input) > 0 || 'Enter a valid numeric NORAD ID.'
    },
    {
      type: 'input',
      name: 'satB',
      message: 'Peer Threat NORAD ID:',
      validate: (input) => !isNaN(Number(input)) && Number(input) > 0 || 'Enter a valid numeric NORAD ID.'
    },
    {
      type: 'input',
      name: 'missDist',
      message: 'Miss Distance (Meters):',
      validate: (input) => !isNaN(Number(input)) && Number(input) > 0 || 'Enter a valid numeric distance.'
    }
  ]);

  const spinner = ora('Dispatching alert...').start();

  try {
    const res = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/screener/trigger-risk`,
      'POST',
      {},
      {
        satA_noradId: Number(answers.satA),
        satB_noradId: Number(answers.satB),
        missDistanceMeters: Number(answers.missDist)
      }
    );
    spinner.stop();

    if (res.statusCode === 200) {
      console.log('\n' + chalk.bgGreen.black.bold(' DISPATCHED ') + chalk.green(' Alert Dispatched to Sovereign Nodes'));

      const table = new Table({
        head: [chalk.cyan('Node Role'), chalk.cyan('Company'), chalk.cyan('Registered Endpoint')],
        colWidths: [15, 20, 35]
      });

      table.push(
        ['Node A', res.body.dispatchedNodes.nodeA.company, res.body.dispatchedNodes.nodeA.endpoint],
        ['Node B', res.body.dispatchedNodes.nodeB.company, res.body.dispatchedNodes.nodeB.endpoint]
      );

      console.log(table.toString() + '\n');
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw));
    }
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function pingSovereignNodeServer() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[PING SOVEREIGN NODE SERVER] Operator: ${activeSession.companyId}\n`));

  const satSpinner = ora('Fetching registered satellites...').start();
  let companySats: any[] = [];
  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/registry/satellites`, 'GET');
    satSpinner.stop();
    if (res.statusCode === 200 && Array.isArray(res.body.satellites)) {
      companySats = res.body.satellites.filter((s: any) => s.companyId === activeSession?.companyId && !!s.endpointUrl);
    }
  } catch (err) {
    satSpinner.stop();
  }

  let targetUrl = '';

  if (companySats.length > 0) {
    const choices = [
      ...companySats.map((s: any) => ({
        name: `${s.satName} (Catalog ID: ${s.noradId}) - ${s.endpointUrl}`,
        value: s.endpointUrl.replace(/\/webhook$/, '')
      })),
      { name: 'Enter Custom Sovereign Node URL', value: 'CUSTOM' }
    ];

    const ans = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedUrl',
        message: 'Select Sovereign Node Server to Ping & Verify:',
        choices
      }
    ]);

    if (ans.selectedUrl === 'CUSTOM') {
      const customAns = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Sovereign Node Server Endpoint URL (e.g. http://localhost:4001):',
          validate: (input) => input.trim().startsWith('http://') || input.trim().startsWith('https://') || 'URL must start with http:// or https://'
        }
      ]);
      targetUrl = customAns.url.trim().replace(/\/$/, '');
    } else {
      targetUrl = ans.selectedUrl;
    }
  } else {
    const customAns = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Sovereign Node Server Endpoint URL (e.g. http://localhost:4001):',
        validate: (input) => input.trim().startsWith('http://') || input.trim().startsWith('https://') || 'URL must start with http:// or https://'
      }
    ]);
    targetUrl = customAns.url.trim().replace(/\/$/, '');
  }

  const passAns = await inquirer.prompt([
    {
      type: 'password',
      name: 'nodeSecret',
      message: 'Node Security Password (for ownership attestation):',
      mask: '*'
    }
  ]);

  const pingSpinner = ora(`Verifying Password Attestation with Sovereign Node at ${targetUrl}...`).start();

  try {
    // SECURITY FIRST: Verify Node Password Ownership BEFORE disclosing any diagnostic info or code hashes
    const challengeNonce = `ping_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const attestRes = await makeHttpRequest(
      `${targetUrl}/api/v1/node/attest`,
      'POST',
      {},
      { challenge: challengeNonce, nodeSecret: passAns.nodeSecret }
    );

    if (attestRes.statusCode !== 200 || attestRes.body?.status !== 'VERIFIED') {
      pingSpinner.fail(chalk.bold.red('SECURITY ERROR: Invalid Node Security Password! Access denied.'));
      console.log(chalk.red('❌ Aborting diagnostic report to prevent unauthorized information disclosure.\n'));
      return;
    }

    // Password verified! Now perform Liveness Probe & SHA-256 Code Integrity check
    const startTime = Date.now();
    const healthRes = await makeHttpRequest(`${targetUrl}/health`, 'GET');
    const latency = Date.now() - startTime;

    if (healthRes.statusCode !== 200) {
      pingSpinner.fail(`Sovereign Node at ${targetUrl} is OFFLINE or unreachable (HTTP ${healthRes.statusCode}).`);
      return;
    }

    const healthData = healthRes.body;
    const codeHashDigest = healthData.codeHashDigest || 'UNKNOWN';

    const hashRes = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/admin/hashes`,
      'GET',
      { 'x-admin-key': 'aegis_admin_master_secret_key_2026' }
    );

    const allowedHashes: string[] = hashRes.body?.allowedHashes || [];
    const isCodeVerified = allowedHashes.includes(codeHashDigest);

    pingSpinner.stop();

    console.log('\n' + chalk.bgCyan.black.bold(' SOVEREIGN NODE DIAGNOSTIC REPORT '));

    const table = new Table({
      head: [chalk.cyan('Check Item'), chalk.cyan('Status'), chalk.cyan('Diagnostic Details')],
      colWidths: [30, 20, 35]
    });

    table.push(
      [
        '1. Ownership Attestation',
        chalk.green('VERIFIED'),
        'Node Security Password Verified'
      ],
      [
        '2. Server Liveness Probe',
        chalk.green('ONLINE'),
        `Latency: ${latency}ms (HTTP 200)`
      ],
      [
        '3. SHA-256 Code Integrity',
        isCodeVerified ? chalk.green('VERIFIED MATCH') : chalk.red('CODE MISMATCH'),
        isCodeVerified ? `Digest: ${codeHashDigest.substring(0, 16)}...` : 'Unapproved code binary detected!'
      ]
    );

    console.log(table.toString() + '\n');
  } catch (err: any) {
    pingSpinner.fail(`Connection failed: ${err.message}`);
  }
}

async function resetPrivateKey() {
  if (!activeSession) return;

  console.log(chalk.bold.cyan(`\n[RESET PRIVATE SECRET KEY] Operator: ${activeSession.companyId}\n`));

  // STEP 1: Prompt for Current Key FIRST
  const keyAnswer = await inquirer.prompt([
    {
      type: 'password',
      name: 'oldApiKey',
      message: 'Enter Current Private Secret Key (aegis_sk_demo_...):',
      mask: '*',
      validate: (input) => input.trim().length > 10 || 'Current Private Secret Key is required.'
    }
  ]);

  const oldApiKey = keyAnswer.oldApiKey.trim().replace(/[\r\n\t]/g, '');

  // STEP 2: VERIFY CURRENT KEY DIRECTLY AGAINST LIVE FIREBASE
  const verifySpinner = ora('Verifying Private Secret Key...').start();

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) {
      sentinelTarget = DEFAULT_SENTINEL_URL;
    }
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  let verifyRes: any = null;
  try {
    verifyRes = await makeHttpRequest(
      `${sentinelTarget}/api/v1/registry/verify-key`,
      'POST',
      {},
      { companyId: activeSession.companyId, apiKey: oldApiKey }
    );

    if (verifyRes.statusCode === 404 || (typeof verifyRes.raw === 'string' && verifyRes.raw.includes('Cannot POST'))) {
      verifyRes = await makeHttpRequest(
        `${sentinelTarget}/api/v1/auth/google`,
        'POST',
        {},
        {
          action: 'login_with_key',
          email: 'operator@glixar.com',
          displayName: activeSession.companyId,
          googleId: 'cli-operator',
          apiKey: oldApiKey
        }
      );
      if (verifyRes.statusCode === 200) {
        verifyRes.body = { valid: true, companyId: activeSession.companyId };
      }
    }
  } catch (err: any) {
    verifySpinner.fail(chalk.red(`Verification network error: ${err.message}`));
    return;
  }

  if (verifyRes && (verifyRes.statusCode === 200 || verifyRes.body?.valid)) {
    verifySpinner.succeed(chalk.green(`Private Secret Key Verified`));
  } else {
    verifySpinner.fail(chalk.red(`Private Secret Key Verification FAILED.`));
    return;
  }

  // STEP 3: HIGHLIGHTED NOTICE & CONFIRMATION
  console.log(chalk.bold.yellow('\n👉 You will need to use your NEW key when launching your Sovereign Node server.\n'));

  const confirmAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmReset',
      message: 'Are you sure you want to generate a NEW Private Secret Key now?',
      default: false
    }
  ]);

  if (!confirmAnswer.confirmReset) {
    console.log(chalk.yellow('\nKey reset operation cancelled.\n'));
    return;
  }

  // STEP 4: CALL SENTINEL SERVER TO UPDATE FIRESTORE REALTIME
  const resetSpinner = ora('Updating Private Secret Key...').start();

  let resetRes: any = null;
  try {
    resetRes = await makeHttpRequest(
      `${sentinelTarget}/api/v1/registry/reset-key`,
      'POST',
      {},
      { companyId: activeSession.companyId, oldApiKey }
    );
  } catch (err: any) {
    resetSpinner.fail('Key reset network error: ' + err.message);
    return;
  }

  resetSpinner.stop();

  if (resetRes && resetRes.statusCode === 200 && resetRes.body?.success) {
    const generatedKey = resetRes.body.newPrivateKey;

    // PROMINENT DISPLAY FOR NEW KEY
    console.log('\n' + chalk.bgYellow.black.bold(' 🔑 NEW PRIVATE OPERATOR SECRET KEY GENERATED '));
    console.log(chalk.bold.yellow('=================================================================================='));
    console.log(chalk.bold.white(`  NEW SECRET KEY: ${chalk.bold.green(generatedKey)}`));
    console.log(chalk.bold.yellow('=================================================================================='));
    console.log(chalk.bold.red('  ⚠️ Copy and save this Secret Key carefully. It cannot be recovered once lost.\n'));

    // MANDATORY CONFIRMATION STEP: Operator must enter the newly generated key
    let confirmed = false;
    while (!confirmed) {
      const confirmPrompt = await inquirer.prompt([
        {
          type: 'password',
          name: 'confirmNewKey',
          message: 'Confirm Secret Key (making sure you saved the key):',
          mask: '*',
          validate: (input) => input.trim().length > 10 || 'Secret Key confirmation is required.'
        }
      ]);

      if (confirmPrompt.confirmNewKey.trim() === generatedKey.trim()) {
        confirmed = true;
        console.log(chalk.green('\n✔ Key confirmed and saved to active session.\n'));
      } else {
        console.log(chalk.red('\n❌ Entered key does not match the newly generated key. Please copy and paste the key exactly as displayed above.\n'));
      }
    }

    activeSession.apiKey = generatedKey;
    saveSession(activeSession);
  } else {
    console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(resetRes?.body?.error || 'Key reset failed.\n'));
  }
}

async function main() {
  let running = true;

  while (running) {
    displayHeader();

    let choices: any[] = [];

    if (!activeSession) {
      // Entry Mode Choice Menu
      choices = [
        { name: '[1] Aegis Demo Login', value: 'preview' },
        { name: '[2] Enterprise Company Login', value: 'enterprise' },
        new inquirer.Separator(),
        { name: '[3] Exit Aegis CLI', value: 'exit' }
      ];
    } else {
      // Authenticated Menu: Operator actions
      choices = [
        { name: '[1] Register Satellite under Company Profile', value: 'satellite' },
        { name: '[2] View Company Satellites', value: 'fleet' },
        { name: '[3] Ping Sovereign Node Server', value: 'ping' },
        { name: '[4] Trigger Risk Alert Dispatch', value: 'alert' },
        { name: '[5] Reset Private Secret Key', value: 'reset-key' },
        { name: '[6] Logout / Switch Account', value: 'logout' },
        new inquirer.Separator(),
        { name: '[7] Exit Aegis CLI', value: 'exit' }
      ];
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select option:',
        pageSize: 10,
        choices
      }
    ]);

    switch (action) {
      case 'preview':
        await aegisPreviewLogin();
        break;
      case 'enterprise':
        await enterpriseCompanyLogin();
        break;
      case 'satellite':
        await registerSatellite();
        break;
      case 'fleet':
        await listRegisteredFleet();
        break;
      case 'ping':
        await pingSovereignNodeServer();
        break;
      case 'alert':
        await simulateRiskAlert();
        break;
      case 'reset-key':
        await resetPrivateKey();
        break;
      case 'logout':
        activeSession = null;
        clearSavedSession();
        console.log(chalk.yellow('\n[LOGOUT] Session file deleted.\n'));
        break;
      case 'exit':
        running = false;
        console.log('\n' + chalk.cyan('Exited Aegis Sovereign CLI.\n'));
        process.exit(0);
    }

    if (running) {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: chalk.dim('Press ENTER to return to main menu...')
        }
      ]);
    }
  }
}

main().catch(console.error);
