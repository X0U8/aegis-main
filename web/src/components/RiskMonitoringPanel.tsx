import React from 'react';

interface RiskMonitoringPanelProps {
  events?: any[];
  selectedSat?: any;
  riskPercent?: number;
}

export default function RiskMonitoringPanel({
  events = [],
  selectedSat,
  riskPercent = 2
}: RiskMonitoringPanelProps) {
  const activeEvt = events.find(e => Number(e.collisionProbability) > 0.001 || e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH') || events[0];

  const collisionProb = activeEvt?.collisionProbability ? Number(activeEvt.collisionProbability) : (selectedSat ? 0.0892 : 0.000000000000001);
  const isHighRisk = collisionProb > 0.001 || activeEvt?.riskLevel === 'CRITICAL';

  const targetTCA = activeEvt?.predictedTCA ? new Date(activeEvt.predictedTCA).getTime() : Date.now() + 2 * 60 * 60 * 1000;

  const timestamps = Array.from({ length: 5 }).map((_, i) => {
    const offsetMs = (4 - i) * 60 * 60 * 1000;
    const tickTime = new Date(targetTCA - offsetMs);
    const hours = String(tickTime.getHours()).padStart(2, '0');
    const mins = String(tickTime.getMinutes()).padStart(2, '0');
    const day = String(tickTime.getDate()).padStart(2, '0');
    const month = String(tickTime.getMonth() + 1).padStart(2, '0');
    return {
      time: `${hours}:${mins}`,
      date: `${day}.${month}`
    };
  });

  const width = 250;
  const height = 105;
  const minY = 12;
  const maxY = 102;

  const getPointY = (probFactor: number) => {
    const clamped = Math.max(0, Math.min(1, probFactor));
    return maxY - clamped * (maxY - minY);
  };

  let points: { x: number; y: number }[] = [];

  if (isHighRisk) {
    const factor0 = collisionProb * 0.01;
    const factor1 = collisionProb * 0.05;
    const factor2 = collisionProb * 0.20;
    const factor3 = collisionProb * 0.65;
    const factor4 = collisionProb * 1.00;

    points = [
      { x: 10, y: getPointY(factor0) },
      { x: 70, y: getPointY(factor1) },
      { x: 130, y: getPointY(factor2) },
      { x: 190, y: getPointY(factor3) },
      { x: 240, y: getPointY(factor4) }
    ];
  } else {
    points = [
      { x: 10, y: maxY - 5 },
      { x: 70, y: maxY - 6 },
      { x: 130, y: maxY - 5 },
      { x: 190, y: maxY - 7 },
      { x: 240, y: maxY - 6 }
    ];
  }

  const pathD = `M ${points[0].x} ${points[0].y} ` +
    `C ${points[0].x + 30} ${points[0].y}, ${points[1].x - 20} ${points[1].y}, ${points[1].x} ${points[1].y} ` +
    `S ${points[2].x - 20} ${points[2].y}, ${points[2].x} ${points[2].y} ` +
    `S ${points[3].x - 20} ${points[3].y}, ${points[3].x} ${points[3].y} ` +
    `S ${points[4].x - 10} ${points[4].y}, ${points[4].x} ${points[4].y}`;

  return (
    <div className="bg-[#040810]/85 backdrop-blur-xl border border-blue-900/40 rounded-xl p-3 shadow-[0_0_30px_rgba(0,0,0,0.8)] w-[310px] font-mono text-white select-none relative animate-in fade-in duration-200">
      <div className="relative flex items-stretch h-[145px]">
        <div className="flex items-center justify-center w-4 -mr-1">
          <span className="text-[8px] text-gray-400 rotate-[-90deg] whitespace-nowrap font-mono tracking-tighter opacity-80 select-none">
            collision probability / log
          </span>
        </div>

        <div className="flex flex-col justify-between text-[8.5px] text-gray-400 font-mono pr-1.5 pb-5 text-right w-7 select-none leading-none">
          <span className={isHighRisk ? 'text-rose-400 font-bold' : ''}>e<sup>-4</sup></span>
          <span>e<sup>-10</sup></span>
          <span>e<sup>-13</sup></span>
          <span>e<sup>-17</sup></span>
          <span>e<sup>-26</sup></span>
          <span>e<sup>-30</sup></span>
        </div>

        <div className="flex-1 flex flex-col justify-between relative">
          <div className="flex-1 relative bg-[#02050c]/60 rounded border border-gray-800/60 overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-5 pointer-events-none">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`col-${i}`} className="border-r border-blue-900/20 h-full" />
              ))}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`row-${i}`} className="border-b border-blue-900/20 w-full" />
              ))}
            </div>

            <svg className="absolute inset-0 w-full h-full overflow-visible">
              <line
                x1="0"
                y1="12"
                x2="100%"
                y2="12"
                stroke="#ff2a85"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.9"
              />

              <path
                d={pathD}
                fill="none"
                stroke={isHighRisk ? '#ff2a85' : '#00d8ff'}
                strokeWidth="2"
                strokeDasharray={isHighRisk ? 'none' : '4 3'}
              />

              {points.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={idx === 4 && isHighRisk ? 4 : 2.5}
                  fill={isHighRisk ? (idx === 4 ? '#ff2a85' : '#00ff88') : '#00d8ff'}
                />
              ))}
            </svg>
          </div>

          <div className="flex justify-between pt-1 text-[8px] text-gray-400 font-mono leading-tight">
            {timestamps.map((t, idx) => (
              <div key={idx} className="text-center">
                <div>{t.time}</div>
                <div className="text-[7.5px] text-gray-500">{t.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
