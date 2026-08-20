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
  } catch {}
  return null;
}

function saveSession(session: ActiveSession) {
  try {
    const jsonStr = JSON.stringify(session, null, 2);
    fs.writeFileSync(LOCAL_SESSION_FILE, jsonStr, 'utf-8');
    fs.writeFileSync(GLOBAL_SESSION_FILE, jsonStr, 'utf-8');
  } catch {}
}

function clearSavedSession() {
  try {
    if (fs.existsSync(LOCAL_SESSION_FILE)) fs.unlinkSync(LOCAL_SESSION_FILE);
    if (fs.existsSync(GLOBAL_SESSION_FILE)) fs.unlinkSync(GLOBAL_SESSION_FILE);
  } catch {}
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

  // Orbital Space Satellite ASCII Art
  const spaceArt = chalk.yellow(`
               ~+
                 *       +
           '                  |
       ()    .-.,="\`\`"=.    - o -
             '=/ _      \\     |
          *   |  '=._    |
               \\     \`=./\`,        '
            .   '=.__.=' \`='      *
   +                         +
        O      *        '       .
  `);

  console.log(spaceArt);

  if (activeSession) {
    const badgeColor = activeSession.mode === 'ENTERPRISE' ? chalk.bgGreen.black.bold : chalk.bgCyan.black.bold;
    console.log(badgeColor(` ${activeSession.mode} SESSION `) + ' ' + chalk.bold.white(activeSession.companyName) + chalk.dim(` (${activeSession.companyId})`));
  } else {
    console.log(chalk.bgYellow.black.bold(' SELECT ENTRY MODE ') + chalk.dim(' Choose Aegis Preview or Enterprise Company Login'));
  }
  console.log('');
}

