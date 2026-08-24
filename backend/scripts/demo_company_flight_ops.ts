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
  console.log(`  ⏱️  Pushing Internal Telemetry & Policy Updates Every ${intervalSec} Seconds`);
  console.log(`========================================================================\n`);

  let currentFuel = 85.0;

  const pushTelemetry = async () => {
    // Simulate gradual fuel consumption & fluctuating operational parameters
    currentFuel = Math.max(5.0, Number((currentFuel - 0.2).toFixed(1)));
    const payloadDowntimeCost = Math.round(12000 + Math.random() * 8000);
    const recoveryTime = Number((0.8 + Math.random() * 0.8).toFixed(1));

    const fuelMass = Number((currentFuel * 0.18).toFixed(1));
    const covariance = Number((0.04 + Math.random() * 0.05).toFixed(3));
    const secondaryRisk = Number((Math.random() * 0.03).toFixed(4));

    const payload = {
      projectName: 'Glixar-EarthObservation-V1',
      missionPriorityLevel: 7,
      missionDurationDays: 1825,
      daysActiveInOrbit: 452,
      satelliteMassKg: 450,
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
      sensorPayloadSensitivity: false,
      aocsHealthStatus: 'NOMINAL',
      payloadDowntimeCostPerHr: payloadDowntimeCost,
      groundStationRecoveryTimeHr: recoveryTime,
      operatorWorkloadLevel: 'LOW',
      acceptableCollisionThreshold: 0.0001,
      covarianceUncertaintyKm: covariance,
      secondaryConjunctionRiskScore: secondaryRisk,
      sharedDataPrivacyLevel: 'MASKED_COVARIANCE',
      interOperatorCoordinationProtocol: 'LOWEST_DELTA_V_YIELDS',
      licensingJurisdiction: 'FCC/FAA USA (Commercial Space)',
      ballisticCoefficient: Number((450 / (2.2 * 2.5)).toFixed(2)),
      relativeVelocityKmSec: 12.8,
      collisionGeometryAngleDeg: 84.5,
      counterpartyObjectType: 'ACTIVE_SATELLITE',
      isChainedConjunction: false,
      insuranceLiabilityCapUSD: 100000000,
      inSunlight: true,
      positionVectorKm: { x: 6871.2, y: -1240.5, z: 2310.8 },
      velocityVectorKmSec: { vx: 1.24, vy: 6.85, vz: -3.12 },
      missDistanceKm: { total: 0.42, radial: 0.08, inTrack: 0.38, crossTrack: 0.12 },
      timeToClosestApproachTCA: new Date(Date.now() + 14400000).toISOString(),
      nextContactWindowUTC: {
        start: new Date(Date.now() + 1800000).toISOString(),
        end: new Date(Date.now() + 2700000).toISOString()
      },
      operatorManeuverFreezeCutoff: new Date(Date.now() + 7200000).toISOString(),
      covarianceMatrixRIC: [
        [0.08, 0.01, 0.002],
        [0.01, 0.38, 0.005],
        [0.002, 0.005, 0.12]
      ],
      conjunctionId: 'conj-2026-85984-75299-aegis',
      solarFluxIndexF107: 154.2,
      geomagneticIndexAp: 12.0,
      constellationPlaneId: 'SHELL-1-PLANE-A',
      numberOfCoOrbitingAssets: 24,
      isChaserInActiveRendezvous: false,
      cryptographicSignature: 'ecdsa_secp256k1_signature_foc_certified_2026',
      telemetrySource: 'ONBOARD_GPS_NAV',
      dataStalenessToleranceSec: 10800,
      arbitrationTieBreakerHash: '0x9f8a3c2b1e4d5f6a7b8c9d0e1f2a3b4c',
      screeningVolumeRadiusKm: 25.0,
      gnssFixQuality: 'RTK_FIXED'
    };

    try {
      const res = await makeHttpRequest(`${nodeUrl}/api/v1/node/telemetry`, 'POST', payload);
      const ts = new Date().toISOString();

      if (res.statusCode === 200) {
        console.log(`[${ts}] [FLIGHT_OPS_PUSH] Project: ${payload.projectName} (Prio ${payload.missionPriorityLevel}/10) | Orbit: ${payload.daysActiveInOrbit}/${payload.missionDurationDays}d [${payload.nominalOrbitStatus}]`);
        console.log(`                Phys & Propulsion: Mass ${payload.satelliteMassKg}kg (${payload.crossSectionalAreaM2}m²) | ${currentFuel}% fuel (${fuelMass}kg) | ${payload.thrusterType} (${payload.specificImpulseIspSec}s Isp, ${payload.maxThrustNewton}N)`);
        console.log(`                Health & Autonomy: AOCS=${payload.aocsHealthStatus} | Battery=${payload.batteryStateOfChargePercent}% | AutoManeuver=${payload.autonomousManeuverCapable ? 'YES' : 'NO'} | Slew=${payload.maneuverSlewTimeSec}s | Warmup=${payload.propulsionWarmupTimeSec}s`);
        console.log(`                Ops & Protocol: Downtime $${payloadDowntimeCost}/hr | Protocol=${payload.interOperatorCoordinationProtocol} | RiskThreshold=1e-4 -> Node [200 OK]`);
      } else {
        console.log(`[${ts}] [FLIGHT_OPS_PUSH_FAILED] Node HTTP ${res.statusCode}`);
      }
    } catch (err: any) {
      const ts = new Date().toISOString();
      console.log(`[${ts}] [FLIGHT_OPS_ERROR] Could not connect to Sovereign Node at ${nodeUrl}: ${err.message}`);
    }
  };

  // Immediate push then 10-second interval
  await pushTelemetry();
  setInterval(pushTelemetry, intervalSec * 1000);
}

runFlightOpsSimulator().catch(console.error);
