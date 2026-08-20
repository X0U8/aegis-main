import { registryStore } from './registryStore';
import { celeStrakSocratesService } from './celeStrakSocratesService';

export class FleetMonitorService {
  /**
   * Scans all registered satellites in Google Cloud Firestore against live CelesTrak radar data.
   * If a collision threat is detected, saves the event and dispatches webhook alerts to company node URLs.
   */
  public async scanRegisteredFleetRisks(): Promise<{
    satellitesScanned: number;
    threatsFound: number;
    alertsDispatched: number;
    details: any[];
  }> {
    console.log('[FLEET MONITOR] Starting Targeted Fleet Conjunction Scan against Live CelesTrak...');

    const registeredSatellites = await registryStore.getAllSatellites();
    let threatsFoundCount = 0;
    let alertsDispatchedCount = 0;
    const scanDetails: any[] = [];

    for (const sat of registeredSatellites) {
      console.log(`[FLEET MONITOR] Checking NORAD ${sat.noradId} (${sat.satName} - ${sat.companyId})...`);

      // 1. Fetch live orbit telemetry
      const liveTelemetry = await celeStrakSocratesService.fetchLiveGpData(sat.noradId);

      // 2. Fetch CelesTrak SOCRATES conjunctions specifically for this NORAD ID
      const conjunctions = await celeStrakSocratesService.fetchConjunctionsByNoradId(sat.noradId);

      if (conjunctions.length > 0) {
        threatsFoundCount += conjunctions.length;
        console.warn(` ⚠️ [RISK DETECTED] NORAD ${sat.noradId} has ${conjunctions.length} active conjunction threats!`);

        for (const evt of conjunctions) {
          const dispatched = await celeStrakSocratesService.processConjunctionEvent(evt);
          if (dispatched) alertsDispatchedCount++;
        }

        scanDetails.push({
          noradId: sat.noradId,
          satName: sat.satName,
          companyId: sat.companyId,
          status: 'WARNING_RISK_DETECTED',
          eventsFound: conjunctions.length,
          telemetry: liveTelemetry,
          events: conjunctions
        });
      } else {
        console.log(` ✅ [NOMINAL SAFE] NORAD ${sat.noradId} (${sat.satName}) orbit is clear.`);
        scanDetails.push({
          noradId: sat.noradId,
          satName: sat.satName,
          companyId: sat.companyId,
          status: 'NOMINAL_SAFE',
          eventsFound: 0,
          telemetry: liveTelemetry,
          events: []
        });
      }
    }

    console.log(`[FLEET MONITOR COMPLETE] Scanned: ${registeredSatellites.length} Satellites | Threats: ${threatsFoundCount} | Alerts Dispatched: ${alertsDispatchedCount}`);

    return {
      satellitesScanned: registeredSatellites.length,
      threatsFound: threatsFoundCount,
      alertsDispatched: alertsDispatchedCount,
      details: scanDetails
    };
  }
}

export const fleetMonitorService = new FleetMonitorService();
