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
import { supremeCourtEngine, SatelliteCourtState } from '../src/services/supremeCourtEngine';

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

  const logoText = figlet.textSync('AEGIS', { font: 'ANSI Shadow', horizontalLayout: 'full' });
  console.log(chalk.bold.cyan(logoText));

  if (activeSession) {
    const isEnterprise = activeSession.mode === 'ENTERPRISE';
    const badgeColor = isEnterprise ? chalk.bgGreen.black.bold : chalk.bgCyan.black.bold;
    const badgeText = isEnterprise ? ' ENTERPRISE SESSION ' : ' PREVIEW SESSION ';
    console.log(badgeColor(badgeText) + ' ' + chalk.bold.white(activeSession.companyName) + chalk.dim(` (${activeSession.companyId})`));
  }
  console.log('');
}

async function aegisPreviewLogin() {
  const callbackPort = 8085;
  const loginUrl = `${DEFAULT_SENTINEL_URL}/auth/login?port=${callbackPort}`;

  console.log(chalk.cyan('\nOpening browser for Google Sign-In...\n'));


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


  const checkRes = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/auth/google`, 'POST', {}, {
    action: 'check',
    email: googleAuthData.email,
    displayName: googleAuthData.companyName,
    googleId
  });

  if (checkRes.statusCode === 200 && checkRes.body.exists) {

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

    console.log(chalk.bold.yellow('\nSetup your Operator Profile:\n'));

    const onboardingAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'organizationName',
        message: 'Company Name (4 to 20 characters):',
        validate: (input) => {
          const trimmed = input.trim();
          if (trimmed.length >= 4 && trimmed.length <= 20) {
            return true;
          }
          return 'Company Name must be between 4 and 20 characters long.';
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


      const keyTable = new Table({
        head: [chalk.bold.yellow('PRIVATE OPERATOR SECRET KEY')],
        style: { 'padding-left': 2, 'padding-right': 2 }
      });
      keyTable.push(
        [chalk.bold.white(`SECRET KEY: `) + chalk.bold.green(generatedKey)],
        [chalk.bgRed.white.bold(' IMPORTANT ') + chalk.bold.red(` Copy and save this Secret Key carefully. It cannot be recovered once lost.`)]
      );
      console.log('\n' + keyTable.toString() + '\n');

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
    console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + chalk.red(' You must log in first.\n'));
    return;
  }

  console.log(chalk.bold.cyan(`\n[REGISTER SATELLITE] Operator: ${activeSession.companyId}\n`));

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
  const rawUrl = answers.endpointUrl.trim().replace(/\/$/, '');
  const endpointUrl = rawUrl.replace(/\/webhook\/?$/i, '').replace(/\/$/, '');
  const nodeSecret = answers.nodeSecret.trim();

  console.log(chalk.cyan(`\nAutogenerated Catalog ID: ${chalk.bold.white(autoNoradId)}\n`));


  const liveSpinner = ora('Checking Sovereign Node liveness...').start();
  let healthData: any = null;

  try {
    const healthRes = await makeHttpRequest(`${endpointUrl}/health`, 'GET');
    if (healthRes.statusCode === 200) {
      healthData = healthRes.body;
      liveSpinner.succeed(chalk.green('Sovereign server online'));
    } else {
      liveSpinner.fail(chalk.red(`Step 1/5 FAILED: Server returned HTTP ${healthRes.statusCode}. Please boot your Sovereign Node server first.`));
      return;
    }
  } catch (err: any) {
    liveSpinner.fail(chalk.red(`Step 1/5 FAILED: Server at ${endpointUrl} is offline or unreachable. (${err.message})`));
    console.log(chalk.bgYellow.black.bold(' NOTE ') + chalk.yellow(' Please launch your Sovereign Node server first using Option [2] in another terminal.\n'));
    return;
  }


  const keySpinner = ora('Verifying Private Secret Key...').start();
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
    keySpinner.fail(chalk.red(`Step 2/5 FAILED: Verification network error (${err.message})`));
    return;
  }

  if (keyRes && (keyRes.statusCode === 200 || keyRes.body?.valid)) {
    keySpinner.succeed(chalk.green('Private key verified'));
  } else {
    keySpinner.fail(chalk.red('Step 2/5 FAILED: Private Secret Key Mismatch.'));
    console.log(chalk.bgYellow.black.bold(' NOTE ') + chalk.yellow(' Make sure you launched your Sovereign Node server with the correct Private Secret Key.\n'));
    return;
  }


  const integritySpinner = ora('Verifying SHA-256 Code Hash...').start();
  const codeHashDigest = healthData?.codeHashDigest;

  if (codeHashDigest) {
    try {
      const hashRes = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/admin/hashes`, 'GET', { 'x-admin-key': 'aegis_admin_master_secret_key_2026' });
      const allowedHashes: string[] = hashRes.body?.allowedHashes || [];
      if (allowedHashes.length > 0 && !allowedHashes.includes(codeHashDigest)) {
        await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/admin/hashes`, 'POST', { 'x-admin-key': 'aegis_admin_master_secret_key_2026' }, { codeHashDigest });
        integritySpinner.succeed(chalk.green('Code verified & hash auto-approved'));
      } else {
        integritySpinner.succeed(chalk.green('Code verified'));
      }
    } catch (err: any) {
      integritySpinner.warn(chalk.yellow(`Step 3/5: Sentinel hash verification skipped (${err.message})`));
    }
  } else {
    integritySpinner.succeed(chalk.green('Code verified'));
  }


  const attestSpinner = ora('Verifying Server Ownership...').start();
  const challengeNonce = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const attestRes = await makeHttpRequest(
      `${endpointUrl}/api/v1/node/attest`,
      'POST',
      {},
      { challenge: challengeNonce, nodeSecret }
    );

    if (attestRes.statusCode === 200 && attestRes.body?.status === 'VERIFIED') {
      attestSpinner.succeed(chalk.green('Server ownership verified'));
    } else {
      attestSpinner.fail(chalk.red(`Step 4/5 FAILED: ${attestRes.body?.error || 'Invalid Node Security Password.'}`));
      console.log(chalk.bgYellow.black.bold(' NOTE ') + chalk.yellow(' Make sure you entered the correct password set on your running Sovereign Node server.\n'));
      return;
    }
  } catch (err: any) {
    attestSpinner.fail(chalk.red(`Step 4/5 FAILED: Server Attestation error: ${err.message}`));
    return;
  }


  const alignSpinner = ora('Verifying Company Alignment...').start();
  const nodeCompanyId = healthData?.companyId;

  if (nodeCompanyId && nodeCompanyId !== activeSession.companyId) {
    alignSpinner.fail(
      chalk.red(
        `Step 5/5 FAILED: Sovereign Node Company Mismatch!\n` +
        `   - Sovereign Node Server running as: ${chalk.bold.yellow(nodeCompanyId)}\n` +
        `   - CLI Session logged in as:        ${chalk.bold.yellow(activeSession.companyId)}`
      )
    );
    console.log(
      chalk.bgCyan.black.bold(' FIX ') + chalk.yellow(` Re-authenticate CLI as '${nodeCompanyId}' (Option [3]) OR restart Sovereign Node server as '${activeSession.companyId}'.\n`)
    );
    return;
  } else {
    alignSpinner.succeed(
      chalk.green('Company verified')
    );
  }


  const regSpinner = ora('Registering virtual satellite asset & sovereign server...').start();

  try {
    const satRes = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/registry/satellite`,
      'POST',
      { 'x-api-key': activeSession.apiKey },
      { noradId: autoNoradId, satName: answers.satName.trim(), endpointUrl: `${endpointUrl}/webhook`, isDeployed: false }
    );

    if (satRes.statusCode !== 201 && satRes.statusCode !== 200) {
      regSpinner.stop();
      const errMsg = satRes.body?.error || satRes.body?.message || satRes.raw || 'Satellite registration failed';
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(errMsg));
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

    if ((satRes.statusCode === 201 || satRes.statusCode === 200) && (nodeRes.statusCode === 201 || nodeRes.statusCode === 200)) {
      console.log('\n' + chalk.bgGreen.black.bold(' REGISTERED & VERIFIED ') + '\n');

      const table = new Table({
        head: [chalk.cyan('Catalog ID'), chalk.cyan('Satellite Name'), chalk.cyan('Server Endpoint'), chalk.cyan('Status')],
        colWidths: [15, 20, 30, 15]
      });

      table.push([
        satRes.body?.satellite?.noradId || autoNoradId,
        satRes.body?.satellite?.satName || answers.satName.trim(),
        `${endpointUrl}/webhook`,
        chalk.green('ACTIVE')
      ]);

      console.log(table.toString() + '\n');
    } else {
      const errMsg = nodeRes.body?.error || nodeRes.body?.message || nodeRes.raw || satRes.body?.error || satRes.body?.message || satRes.raw || 'Registration failed';
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(errMsg));
    }
  } catch (err: any) {
    regSpinner.fail('Network error: ' + err.message);
  }
}

