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

function makeHttpRequest(urlStr: string, method: string, data?: any): Promise<any> {
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
        'Content-Length': Buffer.byteLength(postData)
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
  const port = options.port || '4001';
  const nodeUrl = options.url || `http://localhost:${port}`;
  const intervalSec = Number(options.interval || 10);

  console.log(`\n========================================================================`);
  console.log(`  🚀 COMPANY FLIGHT OPS SIMULATOR ACTIVE`);
  console.log(`  📡 Target Sovereign Node: ${nodeUrl}`);
  console.log(`  ⏱️  Pushing Telemetry & Policy Updates Every ${intervalSec} Seconds`);
  console.log(`========================================================================\n`);

  let fetchedSat: any = null;


  const cliNoradId = options.noradId ? Number(options.noradId) : null;
  const cliSatName = options.satName || options.name || null;
  const cliCompany = options.company || options.c || null;

  if (cliNoradId || cliSatName) {
    fetchedSat = {
      noradId: cliNoradId || 67689,
      satName: cliSatName || 'Aegis Cloud',
      companyId: cliCompany || 'demo-aegis-3378',
      satelliteCategoryTitle: options.category || 'Geostationary Comms Relay',
      satelliteModelKey: options.model || 'tdrs',
      grossMassKg: Number(options.grossMass || 3454),
      dryMassKg: Number(options.dryMass || 1731),
      launchPosition: {
        altitudeKm: Number(options.alt || 35780),
        inclinationDegrees: Number(options.inc || 98.27),
        raOfAscendingNodeDegrees: Number(options.raan || 180.07),
        meanAnomalyDegrees: Number(options.ma || 100.74),
      }
    };
    console.log(`  ✔ Initialized from Air-Gapped CLI Parameters: ${fetchedSat.satName} (#${fetchedSat.noradId})`);
  } else {
    try {
      const nodeInfoRes = await makeHttpRequest(`${nodeUrl}/api/v1/node/status`, 'GET');
      if (nodeInfoRes.statusCode === 200 && nodeInfoRes.body?.satellites?.length > 0) {
        fetchedSat = nodeInfoRes.body.satellites[0];
        console.log(`  ✔ Bound to Local Sovereign Node Satellite: ${fetchedSat.satName || fetchedSat.name} (#${fetchedSat.noradId})`);
      }
    } catch (err: any) {
      console.log(`  ℹ️ Operating in Local Air-Gapped Mode with baseline telemetry parameters.`);
    }
  }


  const satNoradId = fetchedSat?.noradId || 67689;
  const satName = fetchedSat?.satName || fetchedSat?.name || 'Aegis Cloud';
  const companyId = fetchedSat?.companyId || 'demo-aegis-3378';
  const satCategory = fetchedSat?.satelliteCategoryTitle || 'Geostationary Comms Relay';
  const modelKey = fetchedSat?.satelliteModelKey || 'tdrs';
  const grossMass = fetchedSat?.grossMassKg || 3454;
  const dryMass = fetchedSat?.dryMassKg || 1731;

  const pos = fetchedSat?.launchPosition || {};
  const altKm = typeof pos.altitudeKm === 'number' ? pos.altitudeKm : (Number(options.alt) || 35780);
  const incDeg = typeof pos.inclinationDegrees === 'number' ? pos.inclinationDegrees : (Number(options.inc) || 98.27);
  const raanDeg = typeof pos.raOfAscendingNodeDegrees === 'number' ? pos.raOfAscendingNodeDegrees : (Number(options.raan) || 180.07);
  const meanAnomalyDeg = typeof pos.meanAnomalyDegrees === 'number' ? pos.meanAnomalyDegrees : (Number(options.ma) || 100.74);

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
    const payloadDowntimeCost = Math.round(12000 + Math.random() * 8000);
    const recoveryTime = Number((0.8 + Math.random() * 0.8).toFixed(1));
    const covariance = Number((0.04 + Math.random() * 0.05).toFixed(3));

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
      fuelReservePercent: currentFuel,
      fuelMassKg: fuelMass,
      thrusterType: 'CHEMICAL',
      specificImpulseIspSec: 310,
      maxThrustNewton: 22.0,
      maneuverSlewTimeSec: 30,
      propulsionWarmupTimeSec: 5,
      nominalOrbitStatus: 'IN_NOMINAL_SLOT',
      maximumDeltaVCapacity: 5.0,
      dutyCyclePercent: 85.0,
      autonomousManeuverCapable: true,
      batteryStateOfChargePercent: 92.5,
      aocsHealthStatus: 'NOMINAL',
      payloadDowntimeCostPerHr: payloadDowntimeCost,
      groundStationRecoveryTimeHr: recoveryTime,
      operatorWorkloadLevel: 'LOW',
      acceptableCollisionThreshold: 0.0001,
      covarianceUncertaintyKm: covariance,
      positionVectorKm: { x: posX, y: posY, z: posZ },
      velocityVectorKmSec: { vx: velX, vy: velY, vz: velZ },
      timeToClosestApproachTCA: new Date(Date.now() + 14400000).toISOString(),
      cryptographicSignature: 'ecdsa_secp256k1_signature_foc_certified_2026',
      telemetrySource: 'ONBOARD_GNSS_NAV'
    };

    try {
      const res = await makeHttpRequest(`${nodeUrl}/api/v1/node/telemetry`, 'POST', payload);
      const ts = new Date().toISOString();

      if (res.statusCode === 200) {
        console.log(`[${ts}] [FLIGHT_OPS_PUSH] ${payload.satName} (#${payload.noradId}) | Alt: ${altKm}km | Prio ${payload.missionPriorityLevel}/10 | Pos: (${posX}, ${posY}, ${posZ})km`);
        console.log(`                Phys & Propulsion: Mass ${grossMass}kg (${dryMass}kg dry) | ${currentFuel}% fuel (${fuelMass}kg) | ${payload.thrusterType} (${payload.specificImpulseIspSec}s Isp, ${payload.maxThrustNewton}N)`);
        console.log(`                Ops & Protocol: Downtime $${payloadDowntimeCost}/hr | Vel: (${velX}, ${velY}, ${velZ})km/s -> Node [200 OK]`);
      } else {
        console.log(`[${ts}] [FLIGHT_OPS_PUSH_FAILED] Node HTTP ${res.statusCode}: ${res.body?.message || JSON.stringify(res.body)}`);
      }
    } catch (err: any) {
      const ts = new Date().toISOString();
      console.log(`[${ts}] [FLIGHT_OPS_ERROR] Could not connect to Sovereign Node at ${nodeUrl}: ${err.message}`);
    }
  };


  await pushTelemetry();
  setInterval(pushTelemetry, intervalSec * 1000);
}

runFlightOpsSimulator().catch(console.error);
