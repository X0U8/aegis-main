import { supremeCourtEngine, SatelliteCourtState } from '../src/services/supremeCourtEngine';

async function main() {
  console.log(`\n========================================================================`);
  console.log(`  ⚖️  LAUNCHING SUPREME COURT CONFIDENTIAL ARBITRATION TEST...`);
  console.log(`========================================================================\n`);


  const satA: SatelliteCourtState = {
    noradId: 67689,
    satName: 'Aegis Cloud',
    companyId: 'demo-glixar-3192',
    satelliteMassKg: 3454,
    fuelReservePercent: 84.5,
    thrusterType: 'CHEMICAL',
    specificImpulseIspSec: 310,
    maxThrustNewton: 22.0,
    payloadDowntimeCostPerHr: 18500,
    acceptableCollisionThreshold: 0.0001,
    positionVectorKm: { x: 23559.39, y: -5000.95, z: -34592.67 },
    velocityVectorKmSec: { vx: -2.55, vy: -0.251, vz: -1.7 },
    aocsHealthStatus: 'NOMINAL'
  };


  const satB: SatelliteCourtState = {
    noradId: 80559,
    satName: 'Aegis Stars',
    companyId: 'demo-aegis-3378',
    satelliteMassKg: 2850,
    fuelReservePercent: 91.2,
    thrusterType: 'CHEMICAL',
    specificImpulseIspSec: 310,
    maxThrustNewton: 22.0,
    payloadDowntimeCostPerHr: 12400,
    acceptableCollisionThreshold: 0.0001,
    positionVectorKm: { x: 23560.12, y: -5001.28, z: -34593.05 },
    velocityVectorKmSec: { vx: -2.548, vy: -0.250, vz: -1.701 },
    aocsHealthStatus: 'NOMINAL'
  };

  const verdict = await supremeCourtEngine.arbitrateConjunction(satA, satB, 0.35, 14.24);

  console.log(`\n========================================================================`);
  console.log(`  ✔ ARBITRATION COMPLETED SUCCESSFULLY!`);
  console.log(`  📜 Case ID: ${verdict.caseId}`);
  console.log(`  🔒 TEE Enclave Attestation Token: ${verdict.attestationProof.attestationSignatureHex}`);
  console.log(`  🔑 KMS Signature: ${verdict.kmsSignature.signatureHex.substring(0, 32)}...`);
  console.log(`========================================================================\n`);
}

main().catch(console.error);