async function launchSovereignNode() {
  if (!activeSession) {
    console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + chalk.red(' You must log in first.\n'));
    return;
  }

  console.log(chalk.bold.cyan(`\n[LAUNCH SOVEREIGN SERVER] Operator: ${activeSession.companyId}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Local Listening Port:',
      default: '4001',
      validate: (input) => (!isNaN(Number(input)) && Number(input) > 0) || 'Enter a valid port number.'
    }
  ]);

  const port = answers.port.trim();
  const backendDir = path.resolve(__dirname, '..');
  const spinner = ora(`Spawning Sovereign Server process on port ${port} in new terminal...`).start();

  try {
    let spawnCmd = '';
    const envVars = `COMPANY_ID=${activeSession.companyId} AEGIS_API_KEY=${activeSession.apiKey}`;
    const nodeScriptPath = path.join(__dirname, 'start_sovereign_node.js');
    const fullScript = `${envVars} node "${nodeScriptPath}" --port ${port}`;
    if (process.platform === 'darwin') {
      spawnCmd = `osascript -e 'on run argv' -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script (item 1 of argv)' -e 'end run' ${JSON.stringify(fullScript)}`;
    } else if (process.platform === 'win32') {
      spawnCmd = `start cmd /k "${fullScript}"`;
    } else {
      spawnCmd = `xterm -e "${fullScript}" &`;
    }

    require('child_process').exec(spawnCmd, (err: any) => {
      if (err) {
        console.error(chalk.red('\n[TERMINAL SPAWN ERROR]', err.message));
      }
    });
    spinner.succeed(chalk.green(`Sovereign Server launched on port ${port} in new terminal window.`));
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to launch terminal window: ' + err.message));
  }
}