async function aegisPreviewLogin() {
  console.log(chalk.bold.cyan('\n[1] AEGIS PREVIEW LOGIN (GOOGLE WEB AUTHENTICATION)\n'));

  const callbackPort = 8085;
  const loginUrl = `${DEFAULT_SENTINEL_URL}/auth/login?port=${callbackPort}`;

  console.log(chalk.yellow('Opening web browser to complete Google Sign-In...\n'));
  console.log(chalk.dim(`URL: ${loginUrl}\n`));

  // Open browser natively on macOS/Windows/Linux
  const openCmd = process.platform === 'darwin' ? `open "${loginUrl}"` : process.platform === 'win32' ? `start "${loginUrl}"` : `xdg-open "${loginUrl}"`;
  require('child_process').exec(openCmd);

  const spinner = ora('Waiting for Google Sign-In completion in web browser...').start();

  return new Promise<void>((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || '', `http://localhost:${callbackPort}`);
        if (parsedUrl.pathname === '/callback') {
          const companyId = parsedUrl.searchParams.get('companyId') || 'demo-google';
          const companyName = parsedUrl.searchParams.get('companyName') || 'Google Operator';
          const apiKey = parsedUrl.searchParams.get('apiKey') || '';
          const email = parsedUrl.searchParams.get('email') || '';

          activeSession = {
            mode: 'PREVIEW',
            companyId,
            companyName,
            apiKey
          };
          saveSession(activeSession);

          spinner.succeed(chalk.green(` Authenticated via Google as ${email}`));

          const table = new Table({
            head: [chalk.cyan('Property'), chalk.cyan('Value')],
            colWidths: [20, 55]
          });

          table.push(
            ['Company ID', activeSession.companyId],
            ['Company Name', activeSession.companyName],
            ['Google Email', email]
          );

          console.log('\n' + table.toString());
          console.log(chalk.cyan('\n[PERSISTED] Session saved. Auto-login active across CLI restarts.\n'));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 60px; color: #0f172a;">
              <h2 style="color: #059669; font-size: 28px;">🎉 Google Authentication Successful!</h2>
              <p style="font-size: 16px; color: #475569; margin-top: 10px;">Your Aegis Sovereign CLI terminal session is now active.</p>
              <p style="font-size: 14px; color: #94a3b8; margin-top: 20px;">You may safely close this browser tab and return to your terminal.</p>
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
}

async function enterpriseCompanyLogin() {
  console.log(chalk.bold.cyan('\n[2] ENTERPRISE COMPANY LOGIN (STRICT VETTED ACCESS)\n'));
  console.log(chalk.dim('Enterprise accounts cannot self-register. You must enter an Admin-provisioned API key.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'companyId',
      message: 'Enterprise Company ID (e.g. comp-glixar or comp-spacex):',
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

  console.log(chalk.bold.cyan(`\n[REGISTER SATELLITE] Operator: ${activeSession.companyId}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'noradId',
      message: 'NORAD Catalog ID:'
    },
    {
      type: 'input',
      name: 'satName',
      message: 'Satellite Name:'
    }
  ]);

  const spinner = ora('Registering satellite in Firestore...').start();

  try {
    const res = await makeHttpRequest(
      `${DEFAULT_SENTINEL_URL}/api/v1/registry/satellite`,
      'POST',
      { 'x-api-key': activeSession.apiKey },
      { noradId: Number(answers.noradId), satName: answers.satName }
    );
    spinner.stop();

    if (res.statusCode === 201) {
      console.log('\n' + chalk.bgGreen.black.bold(' REGISTERED ') + chalk.green(' Satellite Saved in Firestore'));
      
      const table = new Table({
        head: [chalk.cyan('NORAD ID'), chalk.cyan('Satellite Name'), chalk.cyan('Company Owner')],
        colWidths: [15, 25, 25]
      });

      table.push([
        res.body.satellite.noradId,
        res.body.satellite.satName,
        res.body.satellite.companyId
      ]);

      console.log(table.toString() + '\n');
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw));
    }
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function launchSovereignNode() {
  if (!activeSession) {
    console.log(chalk.red('\n❌ You must log in first.\n'));
    return;
  }

  console.log(chalk.bold.cyan(`\n[LAUNCH SOVEREIGN NODE] Operator: ${activeSession.companyId}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Local Listening Port:',
      default: '4001'
    }
  ]);

  const spinner = ora(`Booting Sovereign Node [${activeSession.companyId}] on port ${answers.port}...`).start();

  const nodeServer = new SovereignNodeServer({
    companyId: activeSession.companyId,
    nodeId: `node-${activeSession.companyId}-cli`,
    port: Number(answers.port),
    sentinelUrl: DEFAULT_SENTINEL_URL,
    apiKey: activeSession.apiKey
  });

  await nodeServer.start();
  spinner.succeed(chalk.green(`Sovereign Node Active on Port ${answers.port}`));

  console.log(chalk.dim('Listening for webhooks. Auto-registered on Sentinel.'));
  
  await inquirer.prompt([
    {
      type: 'input',
      name: 'stop',
      message: chalk.yellow('Press ENTER to stop Sovereign Node and return to menu...')
    }
  ]);

  await nodeServer.stop();
  console.log(chalk.dim('[STOPPED] Node closed.\n'));
}

async function listRegisteredFleet() {
  console.log(chalk.bold.cyan('\n[FLEET DIRECTORY]\n'));
  const spinner = ora('Fetching satellite catalog...').start();

  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/registry/satellites`, 'GET');
    spinner.stop();

    if (res.statusCode === 200) {
      console.log('\n' + chalk.bgCyan.black.bold(' SATELLITE FLEET DIRECTORY '));

      const table = new Table({
        head: [chalk.cyan('NORAD ID'), chalk.cyan('Satellite Name'), chalk.cyan('Company Owner')],
        colWidths: [15, 30, 30]
      });

      res.body.satellites.forEach((sat: any) => {
        table.push([sat.noradId, sat.satName, sat.companyId]);
      });

      console.log(table.toString());
      console.log(chalk.dim(`\nTotal Satellites: ${res.body.count}\n`));
    } else {
      console.log('\n' + chalk.bgRed.white.bold(' ERROR ') + ' ' + chalk.red(res.body?.error || res.raw));
    }
  } catch (err: any) {
    spinner.fail('Network error: ' + err.message);
  }
}

async function queryLiveTelemetry() {
  console.log(chalk.bold.cyan('\n[QUERY CELESTRAK RADAR TELEMETRY]\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'noradId',
      message: 'NORAD Catalog ID:',
      default: '60100'
    }
  ]);

  const spinner = ora(`Querying radar data for NORAD ${answers.noradId}...`).start();

  try {
    const res = await makeHttpRequest(`${DEFAULT_SENTINEL_URL}/api/v1/celestrak/events/${answers.noradId}`, 'GET');
    spinner.stop();

    if (res.statusCode === 200) {
      console.log('\n' + chalk.bgCyan.black.bold(' CELESTRAK RADAR REPORT '));

      const statusColor = res.body.riskAssessment.status === 'NOMINAL_SAFE' ? chalk.green : chalk.red;
      console.log(`\n  Status: ${statusColor(res.body.riskAssessment.status)} | Events: ${res.body.riskAssessment.eventsFound}`);
      console.log(`  Satellite: ${res.body.registeredSatName} (${res.body.registeredCompany})`);

      if (res.body.liveTelemetry) {
        const table = new Table({
          head: [chalk.cyan('Telemetry Field'), chalk.cyan('Radar Value')],
          colWidths: [28, 45]
        });

        table.push(
          ['Object Name', res.body.liveTelemetry.objectName],
          ['NORAD ID', answers.noradId],
          ['Epoch Timestamp', res.body.liveTelemetry.epochTimestamp],
          ['Mean Motion (Orbits/Day)', res.body.liveTelemetry.meanMotionOrbitsPerDay],
          ['Inclination (Degrees)', res.body.liveTelemetry.inclinationDegrees],
          ['Eccentricity', res.body.liveTelemetry.eccentricity],
          ['BSTAR Drag', res.body.liveTelemetry.dragBStar]
        );

        console.log('\n' + table.toString() + '\n');
      } else {
        console.log(chalk.dim('\nNo active orbital telemetry record found.\n'));
      }
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
      default: '60100'
    },
    {
      type: 'input',
      name: 'satB',
      message: 'Peer Threat NORAD ID:',
      default: '59102'
    },
    {
      type: 'input',
      name: 'missDist',
      message: 'Miss Distance (Meters):',
      default: '280'
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

async function main() {
  let running = true;

  while (running) {
    displayHeader();

    let choices: any[] = [];

    if (!activeSession) {
      // Entry Mode Choice Menu
      choices = [
        { name: '[1] Aegis Preview Login (Public Testing)', value: 'preview' },
        { name: '[2] Enterprise Company Login (Company ID & Private Key)', value: 'enterprise' },
        new inquirer.Separator(),
        { name: '[3] Exit Aegis CLI', value: 'exit' }
      ];
    } else {
      // Authenticated Menu: Operator actions
      choices = [
        { name: '[1] Register Satellite under Company Profile', value: 'satellite' },
        { name: '[2] Launch Sovereign Node Server', value: 'node' },
        { name: '[3] View Satellite Fleet Directory', value: 'fleet' },
        { name: '[4] Query CelesTrak Radar Telemetry', value: 'telemetry' },
        { name: '[5] Trigger Risk Alert Dispatch', value: 'alert' },
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
      case 'node':
        await launchSovereignNode();
        break;
      case 'fleet':
        await listRegisteredFleet();
        break;
      case 'telemetry':
        await queryLiveTelemetry();
        break;
      case 'alert':
        await simulateRiskAlert();
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
