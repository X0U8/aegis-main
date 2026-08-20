import { celeStrakSocratesService } from '../src/services/celeStrakSocratesService';
import { registryStore } from '../src/services/registryStore';

async function runSocratesTest() {
  console.log('=== TEST: CELESTRAK SOCRATES CONJUNCTION SCREENING ENGINE ===\n');

  // Seed test registered satellites in registryStore
  await registryStore.registerSatellite({ noradId: 58210, companyId: 'comp-planet', satName: 'FLOCK-4P-1' });
  await registryStore.registerNode({ nodeId: 'node-planet-1', companyId: 'comp-planet', endpointUrl: 'http://localhost:4001', publicKeyPem: 'PlanetKey', status: 'ACTIVE' });

  await registryStore.registerSatellite({ noradId: 59102, companyId: 'comp-spacex', satName: 'STARLINK-30142' });
  await registryStore.registerNode({ nodeId: 'node-spacex-1', companyId: 'comp-spacex', endpointUrl: 'http://localhost:4002', publicKeyPem: 'SpaceXKey', status: 'ACTIVE' });

  // Test Event 1: Both Satellites Registered (Scenario 1)
  console.log('1. Processing Conjunction Event: NORAD 58210 (Planet) vs NORAD 59102 (SpaceX)');
  await celeStrakSocratesService.processConjunctionEvent({
    NORAD_CAT_ID_1: 58210,
    NORAD_CAT_ID_2: 59102,
    TCA: new Date(Date.now() + 86400000).toISOString(),
    MIN_DIST_KM: 0.28,
    REL_VEL_KMS: 14.2
  });
  console.log('-------------------------------------------------------------\n');

  // Test Event 2: Only One Satellite Registered (Scenario 2 - Space Debris)
  console.log('2. Processing Conjunction Event: NORAD 58210 (Planet) vs NORAD 99999 (Debris Object)');
  await celeStrakSocratesService.processConjunctionEvent({
    NORAD_CAT_ID_1: 58210,
    NORAD_CAT_ID_2: 99999,
    TCA: new Date(Date.now() + 43200000).toISOString(),
    MIN_DIST_KM: 0.55,
    REL_VEL_KMS: 12.1
  });
  console.log('-------------------------------------------------------------\n');

  // Test Event 3: Neither Satellite Registered (Scenario 3)
  console.log('3. Processing Conjunction Event: NORAD 88888 (Unregistered) vs NORAD 77777 (Unregistered)');
  await celeStrakSocratesService.processConjunctionEvent({
    NORAD_CAT_ID_1: 88888,
    NORAD_CAT_ID_2: 77777,
    TCA: new Date(Date.now() + 21600000).toISOString(),
    MIN_DIST_KM: 0.12,
    REL_VEL_KMS: 13.8
  });
  console.log('-------------------------------------------------------------\n');

  console.log('=== 🎉 CELESTRAK SOCRATES SCREENING TEST COMPLETE ===');
}

runSocratesTest().catch(console.error);