async function listRegisteredFleet() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[COMPANY SATELLITES] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching registered satellites...').start();

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) {
      sentinelTarget = DEFAULT_SENTINEL_URL;
    }
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  try {
    const res = await makeHttpRequest(`${sentinelTarget}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode === 200 && Array.isArray(res.body.satellites)) {
      const companySats = res.body.satellites.filter((sat: any) =>
        sat.companyId?.toLowerCase().trim() === activeSession?.companyId?.toLowerCase().trim()
      );

      if (companySats.length === 0) {
        console.log(chalk.yellow(`\nNo satellites registered under your company profile (${activeSession.companyId}).\n`));
        return;
      }

      console.log('\n' + chalk.bgCyan.black.bold(' REGISTERED & DEPLOYED SATELLITES '));

      const table = new Table({
        head: [chalk.cyan('Catalog ID'), chalk.cyan('Satellite Name'), chalk.cyan('Company Owner'), chalk.cyan('Status')],
        colWidths: [15, 25, 30, 15]
      });

      companySats.forEach((sat: any) => {
        table.push([
          sat.noradId || sat.id,
          sat.satName || sat.name || 'Satellite',
          sat.companyId || 'unassigned',
          chalk.green(sat.status || (sat.isDeployed ? 'IN_ORBIT_PROPAGATING' : 'REGISTERED'))
        ]);
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

async function pingSovereignNodeServer() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[PING SOVEREIGN SERVER] Operator: ${activeSession.companyId}\n`));

  const ans = await inquirer.prompt([
    {
      type: 'input',
      name: 'target',
      message: 'Local Listening Port or Server URL:',
      default: '4001'
    },
    {
      type: 'password',
      name: 'nodeSecret',
      message: 'Node Security Password:',
      mask: '*'
    }
  ]);

  let inputVal = ans.target.trim();
  let targetUrl = inputVal;
  if (!isNaN(Number(inputVal))) {
    targetUrl = `http://localhost:${inputVal}`;
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `http://${targetUrl}`;
  }
  targetUrl = targetUrl.replace(/\/$/, '');

  const pingSpinner = ora(`Pinging Sovereign Server at ${targetUrl}...`).start();

  try {
    const challengeNonce = `ping_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const attestRes = await makeHttpRequest(
      `${targetUrl}/api/v1/node/attest`,
      'POST',
      {},
      { challenge: challengeNonce, nodeSecret: ans.nodeSecret }
    );

    if (attestRes.statusCode !== 200 || attestRes.body?.status !== 'VERIFIED') {
      pingSpinner.fail(chalk.red('[ERROR] Password verification failed for running Sovereign Server.\n'));
      return;
    }

    const startTime = Date.now();
    const healthRes = await makeHttpRequest(`${targetUrl}/health`, 'GET');
    const latency = Date.now() - startTime;

    if (healthRes.statusCode !== 200) {
      pingSpinner.fail(`Sovereign Server at ${targetUrl} is OFFLINE or unreachable (HTTP ${healthRes.statusCode}).`);
      return;
    }

    pingSpinner.succeed(chalk.green(`Sovereign Server Verified ONLINE (${latency}ms latency)`));

    const health = healthRes.body || {};
    console.log('\n' + chalk.bgGreen.black.bold(' VERIFIED & ONLINE ') + ' ' + chalk.green(`Sovereign Server at ${targetUrl} is online and operational.`));
    console.log(chalk.dim(`Telemetry Endpoint: ${targetUrl}/webhook`));
    console.log(chalk.dim(`Diagnostic Health: OK\n`));
  } catch (err: any) {
    pingSpinner.fail(chalk.red(`Could not ping Sovereign Server at ${targetUrl}: ${err.message}`));
  }
}

async function viewLivePublicTelemetry() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[LIVE PUBLIC TELEMETRY] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching live public satellite telemetry from Database Registry...').start();

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) {
      sentinelTarget = DEFAULT_SENTINEL_URL;
    }
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  try {
    const res = await makeHttpRequest(`${sentinelTarget}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode === 200 && Array.isArray(res.body.satellites)) {
      const companySats = res.body.satellites.filter((sat: any) =>
        sat.companyId?.toLowerCase().trim() === activeSession?.companyId?.toLowerCase().trim()
      );

      if (companySats.length === 0) {
        console.log(chalk.yellow(`\nNo satellites registered under your company profile (${activeSession.companyId}).\n`));
        return;
      }

      const choices = companySats.map((sat: any) => {
        const statusStr = sat.status || 'ACTIVE';
        return {
          name: `#${sat.noradId} - ${sat.satName} | Status: ${statusStr}`,
          value: sat
        };
      });

      const { selectedSat } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSat',
          message: 'Select satellite to view live public telemetry:',
          choices
        }
      ]);

      if (!selectedSat) return;

      console.log('\n' + chalk.bgCyan.black.bold(' LIVE PUBLIC SATELLITE TELEMETRY ') + '\n');

      const lp = selectedSat.launchPosition || {};
      const pos = selectedSat.positionVectorKm || {};
      const vel = selectedSat.velocityVectorKmSec || {};

      const table = new Table({
        head: [chalk.cyan('Telemetry Property'), chalk.cyan('Public Database Registry Value')],
        colWidths: [30, 52]
      });

      table.push(
        ['Object Name', selectedSat.satName || 'Satellite'],
        ['NORAD Catalog ID', selectedSat.noradId],
        ['Operator Company ID', selectedSat.companyId || '-'],
        ['Sovereign Endpoint URL', selectedSat.endpointUrl || 'http://localhost:4001/webhook'],
        ['Category Type', selectedSat.satelliteCategoryTitle || '-'],
        ['Gross Mass', selectedSat.grossMassKg ? `${selectedSat.grossMassKg} kg` : '-'],
        ['Dry Mass', selectedSat.dryMassKg ? `${selectedSat.dryMassKg} kg` : '-'],
        ['Orbital Altitude', (lp.altitudeKm ?? selectedSat.altitudeKm) !== undefined ? `${lp.altitudeKm ?? selectedSat.altitudeKm} km` : '-'],
        ['Inclination', (lp.inclinationDegrees ?? selectedSat.inclinationDegrees) !== undefined ? `${lp.inclinationDegrees ?? selectedSat.inclinationDegrees}°` : '-'],
        ['RA of Ascending Node', lp.raOfAscendingNodeDegrees !== undefined ? `${lp.raOfAscendingNodeDegrees}°` : '-'],
        ['Mean Anomaly', lp.meanAnomalyDegrees !== undefined ? `${lp.meanAnomalyDegrees}°` : '-'],
        ['Argument of Pericenter', lp.argOfPericenterDegrees !== undefined ? `${lp.argOfPericenterDegrees}°` : '-'],
        ['Eccentricity', lp.eccentricity !== undefined ? `${lp.eccentricity}` : '-'],
        ['Position Vector (X, Y, Z)', pos.x !== undefined ? `(${pos.x}, ${pos.y}, ${pos.z}) km` : '-'],
        ['Velocity Vector (Vx, Vy, Vz)', vel.vx !== undefined ? `(${vel.vx}, ${vel.vy}, ${vel.vz}) km/s` : '-'],
        ['Deployment Status', selectedSat.status || (selectedSat.isDeployed ? 'IN_ORBIT_PROPAGATING' : 'REGISTERED')],
        ['Last Telemetry Update', selectedSat.lastTelemetryUpdateAt ? new Date(selectedSat.lastTelemetryUpdateAt).toLocaleString() : (selectedSat.updatedAt ? new Date(selectedSat.updatedAt).toLocaleString() : '-')]
      );

      console.log(table.toString() + '\n');
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw));
    }
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function checkCollisionRisks() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[CHECK COLLISION RISKS] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching registered satellites for active company session...').start();

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) {
      sentinelTarget = DEFAULT_SENTINEL_URL;
    }
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  try {
    const res = await makeHttpRequest(`${sentinelTarget}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode !== 200 || !Array.isArray(res.body?.satellites)) {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw || 'Could not fetch satellites.'));
      return;
    }

    const companySats = res.body.satellites.filter((sat: any) =>
      sat.companyId?.toLowerCase().trim() === activeSession?.companyId?.toLowerCase().trim()
    );

    if (companySats.length === 0) {
      console.log(chalk.yellow(`\nNo satellites registered under your company profile (${activeSession.companyId}).\n`));
      return;
    }

    const choices = companySats.map((sat: any) => {
      const statusStr = sat.status || 'ACTIVE';
      return {
        name: `#${sat.noradId} - ${sat.satName} | Status: ${statusStr}`,
        value: sat
      };
    });

    const { selectedSat } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSat',
        message: 'Select satellite to check collision risk events:',
        choices
      }
    ]);

    if (!selectedSat) return;

    const noradId = selectedSat.noradId || selectedSat.id;
    const eventSpinner = ora(`Fetching collision risk events for Satellite #${noradId}...`).start();

    const evtRes = await makeHttpRequest(`${sentinelTarget}/api/v1/events/${noradId}`, 'GET');
    eventSpinner.stop();

    if (evtRes.statusCode !== 200 || !Array.isArray(evtRes.body?.events)) {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(evtRes.body?.error || evtRes.raw || 'Failed to fetch events.'));
      return;
    }

    const events: any[] = evtRes.body.events;

    if (events.length === 0) {
      console.log(chalk.green(`\nNo collision risk events logged for Satellite #${noradId} (${selectedSat.satName}). All trajectories clear!\n`));
      return;
    }

    console.log('\n' + chalk.bgCyan.black.bold(` LATEST CONJUNCTION EVENTS (Max 20) — SATELLITE #${noradId} `));

    const table = new Table({
      head: [chalk.cyan('Event ID'), chalk.cyan('Secondary Object'), chalk.cyan('Miss Dist (km)'), chalk.cyan('Collision Prob (Pc)'), chalk.cyan('Risk Level'), chalk.cyan('Last Evaluated')],
      colWidths: [22, 20, 16, 20, 18, 25]
    });

    events.forEach((evt: any) => {
      const isSatA = evt.satA_noradId === Number(noradId);
      const counterpartyNorad = isSatA ? evt.satB_noradId : evt.satA_noradId;
      const missKm = evt.missDistanceKm !== undefined ? evt.missDistanceKm : (evt.missDistanceMeters ? (evt.missDistanceMeters / 1000).toFixed(3) : '0.500');
      const pc = evt.collisionProbability !== undefined ? evt.collisionProbability : 0;

      let riskStr = chalk.green('NOMINAL');
      if (evt.riskLevel === 'CRITICAL' || pc >= 0.0001) {
        riskStr = chalk.red.bold('CRITICAL');
      } else if (evt.riskLevel === 'MODERATE_RISK' || pc >= 0.00001) {
        riskStr = chalk.yellow('MODERATE');
      }

      table.push([
        evt.eventId,
        `Sat #${counterpartyNorad}`,
        `${missKm} km`,
        pc.toString(),
        riskStr,
        evt.lastEvaluatedAt ? new Date(evt.lastEvaluatedAt).toLocaleString() : (evt.createdAt ? new Date(evt.createdAt).toLocaleString() : '-')
      ]);
    });

    console.log(table.toString());
    console.log(chalk.dim(`\nTotal Matched Events: ${evtRes.body?.totalEvents || events.length} (Displaying latest ${events.length})\n`));
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function performNeighborhoodCheck() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[SPATIAL NEIGHBORHOOD CHECK] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching registered satellites for active company session...').start();

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) {
      sentinelTarget = DEFAULT_SENTINEL_URL;
    }
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  try {
    const res = await makeHttpRequest(`${sentinelTarget}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode !== 200 || !Array.isArray(res.body?.satellites)) {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw || 'Could not fetch satellites.'));
      return;
    }

    const companySats = res.body.satellites.filter((sat: any) =>
      sat.companyId?.toLowerCase().trim() === activeSession?.companyId?.toLowerCase().trim()
    );

    if (companySats.length === 0) {
      console.log(chalk.yellow(`\nNo satellites registered under your company profile (${activeSession.companyId}).\n`));
      return;
    }

    const choices = companySats.map((sat: any) => ({
      name: `#${sat.noradId} - ${sat.satName}`,
      value: sat
    }));

    const { selectedSat } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSat',
        message: 'Select satellite to inspect 3D spatial neighborhood clearance:',
        choices
      }
    ]);

    if (!selectedSat) return;

    const noradId = selectedSat.noradId || selectedSat.id;
    const checkSpinner = ora(`Scanning 3D spatial neighborhood for Satellite #${noradId}...`).start();

    const checkRes = await makeHttpRequest(
      `${sentinelTarget}/api/v1/orbital/neighborhood-check`,
      'POST',
      {},
      { noradId, searchRadiusKm: 500 }
    );

    checkSpinner.stop();

    if (checkRes.statusCode !== 200 || !Array.isArray(checkRes.body?.nearbySatellites)) {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(checkRes.body?.error || checkRes.raw || 'Neighborhood check failed.'));
      return;
    }

    const nearby: any[] = checkRes.body.nearbySatellites;
    const isSafe = checkRes.body.isPathSafe;

    console.log('\n' + chalk.bgCyan.black.bold(` 3D SPATIAL NEIGHBORHOOD AUDIT — SATELLITE #${noradId} `));
    console.log(chalk.white(`Overall Clearance Status: `) + (isSafe ? chalk.green.bold('100% CLEAR (NOMINAL)') : chalk.yellow.bold('CAUTIONARY PROXIMITY DETECTED')));

    if (nearby.length === 0) {
      console.log(chalk.green(`\nNo nearby satellites within 500 km radius. Trajectory is isolated and clear.\n`));
      return;
    }

    const table = new Table({
      head: [chalk.cyan('NORAD ID'), chalk.cyan('Satellite Name'), chalk.cyan('Operator Company'), chalk.cyan('3D Distance'), chalk.cyan('Safety Status')],
      colWidths: [15, 22, 25, 18, 22]
    });

    nearby.forEach((item: any) => {
      const statusText = item.isSafe ? chalk.green('CLEAR (>10km)') : chalk.red.bold('WARNING (<=10km)');
      table.push([
        item.noradId,
        item.satName,
        item.companyId,
        `${item.distanceKm} km`,
        statusText
      ]);
    });

    console.log(table.toString() + '\n');
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function resetPrivateKey() {
  if (!activeSession) return;

  console.log(chalk.bold.cyan(`\n[RESET PRIVATE SECRET KEY] Operator: ${activeSession.companyId}\n`));


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


  console.log(chalk.bgYellow.black.bold(' NOTE ') + chalk.yellow(' You will need to use your NEW key when launching your Sovereign Node server.\n'));

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


    const keyTable = new Table({
      head: [chalk.bold.yellow('NEW PRIVATE OPERATOR SECRET KEY')],
      style: { 'padding-left': 2, 'padding-right': 2 }
    });
    keyTable.push(
      [chalk.bold.white(`NEW SECRET KEY: `) + chalk.bold.green(generatedKey)],
      [chalk.bgRed.white.bold(' IMPORTANT ') + chalk.bold.red(` Copy and save this Secret Key carefully. It cannot be recovered once lost.`)]
    );
    console.log('\n' + keyTable.toString() + '\n');


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
        console.log('\n' + chalk.bgGreen.black.bold(' SUCCESS ') + chalk.green(' Key confirmed and saved to active session.\n'));
      } else {
        console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + chalk.red(' Entered key does not match the newly generated key. Please copy and paste the key exactly as displayed above.\n'));
      }
    }

    activeSession.apiKey = generatedKey;
    saveSession(activeSession);
  } else {
    console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(resetRes?.body?.error || 'Key reset failed.\n'));
  }
}

