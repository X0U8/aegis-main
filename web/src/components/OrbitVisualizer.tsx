import { useMemo } from 'react';
import { SatelliteModelKey } from './PartViewer3D';
import Earth3DCanvas from './Earth3DCanvas';

interface OrbitVisualizerProps {
  stepKey: SatelliteModelKey;
  orbitCategory: string;
  altitude: string;
  inclination?: string;
  velocity?: string;
  period?: string;
}



function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} Z`;
}

export default function OrbitVisualizer({
  stepKey,
  altitude,
  inclination,
  velocity,
  period,
}: OrbitVisualizerProps) {

  const config = useMemo(() => {
    const strokeColor = '#e2e8f0';

    switch (stepKey) {
      case 'calipso':
        return {
          strokeColor,
          renderMode: 'polar',
          distText: '705 or 663 km',
          orbitType: 'Polar Sun-Sync LEO',
          altitude: altitude || '705 km / 663 km',
          inclination: inclination || '98.2°',
          velocity: velocity || '~7.53 km/s',
          period: period || '98.0 min',
          repeatCycle: '16 Days Repeat',
          animDur: '2.5s',
        };
      case 'aura':
        return {
          strokeColor,
          renderMode: 'polar',
          distText: '705 km',
          orbitType: 'Polar Sun-Sync LEO',
          altitude: altitude || '705 km',
          inclination: inclination || '98.2°',
          velocity: velocity || '~7.50 km/s',
          period: period || '98.8 min',
          repeatCycle: '16 Days Repeat',
          animDur: '2.5s',
        };
      case 'swas':
        return {
          strokeColor,
          renderMode: 'tilted',
          distText: '640 km',
          orbitType: 'Geocentric LEO',
          altitude: altitude || '638 km - 651 km',
          inclination: inclination || '69.9°',
          velocity: velocity || '~7.53 km/s',
          period: period || '97.6 min',
          repeatCycle: '~15 Orbits/Day',
          animDur: '2.6s',
        };
      case 'trmm':
        return {
          strokeColor,
          renderMode: 'tilted',
          distText: '350 km',
          orbitType: 'Drifting LEO',
          altitude: altitude || '350 km - 402 km',
          inclination: inclination || '35.0°',
          velocity: velocity || '~7.67 - ~7.70 km/s',
          period: period || '92.5 min',
          repeatCycle: '46-Day Precession',
          animDur: '2.4s',
        };
      case 'tdrs':
        return {
          strokeColor,
          renderMode: 'geo',
          distText: '35,786 km',
          orbitType: 'Geostationary (GEO)',
          altitude: altitude || '35,786 km',
          inclination: inclination || '0.0°',
          velocity: velocity || '3.07 km/s',
          period: period || '23h 56m 4s',
          repeatCycle: 'Station-Keeping',
          animDur: '6.5s',
        };
      case 'goes':
        return {
          strokeColor,
          renderMode: 'geo',
          distText: '35,786 km',
          orbitType: 'Geostationary (GEO)',
          altitude: altitude || '35,786 km',
          inclination: inclination || '0.0°',
          velocity: velocity || '3.07 km/s',
          period: period || '23h 56m 4s',
          repeatCycle: 'Station-Keeping',
          animDur: '6.5s',
        };
      case 'icesat':
        return {
          strokeColor,
          renderMode: 'polar',
          distText: '600 km',
          orbitType: 'Polar LEO',
          altitude: altitude || '600 km',
          inclination: inclination || '94.0°',
          velocity: velocity || '~7.56 km/s',
          period: period || '96.7 min',
          repeatCycle: 'Cryosphere Mapping',
          animDur: '2.5s',
        };
      case 'cloudsat':
        return {
          strokeColor,
          renderMode: 'polar',
          distText: '705 km',
          orbitType: 'Polar Sun-Sync LEO',
          altitude: altitude || '705 km',
          inclination: inclination || '98.2°',
          velocity: velocity || '~7.50 km/s',
          period: period || '98.8 min',
          repeatCycle: 'Cloud Profiling Radar',
          animDur: '2.5s',
        };
      default:
        return {
          strokeColor,
          renderMode: 'polar',
          distText: '705 km',
          orbitType: 'Low Earth Orbit',
          altitude: '705 km',
          inclination: '98.2°',
          velocity: '~7.50 km/s',
          period: '98 min',
          repeatCycle: '16 Days',
          animDur: '2.5s',
        };
    }
  }, [stepKey, altitude, inclination, velocity, period]);

  const orbitId = `orbit-${stepKey}`;

  return (
    <div className="w-full bg-black/50 border border-gray-800/80 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 relative overflow-visible select-none font-sans">
      {/* Top Header Row */}
      <div className="flex items-center justify-between z-10">
        <span className="text-xs font-normal text-gray-400">Orbit Trajectory</span>
      </div>

      {/* Graphic SVG Orbital Diagram with Bigger Orbit Trajectories */}
      <div className="w-full h-48 relative flex items-center justify-center my-1 z-10 overflow-visible">

        {/* Real 3D Fixed Earth Model Overlay */}
        {config.renderMode === 'heo' ? (
          /* HEO Earth Position at x=55 (17.1875%) */
          <div className="absolute top-1/2 left-[17.1875%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <Earth3DCanvas sizePx={58} interactive={false} />
          </div>
        ) : config.renderMode === 'l1' ? (
          /* L1 Earth Position at x=272 (85.0%) */
          <div className="absolute top-1/2 left-[85%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <Earth3DCanvas sizePx={52} interactive={false} />
          </div>
        ) : (
          /* POLAR / TILTED / GEO Center Earth Position at x=160 (50.0%) */
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <Earth3DCanvas sizePx={68} interactive={false} />
          </div>
        )}

        <svg viewBox="0 0 320 120" className="w-full h-full overflow-visible">
          <defs>
            {/* High Intensity Radiant Sun Solar Glow Gradients */}
            <radialGradient id="sunCoreGrad" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#fef08a" />
              <stop offset="60%" stopColor="#facc15" />
              <stop offset="90%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c2410c" />
            </radialGradient>
            <radialGradient id="sunMidCorona" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
              <stop offset="45%" stopColor="#fbbf24" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sunOuterCorona" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.7" />
              <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#f97316" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
            </radialGradient>

            {/* Radiant Solar Glow Filter */}
            <filter id="sunGlowBlur" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Subtle Whiter-Grey Orbit Glow Filter */}
            <filter id={`orbitGlow-${stepKey}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. POLAR LEO: Expanded Vertical Ellipse (rx=44, ry=56) */}
          {config.renderMode === 'polar' && (
            <g>
              <line x1="160" y1="2" x2="160" y2="118" stroke="#5b7ea6" strokeWidth="0.6" strokeDasharray="1.5 3" opacity="0.4" />

              {/* Expanded Vertical Polar Orbit Path */}
              <path
                id={orbitId}
                d={ellipsePath(160, 60, 44, 56)}
                fill="none"
                stroke={config.strokeColor}
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeOpacity="0.8"
                filter={`url(#orbitGlow-${stepKey})`}
              />

              {/* Satellite dot obeying physics animation speed */}
              <circle r="2.2" fill="#ffffff" filter={`url(#orbitGlow-${stepKey})`}>
                <animateMotion dur={config.animDur} repeatCount="indefinite">
                  <mpath href={`#${orbitId}`} />
                </animateMotion>
              </circle>

              {/* Dotted measuring line ends EXACTLY on orbital line at x=204 */}
              <line x1="160" y1="60" x2="204" y2="60" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
              <text x="236" y="62" fill="#cbd5e1" fontSize="6" fontFamily="sans-serif" textAnchor="middle" opacity="0.85">
                {config.distText}
              </text>
            </g>
          )}

          {/* 2. TILTED / LOW LEO: Expanded Tilted Ellipse (rx=84, ry=32) */}
          {config.renderMode === 'tilted' && (
            <g>
              {/* Tilted Inclined Orbit Path */}
              <g transform="rotate(-25 160 60)">
                <path
                  id={orbitId}
                  d={ellipsePath(160, 60, 84, 32)}
                  fill="none"
                  stroke={config.strokeColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  strokeOpacity="0.8"
                  filter={`url(#orbitGlow-${stepKey})`}
                />
                <circle r="2.2" fill="#ffffff" filter={`url(#orbitGlow-${stepKey})`}>
                  <animateMotion dur={config.animDur} repeatCount="indefinite">
                    <mpath href={`#${orbitId}`} />
                  </animateMotion>
                </circle>
              </g>

              {/* Distance Marker Line & Label */}
              <line x1="160" y1="60" x2="236" y2="24" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
              <text x="254" y="20" fill="#cbd5e1" fontSize="6" fontFamily="sans-serif" textAnchor="middle" opacity="0.85">
                {config.distText}
              </text>
            </g>
          )}

          {/* 3. GEOSTATIONARY (GEO): Expanded Equatorial GEO Ring (rx=126, ry=40) */}
          {config.renderMode === 'geo' && (
            <g>
              {/* Wide Equatorial GEO Ring */}
              <path
                id={orbitId}
                d={ellipsePath(160, 60, 126, 40)}
                fill="none"
                stroke={config.strokeColor}
                strokeWidth="1.2"
                strokeDasharray="4 3"
                strokeOpacity="0.8"
                filter={`url(#orbitGlow-${stepKey})`}
              />

              <circle r="2.2" fill="#ffffff" filter={`url(#orbitGlow-${stepKey})`}>
                <animateMotion dur={config.animDur} repeatCount="indefinite">
                  <mpath href={`#${orbitId}`} />
                </animateMotion>
              </circle>

              {/* GEO Distance Marker */}
              <line x1="160" y1="60" x2="286" y2="60" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
              <text x="225" y="55" fill="#cbd5e1" fontSize="6" fontFamily="sans-serif" textAnchor="middle" opacity="0.85">
                {config.distText}
              </text>
            </g>
          )}

          {/* 4. HIGH ELLIPTICAL (HEO - TESS): Expanded HEO Ellipse (rx=134, ry=38) */}
          {config.renderMode === 'heo' && (
            <g>
              {/* Moon Marker */}
              <circle cx="240" cy="60" r="9.5" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
              <circle cx="238" cy="58" r="2.8" fill="#94a3b8" opacity="0.6" />
              <circle cx="242" cy="63" r="2.0" fill="#94a3b8" opacity="0.5" />

              {/* Expanded HEO Orbit Ellipse */}
              <path
                id={orbitId}
                d={ellipsePath(150, 60, 134, 38)}
                fill="none"
                stroke={config.strokeColor}
                strokeWidth="1.2"
                strokeDasharray="4 3"
                strokeOpacity="0.8"
                filter={`url(#orbitGlow-${stepKey})`}
              />

              <circle r="2.2" fill="#ffffff" filter={`url(#orbitGlow-${stepKey})`}>
                <animateMotion dur={config.animDur} repeatCount="indefinite">
                  <mpath href={`#${orbitId}`} />
                </animateMotion>
              </circle>

              {/* Center Baseline */}
              <line x1="55" y1="60" x2="240" y2="60" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
              <text x="147.5" y="54" fill="#cbd5e1" fontSize="6" fontFamily="sans-serif" textAnchor="middle" opacity="0.85">
                {config.distText}
              </text>
            </g>
          )}

          {/* 5. L1 LAGRANGE POINT (DSCOVR): Expanded L1 Halo Ring (rx=14, ry=28) */}
          {config.renderMode === 'l1' && (
            <g>
              {/* Sun Outer Solar Glow Aura */}
              <circle cx="42" cy="60" r="70" fill="url(#sunOuterCorona)" filter="url(#sunGlowBlur)" />
              <circle cx="42" cy="60" r="52" fill="url(#sunMidCorona)" />

              {/* Radiant Sun Core */}
              <circle cx="42" cy="60" r="34" fill="url(#sunCoreGrad)" filter="url(#sunGlowBlur)" />
              <circle cx="42" cy="60" r="34" fill="url(#sunCoreGrad)" />

              {/* Sun-Earth Baseline */}
              <line x1="42" y1="60" x2="272" y2="60" stroke="#475569" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />

              {/* L1 Distance Marker Line */}
              <line x1="205" y1="60" x2="272" y2="60" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
              <text x="238.5" y="53" fill="#cbd5e1" fontSize="6" fontFamily="sans-serif" textAnchor="middle" opacity="0.85">
                1.5M km
              </text>

              {/* Expanded L1 Halo Orbit Ring */}
              <g transform="translate(205, 60)">
                <path
                  id={orbitId}
                  d={ellipsePath(0, 0, 14, 28)}
                  fill="none"
                  stroke={config.strokeColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                  strokeOpacity="0.8"
                  filter={`url(#orbitGlow-${stepKey})`}
                />
                <circle r="2.2" fill="#ffffff" filter={`url(#orbitGlow-${stepKey})`}>
                  <animateMotion dur={config.animDur} repeatCount="indefinite">
                    <mpath href={`#${orbitId}`} />
                  </animateMotion>
                </circle>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Connected 2x3 Telemetry Grid Table */}
      <div className="grid grid-cols-2 rounded-lg border border-gray-600/90 bg-black/60 overflow-hidden divide-x divide-y divide-gray-700/90 z-10 text-xs font-normal shadow-sm">
        {/* Cell 1: Type */}
        <div className="p-2.5 flex flex-col justify-center">
          <span className="text-[10px] font-normal text-gray-400 block mb-0.5">Type</span>
          <span className="text-xs font-light text-gray-300 truncate block">{config.orbitType}</span>
        </div>

        {/* Cell 2: Altitude */}
        <div className="p-2.5 flex flex-col justify-center">
          <span className="text-[10px] font-normal text-gray-400 block mb-0.5">Altitude</span>
          <span className="text-xs font-light text-gray-300 truncate block">{config.altitude}</span>
        </div>

        {/* Cell 3: Inclination */}
        <div className="p-2.5 flex flex-col justify-center">
          <span className="text-[10px] font-normal text-gray-400 block mb-0.5">Inclination</span>
          <span className="text-xs font-light text-gray-300 truncate block">{config.inclination}</span>
        </div>

        {/* Cell 4: Velocity */}
        <div className="p-2.5 flex flex-col justify-center">
          <span className="text-[10px] font-normal text-gray-400 block mb-0.5">Velocity</span>
          <span className="text-xs font-light text-gray-300 truncate block">{config.velocity}</span>
        </div>

        {/* Cell 5: Orbit Period */}
        <div className="p-2.5 flex flex-col justify-center">
          <span className="text-[10px] font-normal text-gray-400 block mb-0.5">Orbit Period</span>
          <span className="text-xs font-light text-gray-300 truncate block">{config.period}</span>
        </div>

        {/* Cell 6: Repeat / Regime */}
        <div className="p-2.5 flex flex-col justify-center">
          <span className="text-[10px] font-normal text-gray-400 block mb-0.5">Repeat / Regime</span>
          <span className="text-xs font-light text-gray-300 truncate block">{config.repeatCycle}</span>
        </div>
      </div>
    </div>
  );
}