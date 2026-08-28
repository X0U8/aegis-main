import { registryStore } from './registryStore';
import { spaceTrackService } from './spaceTrackService';

export class FleetMonitorService {
  /**
   * Scans all registered satellites in Google Cloud Firestore against live Space-Track / CelesTrak radar data.
   * If a collision threat is detected, saves the event and dispatches webhook alerts to company node URLs.
   */
  public async scanRegisteredFleetRisks(): Promise<{
    satellitesScanned: number;
    threatsFound: number;
    alertsDispatched: number;
    details: any[];
  }> {
    console.log('[FLEET MONITOR] Starting Targeted Fleet Conjunction Scan against Live Space-Track / CelesTrak...');

    const registeredSatellites = await registryStore.getAllSatellites();
    let threatsFoundCount = 0;
    let alertsDispatchedCount = 0;
    const scanDetails: any[] = [];

    for (const sat of registeredSatellites) {
      console.log(`[FLEET MONITOR] Checking NORAD ${sat.noradId} (${sat.satName} - ${sat.companyId})...`);

      const liveTelemetry = await spaceTrackService.fetchLiveGpData(sat.noradId);
      const conjunctions = await spaceTrackService.fetchConjunctionsByNoradId(sat.noradId);

      if (conjunctions.length > 0) {
        threatsFoundCount += conjunctions.length;
        console.warn(` ⚠️ [RISK DETECTED] NORAD ${sat.noradId} has ${conjunctions.length} active conjunction threats!`);

        for (const evt of conjunctions) {
          const dispatched = await spaceTrackService.processConjunctionEvent(evt);
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