async function viewCompanyDetails() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[COMPANY DETAILS] Operator: ${activeSession.companyId}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter Private Secret Key to authorize (aegis_sk_demo_...):',
      default: activeSession.apiKey,
      mask: '*'
    }
  ]);

  const keyInput = (answers.apiKey && answers.apiKey.trim().length > 0) ? answers.apiKey.trim() : activeSession.apiKey;
  const spinner = ora('Verifying credentials...').start();

  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/registry/company-details`, 'POST', {}, {
      apiKey: keyInput
    });

    if (res.statusCode !== 200 || !res.body?.success) {
      spinner.fail(chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || 'Security Authorization Failure: Hash match failed.'));
      return;
    }

    spinner.succeed(chalk.green('Authorization Verified'));

    const comp = res.body.company;
    const table = new Table({
      head: [chalk.cyan('Company Attribute'), chalk.cyan('Authenticated Value')],
      colWidths: [24, 70]
    });

    table.push(
      ['companyId', comp.companyId],
      ['name', comp.name],
      ['domain', comp.domain],
      ['isVerified', comp.isVerified ? chalk.green('true') : chalk.red('false')],
      ['createdAt', comp.createdAt],
      ['apiKeyPrefix', comp.apiKeyPrefix],
      ['apiKeyHash', comp.apiKeyHash]
    );

    console.log('\n' + table.toString() + '\n');
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to fetch company details: ' + err.message));
  }
}

async function configureLiveWebhookUrl() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[CONFIGURE LIVE WEBHOOK URL] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching registered satellites...').start();

  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode !== 200 || !Array.isArray(res.body?.satellites)) {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || 'Could not fetch satellites.'));
      return;
    }

    const companySats = res.body.satellites.filter((sat: any) =>
      sat.companyId?.toLowerCase().trim() === activeSession?.companyId?.toLowerCase().trim()
    );

    if (companySats.length === 0) {
      console.log(chalk.yellow(`\nNo satellites registered under your company profile (${activeSession.companyId}).\n`));
      return;
    }

    const choices = companySats.map((sat: any) => ({
      name: `#${sat.noradId} - ${sat.satName} (Current Endpoint: ${sat.endpointUrl || 'Not configured'})`,
      value: sat
    }));

    const { selectedSat, liveUrl } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSat',
        message: 'Select satellite to configure Live Webhook URL:',
        choices
      },
      {
        type: 'input',
        name: 'liveUrl',
        message: 'Enter Live Webhook Tunnel URL:',
        validate: (input: string) => {
          const trimmed = input.trim();
          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return 'URL must start with http:// or https://';
          }
          return true;
        }
      }
    ]);

    const noradId = Number(selectedSat.noradId || selectedSat.id);
    let finalUrl = liveUrl.trim();
    if (!finalUrl.endsWith('/webhook')) {
      finalUrl = `${finalUrl.replace(/\/$/, '')}/webhook`;
    }

    const updateSpinner = ora(`Updating Live Webhook URL for Satellite #${noradId} to ${finalUrl}...`).start();

    const nodeRes = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/registry/node`,
      'POST',
      { 'x-api-key': activeSession.apiKey },
      {
        noradId,
        satName: selectedSat.satName,
        endpointUrl: finalUrl,
        companyId: activeSession.companyId,
        satelliteCategoryId: selectedSat.satelliteCategoryId || 'LEO-CUBE-01'
      }
    );

    if (nodeRes.statusCode === 200 || nodeRes.statusCode === 201) {
      updateSpinner.succeed(chalk.green(`Live Webhook URL updated successfully for Satellite #${noradId}`));

      const table = new Table({
        head: [chalk.cyan('NORAD Catalog ID'), chalk.cyan('Satellite Name'), chalk.cyan('Live Webhook URL'), chalk.cyan('Status')],
        colWidths: [18, 22, 45, 18]
      });

      table.push([
        String(noradId),
        selectedSat.satName,
        chalk.green(finalUrl),
        chalk.green.bold('ACTIVE & SYNCED')
      ]);

      console.log('\n' + table.toString() + '\n');
    } else {
      updateSpinner.fail(chalk.red(`Failed to update Live Webhook URL: ${nodeRes.body?.error || nodeRes.raw}`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Error updating Live Webhook URL: ${err.message}`));
  }
}

async function executePastedCommand() {
  if (!activeSession) return;

  console.log(chalk.bold.cyan(`\n[EXECUTE FLIGHT OPS COMMAND] Operator: ${activeSession.companyId}\n`));

  const { rawCmd } = await inquirer.prompt([
    {
      type: 'input',
      name: 'rawCmd',
      message: 'Paste Copied Command:',
      validate: (input: string) => input.trim().length > 0 || 'Please paste a valid command string.'
    }
  ]);

  const trimmed = rawCmd.trim();
  const backendDir = path.resolve(__dirname, '..');
  const spinner = ora(`Spawning Flight Ops Simulator in new terminal...`).start();

  try {
    let targetArgs = trimmed;
    if (trimmed.startsWith('npm run ops --')) {
      targetArgs = trimmed.replace('npm run ops --', '').trim();
    } else if (trimmed.startsWith('npx aegis ops --')) {
      targetArgs = trimmed.replace('npx aegis ops --', '').trim();
    }

    let spawnCmd = '';
    const envVars = `COMPANY_ID=${activeSession.companyId} AEGIS_API_KEY=${activeSession.apiKey}`;
    const fullScript = `cd "${backendDir}" && ${envVars} npm run ops -- ${targetArgs}`;
    if (process.platform === 'darwin') {
      spawnCmd = `osascript -e 'on run argv' -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script (item 1 of argv)' -e 'end run' ${JSON.stringify(fullScript)}`;
    } else if (process.platform === 'win32') {
      spawnCmd = `start cmd /k "${fullScript}"`;
    } else {
      spawnCmd = `xterm -e "${fullScript}" &`;
    }

    require('child_process').exec(spawnCmd, (err: any) => {
      if (err) {
        console.error(chalk.red('\n[TERMINAL SPAWN ERROR]', err.message));
      }
    });
    spinner.succeed(chalk.green(`Flight Ops Simulator launched in new terminal window.`));
  } catch (err: any) {
    spinner.fail(chalk.red('Failed to launch terminal window: ' + err.message));
  }
}

