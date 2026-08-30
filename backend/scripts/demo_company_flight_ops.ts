import http from 'http';
import https from 'https';
import { URL } from 'url';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import chalk from 'chalk';

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

function makeHttpRequest(urlStr: string, method: string, data?: any, customHeaders?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = data ? JSON.stringify(data) : '';
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(customHeaders || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runFlightOpsSimulator() {
  const options = parseArgs();
  const port = options.port || process.env.PORT || '4001';
  const nodeUrl = options.url || `http://localhost:${port}`;
  const intervalSec = Number(options.interval || 300);

  let activePassword = (options.pass || options.password || options.secret || process.env.NODE_PASSWORD || '').trim();

  if (!activePassword) {
    console.log('');
    const { passInput } = await inquirer.prompt([
      {
        type: 'password',
        name: 'passInput',
        message: 'Enter Sovereign Server Password:',
        mask: '*'
      }
    ]);
    activePassword = (passInput || '').trim();
  }

  const headerTable = new Table({
    head: ['Flight Operations Status', 'Configuration Value'],
    style: { head: ['cyan', 'bold'], border: ['gray'] }
  });

  headerTable.push(
    ['Target Sovereign Node', nodeUrl],
    ['Telemetry Interval', `${intervalSec} seconds`]
  );

  console.log('\n' + headerTable.toString() + '\n');

  let fetchedSat: any = null;

  const cliNoradId = options.noradId ? Number(options.noradId) : 67689;
  const cliSatName = (options.satName || options.name || 'Aegis Cloud').trim();
  const cliCompany = (options.company || options.c || 'demo-operator').trim();

  fetchedSat = {
    noradId: cliNoradId,
    satName: cliSatName,
    companyId: cliCompany,
    satelliteCategoryTitle: options.category || '',
    satelliteModelKey: options.model || '',
    grossMassKg: Number(options.grossMass || 0),
    dryMassKg: Number(options.dryMass || 0),
    launchPosition: {
      altitudeKm: Number(options.alt || 0),
      inclinationDegrees: Number(options.inc || 0),
      raOfAscendingNodeDegrees: Number(options.raan || 0),
      meanAnomalyDegrees: Number(options.ma || 0),
    }
  };
  console.log(`  ✔ Initialized from Air-Gapped CLI Parameters: ${fetchedSat.satName} (#${fetchedSat.noradId})`);

  const satNoradId = fetchedSat.noradId;
  const satName = fetchedSat.satName;
  const companyId = fetchedSat.companyId;
  const satCategory = fetchedSat.satelliteCategoryTitle;
  const modelKey = fetchedSat.satelliteModelKey;
  const grossMass = fetchedSat.grossMassKg;
  const dryMass = fetchedSat.dryMassKg;

  const pos = fetchedSat.launchPosition;
  const altKm = pos.altitudeKm;
  const incDeg = pos.inclinationDegrees;
  const raanDeg = pos.raOfAscendingNodeDegrees;
  const meanAnomalyDeg = pos.meanAnomalyDegrees;

  let currentFuel = 85.0;

  const pushTelemetry = async () => {

    const elapsedSec = (Date.now() / 1000) % 86400;
    const rKm = 6371 + altKm;
    const meanMotionRadSec = Math.sqrt(398600.4418 / Math.pow(rKm, 3));
    const currentAngleRad = ((meanAnomalyDeg * Math.PI / 180) + meanMotionRadSec * elapsedSec) % (2 * Math.PI);
    const incRad = incDeg * Math.PI / 180;
    const raanRad = raanDeg * Math.PI / 180;


    const xOrb = rKm * Math.cos(currentAngleRad);
    const yOrb = rKm * Math.sin(currentAngleRad);
    const orbitVelMagKmSec = Math.sqrt(398600.4418 / rKm);
    const vxOrb = -orbitVelMagKmSec * Math.sin(currentAngleRad);
    const vyOrb = orbitVelMagKmSec * Math.cos(currentAngleRad);


    const posX = Number((xOrb * Math.cos(raanRad) - yOrb * Math.sin(raanRad) * Math.cos(incRad)).toFixed(2));
    const posY = Number((xOrb * Math.sin(raanRad) + yOrb * Math.cos(raanRad) * Math.cos(incRad)).toFixed(2));
    const posZ = Number((yOrb * Math.sin(incRad)).toFixed(2));

    const velX = Number((vxOrb * Math.cos(raanRad) - vyOrb * Math.sin(raanRad) * Math.cos(incRad)).toFixed(3));
    const velY = Number((vxOrb * Math.sin(raanRad) + vyOrb * Math.cos(raanRad) * Math.cos(incRad)).toFixed(3));
    const velZ = Number((vyOrb * Math.sin(incRad)).toFixed(3));


    currentFuel = Math.max(5.0, Number((currentFuel - 0.1).toFixed(1)));
    const fuelMass = Number(((grossMass - dryMass) * (currentFuel / 100)).toFixed(1));
    const payloadDowntimeCost = Math.round(grossMass * 4.5);
    const recoveryTime = 1.2;
    const covariance = Number((0.045 + (elapsedSec % 100) * 0.0001).toFixed(3));

    const payload = {
      noradId: satNoradId,
      satName,
      companyId,
      projectName: `${satName}-FlightOps`,
      missionPriorityLevel: 7,
      missionDurationDays: 1825,
      daysActiveInOrbit: 452,
      satelliteMassKg: grossMass,
      crossSectionalAreaM2: 2.5,
      ballisticCoefficient: Number((grossMass / (2.2 * 2.5)).toFixed(2)),
      fuelReservePercent: currentFuel,
      fuelMassKg: fuelMass,
      thrusterType: 'CHEMICAL',
      specificImpulseIspSec: 310,
      maxThrustNewton: 22.0,
      maneuverSlewTimeSec: 30,
      propulsionWarmupTimeSec: 5,
      maximumDeltaVCapacity: 5.0,
      dutyCyclePercent: 85.0,
      nominalOrbitStatus: 'IN_NOMINAL_SLOT',
      autonomousManeuverCapable: true,
      timeToClosestApproachTCA: new Date(Date.now() + 14400000).toISOString(),
      nextContactWindowUTC: { start: new Date(Date.now() + 1800000).toISOString(), end: new Date(Date.now() + 2700000).toISOString() },
      operatorManeuverFreezeCutoff: new Date(Date.now() + 3600000).toISOString(),
      operatorWorkloadLevel: 'LOW',
      batteryStateOfChargePercent: 92.5,
      sensorPayloadSensitivity: false,
      aocsHealthStatus: 'NOMINAL',
      payloadDowntimeCostPerHr: payloadDowntimeCost,
      groundStationRecoveryTimeHr: recoveryTime,
      insuranceLiabilityCapUSD: 500000000,
      solarFluxIndexF107: 145.2,
      geomagneticIndexAp: 12.0,
      relativeVelocityKmSec: 14.24,
      collisionGeometryAngleDeg: 42.5,
      acceptableCollisionThreshold: 0.0001,
      covarianceUncertaintyKm: covariance,
      covarianceMatrixRIC: { radial: 0.045, intrack: 0.12, crosstrack: 0.038 },
      secondaryConjunctionRiskScore: 0.000012,
      inSunlight: true,
      positionVectorKm: { x: posX, y: posY, z: posZ },
      velocityVectorKmSec: { vx: velX, vy: velY, vz: velZ },
      missDistanceKm: { total: 0.35, radial: 0.12, intrack: 0.28, crosstrack: 0.15 },
      conjunctionId: `CNJ-2026-${satNoradId}`,
      counterpartyObjectType: 'DEBRIS_UPPER_STAGE',
      isChainedConjunction: false,
      sharedDataPrivacyLevel: 'ZERO_KNOWLEDGE_ENCRYPTED',
      interOperatorCoordinationProtocol: 'NASH_BARGAINING_STC_v1',
      licensingJurisdiction: 'FCC_US_SPACE_COMMAND',
      emergencyContactEndpoint: `http://localhost:${port}/webhook`,
      lastTelemetryUpdateAt: new Date().toISOString(),
      constellationPlaneId: 'PLANE-04-SLOT-12',
      numberOfCoOrbitingAssets: 24,
      isChaserInActiveRendezvous: false,
      cryptographicSignature: 'ecdsa_secp256k1_signature_foc_verified',
      telemetrySource: 'ONBOARD_GNSS_NAV',
      dataStalenessToleranceSec: 300,
      arbitrationTieBreakerHash: '0x8f9e102a3b4c5d6e',
      screeningVolumeRadiusKm: 25.0,
      gnssFixQuality: 'RTK_PRECISION_FIX'
    };

    const reqHeaders: Record<string, string> = {};
    if (activePassword) {
      reqHeaders['x-sovereign-password'] = activePassword;
    }

    try {
      const res = await makeHttpRequest(`${nodeUrl}/api/v1/node/telemetry`, 'POST', payload, reqHeaders);
      const ts = new Date().toISOString();
      const tsTag = chalk.bgBlue.white.bold(` ${ts} `);
      const tagPush = chalk.bgCyan.black.bold(' TELEMETRY PUSH ');
      const codeOk = chalk.bgGreen.black.bold(' 200 OK ');
      const code401 = chalk.bgRed.white.bold(' 401 UNAUTHORIZED ');

      if (res.statusCode === 200) {
        console.log(`\n${tsTag} ${tagPush} ${payload.satName} (#${payload.noradId}) | Alt: ${altKm}km | Prio ${payload.missionPriorityLevel}/10 | Pos: (${posX}, ${posY}, ${posZ})km`);
        console.log(`                Phys & Propulsion: Mass ${grossMass}kg (${dryMass}kg dry) | ${currentFuel}% fuel (${fuelMass}kg) | ${payload.thrusterType} (${payload.specificImpulseIspSec}s Isp, ${payload.maxThrustNewton}N)`);
        console.log(`                Ops & Protocol: Downtime $${payloadDowntimeCost}/hr | Vel: (${velX}, ${velY}, ${velZ})km/s -> Node ${codeOk}\n`);
      } else if (res.statusCode === 401) {
        console.log(`\n${tsTag} ${code401} Sovereign Node rejected telemetry. Sovereign Server Password required via --pass parameter.\n`);
      } else {
        const codeErr = chalk.bgRed.white.bold(` ${res.statusCode} ERROR `);
        console.log(`\n${tsTag} ${codeErr} Node HTTP ${res.statusCode}: ${res.body?.message || JSON.stringify(res.body)}\n`);
      }
    } catch (err: any) {
      const ts = new Date().toISOString();
      const tsTag = chalk.bgBlue.white.bold(` ${ts} `);
      const errTag = chalk.bgRed.white.bold(' FLIGHT OPS ERROR ');
      console.log(`\n${tsTag} ${errTag} Could not connect to Sovereign Node at ${nodeUrl}: ${err.message}\n`);
    }
  };


  await pushTelemetry();
  setInterval(pushTelemetry, intervalSec * 1000);

  if (process.stdin) {
    process.stdin.setEncoding('utf-8');
    process.stdin.resume();
    process.stdin.on('data', async (data) => {
      const input = data.toString().trim().toLowerCase();
      if (input === 'p' || input === 'ping') {
        console.log(`\n[PING_NODE] Sending ping request to Sovereign Node at ${nodeUrl}...`);
        try {
          const res = await makeHttpRequest(`${nodeUrl}/health`, 'GET');
          console.log(`[PING_RESPONSE] Node Health: ${res.statusCode === 200 ? 'ONLINE [200 OK]' : `HTTP ${res.statusCode}`}\n`);
        } catch (e: any) {
          console.log(`[PING_RESPONSE] Node Unreachable: ${e.message}\n`);
        }
      } else if (input === 't' || input === 'telemetry' || input === 'status' || input === '') {
        console.log(`\n[MANUAL_TELEMETRY_PUSH] Triggering immediate telemetry push...`);
        await pushTelemetry();
      }
    });
  }
}

runFlightOpsSimulator().catch(console.error);