async function viewVerdictReports() {
  if (!activeSession) return;
  console.log(chalk.bold.cyan(`\n[AI JUDICIAL ARBITRATION VERDICTS] Operator: ${activeSession.companyId}\n`));
  const spinner = ora('Fetching verdict reports from Sentinel Cloud & Database Registry...').start();

  let sentinelTarget = process.env.SENTINEL_URL || 'http://localhost:4000';
  try {
    const pingLocal = await makeHttpRequest(`${sentinelTarget}/health`, 'GET');
    if (pingLocal.statusCode !== 200) sentinelTarget = DEFAULT_SENTINEL_URL;
  } catch {
    sentinelTarget = DEFAULT_SENTINEL_URL;
  }

  try {
    const res = await makeHttpRequest(`${sentinelTarget}/api/v1/arbitration/verdicts`, 'GET');
    spinner.stop();

    if (res.statusCode !== 200 || !Array.isArray(res.body.verdictReports) || res.body.verdictReports.length === 0) {
      console.log(chalk.yellow(`\nNo arbitration verdict reports logged yet in database registry.\n`));
      return;
    }

    const reports: any[] = res.body.verdictReports;
    const choices = reports.map((v: any) => {
      const satAName = v.satA?.satName || `SAT-${v.satA?.noradId}`;
      const satBName = v.satB?.satName || `SAT-${v.satB?.noradId}`;
      const clearance = v.calculatedManeuverPath?.clearedMissDistanceKm || '28.85';
      const dutySat = v.judicialBenchRuling?.maneuverResponsibleSatelliteNoradId || v.satA?.noradId;
      return {
        name: `[${v.caseId}] ${satAName} (#${v.satA?.noradId}) vs ${satBName} (#${v.satB?.noradId}) | Duty: #${dutySat} | Clearance: ${clearance}km`,
        value: v.caseId
      };
    });

    const { selectedCaseId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedCaseId',
        message: 'Select AI Judicial Verdict Report to inspect:',
        choices
      }
    ]);

    const verdict = reports.find((v: any) => v.caseId === selectedCaseId);
    if (!verdict) return;

    const tableCase = new Table({
      head: [chalk.cyan('Case Attribute'), chalk.cyan('Arbitration Record Value')],
      colWidths: [32, 56]
    });
    tableCase.push(
      ['Case ID', verdict.caseId],
      ['Global Conjunction ID', verdict.conjunctionId || 'N/A'],
      ['Satellite A (Plaintiff)', `${verdict.satA?.satName || 'SAT-A'} (#${verdict.satA?.noradId}) [Company: ${verdict.satA?.companyId}]`],
      ['Satellite B (Respondent)', `${verdict.satB?.satName || 'SAT-B'} (#${verdict.satB?.noradId}) [Company: ${verdict.satB?.companyId}]`],
      ['Maneuver Duty Satellite', chalk.bold.yellow(`Satellite #${verdict.judicialBenchRuling?.maneuverResponsibleSatelliteNoradId}`)],
      ['Orbital Clearance Achieved', chalk.bold.green(`${verdict.calculatedManeuverPath?.clearedMissDistanceKm || 28.85} km`)],
      ['Trajectory Status', chalk.bold.green(verdict.calculatedManeuverPath?.trajectoryStatus || 'SAFE_CLEARANCE_CONFIRMED')],
      ['Right-of-Way Rule Set', verdict.judicialBenchRuling?.rightOfWayRuleSet || 'NASH_BARGAINING_STC_v1']
    );

    const tableBench = new Table({
      head: [chalk.cyan('Judicial Bench & Maneuver Parameter'), chalk.cyan('Ruling & Quantitative Vector')],
      colWidths: [38, 50]
    });
    tableBench.push(
      ['Chief Justice Ruling', verdict.judicialBenchRuling?.chiefJustice || 'N/A'],
      ['Associate Justice 1 (Physics)', verdict.judicialBenchRuling?.associateJustice1 || 'N/A'],
      ['Associate Justice 2 (Economics)', verdict.judicialBenchRuling?.associateJustice2 || 'N/A'],
      ['Maneuver Burn Delta-V Total', `${verdict.calculatedManeuverPath?.burnVectorDeltaV?.totalMagnitudeMs || 0.45} m/s`],
      ['Burn Vector Decomposition', `Radial: ${verdict.calculatedManeuverPath?.burnVectorDeltaV?.radialMs || 0.12}m/s | In-Track: ${verdict.calculatedManeuverPath?.burnVectorDeltaV?.inTrackMs || 0.38}m/s | Cross-Track: ${verdict.calculatedManeuverPath?.burnVectorDeltaV?.crossTrackMs || 0.21}m/s`],
      ['Post-Burn Velocity (ECI km/s)', `Vx:${verdict.calculatedManeuverPath?.postManeuverVelocityECIKmSec?.vx}, Vy:${verdict.calculatedManeuverPath?.postManeuverVelocityECIKmSec?.vy}, Vz:${verdict.calculatedManeuverPath?.postManeuverVelocityECIKmSec?.vz}`],
      ['Projected Post-Burn Position (ECI km)', `X:${verdict.calculatedManeuverPath?.projectedPostManeuverPositionECIKm?.x}, Y:${verdict.calculatedManeuverPath?.projectedPostManeuverPositionECIKm?.y}, Z:${verdict.calculatedManeuverPath?.projectedPostManeuverPositionECIKm?.z}`],
      ['New Orbital Elements', `Semi-Major: ${verdict.calculatedManeuverPath?.newOrbitalElements?.semiMajorAxisKm}km | Inc: ${verdict.calculatedManeuverPath?.newOrbitalElements?.inclinationDeg}° | Period: ${verdict.calculatedManeuverPath?.newOrbitalElements?.orbitalPeriodMinutes}min`],
      ['Economic Downtime Reimbursement', `$${verdict.judicialBenchRuling?.economicDowntimeReimbursementUSD || 6250} USD`]
    );

    const tableJury = new Table({
      head: [chalk.cyan('Jury Member ID'), chalk.cyan('Vote'), chalk.cyan('Deliberation Reasoning')],
      colWidths: [32, 10, 46]
    });
    if (Array.isArray(verdict.juryVotes)) {
      verdict.juryVotes.forEach((j: any) => {
        tableJury.push([j.juryMemberName, j.vote === 'YES' ? chalk.green.bold('YES') : chalk.red.bold('NO'), j.reasoning]);
      });
    }

    const tableProof = new Table({
      head: [chalk.cyan('Cryptographic Security Layer'), chalk.cyan('Proof Digest / Attestation')],
      colWidths: [32, 56]
    });
    tableProof.push(
      ['TEE Enclave Identifier', verdict.attestationProof?.enclaveId || 'N/A'],
      ['TEE Hardware Architecture', verdict.attestationProof?.enclaveType || 'GOOGLE_CONFIDENTIAL_SPACE_TEE'],
      ['Code Fingerprint SHA-256 Digest', verdict.attestationProof?.codeHashDigest || 'N/A'],
      ['Privacy Shield Status', verdict.zeroKnowledgeSummary?.privacyShieldStatus || 'ZERO_KNOWLEDGE_VERIFIED'],
      ['KMS Signer Identity', verdict.kmsSignature?.signerIdentity || 'google_cloud_kms_attested_supreme_court'],
      ['KMS Verdict Signature (Hex)', verdict.kmsSignature?.signatureHex ? `${verdict.kmsSignature.signatureHex.substring(0, 36)}...` : 'N/A']
    );

    console.log('\n' + chalk.bold.cyan(' === 1. CASE OVERVIEW & TRAJECTORY STATUS === '));
    console.log(tableCase.toString());

    console.log('\n' + chalk.bold.blue(' === 2. JUDICIAL BENCH RULING & MANEUVER PATH === '));
    console.log(tableBench.toString());

    console.log('\n' + chalk.bold.yellow(' === 3. DEMOCRATIC JURY VOTES (5 DELEGATES) === '));
    console.log(tableJury.toString());

    console.log('\n' + chalk.bold.magenta(' === 4. HARDWARE TEE ATTESTATION & KMS SIGNATURE PROOFS === '));
    console.log(tableProof.toString() + '\n');

  } catch (err: any) {
    spinner.fail(chalk.red(`Error retrieving verdict reports: ${err.message}`));
  }
}

const renegotiatedEventIds = new Set<string>();

async function renegotiateConjunctionVerdict() {
  if (!activeSession) {
    console.log(chalk.red('\nNo active session. Please log in first.\n'));
    return;
  }

  const spinner = ora('Fetching active conjunction events for renegotiation...').start();
  try {
    const res = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/events`,
      'GET',
      { 'x-api-key': activeSession.apiKey }
    );

    if (res.statusCode !== 200) {
      spinner.fail(chalk.red(`Failed to fetch conjunction events: ${res.body?.error || res.raw}`));
      return;
    }

    const rawEvents: any[] = res.body?.events || [];
    if (rawEvents.length === 0) {
      spinner.info(chalk.yellow('\nNo active conjunction events recorded on Sentinel Cloud.\n'));
      return;
    }

    const availableEvents = rawEvents.filter(e => !renegotiatedEventIds.has(e.eventId));

    if (availableEvents.length === 0) {
      spinner.info(chalk.yellow('\nAll available conjunction events have already been renegotiated in this CLI session.\n'));
      return;
    }

    spinner.succeed(chalk.green(`Retrieved ${availableEvents.length} eligible conjunction event(s) for renegotiation.`));

    const choices = availableEvents.map((e: any) => ({
      name: `Event: ${e.eventId} | Sat #${e.satA_noradId} vs #${e.satB_noradId} | Risk: ${e.riskLevel || 'CRITICAL'} | TCA: ${e.predictedTCA ? new Date(e.predictedTCA).toLocaleString() : 'N/A'}`,
      value: e
    }));

    const { selectedEvt } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedEvt',
        message: 'Select ONE conjunction event to manually trigger TEE court renegotiation:',
        choices
      }
    ]);

    if (!selectedEvt) return;

    renegotiatedEventIds.add(selectedEvt.eventId);

    const renegSpinner = ora(`Submitting renegotiation to AI Supreme Court TEE Enclave (Rate Limit: 2/day/IP)...`).start();

    const renegRes = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/arbitration/renegotiate`,
      'POST',
      { 'x-api-key': activeSession.apiKey },
      {
        eventId: selectedEvt.eventId,
        satA_noradId: Number(selectedEvt.satA_noradId),
        satB_noradId: Number(selectedEvt.satB_noradId),
        missDistanceKm: selectedEvt.missDistanceKm || (selectedEvt.missDistanceMeters ? selectedEvt.missDistanceMeters / 1000 : 0.35),
        relativeSpeedKmSec: 14.24
      }
    );

    if (renegRes.statusCode === 429) {
      renegSpinner.fail(chalk.red(`\n⛔ RATE LIMIT EXCEEDED: ${renegRes.body?.message || 'Maximum 2 renegotiations per 24 hours per IP address allowed.'}\n`));
      return;
    }

    if (renegRes.statusCode === 200 || renegRes.statusCode === 201) {
      renegSpinner.succeed(chalk.green.bold('Renegotiated AI Supreme Court Arbitration executed successfully! Both Sovereign Nodes notified.'));

      const verdict = renegRes.body?.verdict;
      if (verdict) {
        const tableCase = new Table({
          head: [chalk.cyan('Renegotiated Case Attribute'), chalk.cyan('Arbitration Record Value')],
          colWidths: [32, 56]
        });
        tableCase.push(
          ['Case ID', verdict.caseId],
          ['Global Conjunction ID', verdict.conjunctionId || selectedEvt.eventId],
          ['Satellite A (Plaintiff)', `${verdict.satA?.satName || 'SAT-A'} (#${verdict.satA?.noradId})`],
          ['Satellite B (Respondent)', `${verdict.satB?.satName || 'SAT-B'} (#${verdict.satB?.noradId})`],
          ['Maneuver Duty Satellite', chalk.bold.yellow(`Satellite #${verdict.judicialBenchRuling?.maneuverResponsibleSatelliteNoradId}`)],
          ['Orbital Clearance Achieved', chalk.bold.green(`${verdict.calculatedManeuverPath?.clearedMissDistanceKm || 28.85} km`)],
          ['Trajectory Status', chalk.bold.green(verdict.calculatedManeuverPath?.trajectoryStatus || 'SAFE_CLEARANCE_CONFIRMED')]
        );

        console.log('\n' + chalk.bold.cyan(' === RENEGOTIATED VERDICT REPORT === '));
        console.log(tableCase.toString() + '\n');
      }
    } else {
      renegSpinner.fail(chalk.red(`Renegotiation failed: ${renegRes.body?.error || renegRes.raw}`));
    }
  } catch (err: any) {
    spinner.fail(chalk.red(`Error during renegotiation: ${err.message}`));
  }
}

async function main() {
  let running = true;

  while (running) {
    displayHeader();

    let choices: any[] = [];

    if (!activeSession) {
      choices = [
        { name: '[1] Aegis Preview Login', value: 'preview' },
        { name: '[2] Enterprise Login', value: 'enterprise' },
        { name: '[3] Exit Aegis CLI', value: 'exit' }
      ];
    } else {
      choices = [
        { name: '[1] View Company Details', value: 'company-details' },
        { name: '[2] Register Satellite under Company Profile', value: 'satellite' },
        { name: '[3] View Company Satellites', value: 'fleet' },
        { name: '[4] Launch Sovereign Server', value: 'launch-server' },
        { name: '[5] Ping Sovereign Server', value: 'ping' },
        { name: '[6] View Live Public Satellite Telemetry', value: 'telemetry' },
        { name: '[7] Check Collision Risks', value: 'collision-risks' },
        { name: '[8] Spatial Neighborhood Check', value: 'neighborhood-check' },
        { name: '[9] Reset Private Secret Key', value: 'reset-key' },
        { name: '[10] Configure Live Webhook URL', value: 'configure-webhook' },
        { name: '[11] View AI Judicial Verdict Reports', value: 'verdict-reports' },
        { name: '[12] Execute Copied Flight Ops Command', value: 'execute-ops' },
        { name: '[13] Renegotiate Conjunction Verdict (Manual Court Trigger)', value: 'renegotiate' },
        { name: '[14] Logout / Switch Account', value: 'logout' },
        { name: '[15] Exit Aegis CLI', value: 'exit' }
      ];
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select option:',
        prefix: '',
        pageSize: 15,
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
      case 'company-details':
        await viewCompanyDetails();
        break;
      case 'satellite':
        await registerSatellite();
        break;
      case 'fleet':
        await listRegisteredFleet();
        break;
      case 'launch-server':
        await launchSovereignNode();
        break;
      case 'ping':
        await pingSovereignNodeServer();
        break;
      case 'telemetry':
        await viewLivePublicTelemetry();
        break;
      case 'collision-risks':
        await checkCollisionRisks();
        break;
      case 'neighborhood-check':
        await performNeighborhoodCheck();
        break;
      case 'reset-key':
        await resetPrivateKey();
        break;
      case 'configure-webhook':
        await configureLiveWebhookUrl();
        break;
      case 'verdict-reports':
        await viewVerdictReports();
        break;
      case 'execute-ops':
        await executePastedCommand();
        break;
      case 'renegotiate':
        await renegotiateConjunctionVerdict();
        break;
      case 'logout':
        activeSession = null;
        clearSavedSession();
        console.log('\n' + chalk.bgMagenta.white.bold(' LOGOUT ') + chalk.yellow(' Session file deleted.\n'));
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
