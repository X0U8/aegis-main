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

  const timestamps = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return {
      time: '08:00',
      date: `${day}.${month}`
    };
  });

  return (
    <div className="bg-[#040810]/85 backdrop-blur-xl border border-blue-900/40 rounded-xl p-3 shadow-[0_0_30px_rgba(0,0,0,0.8)] w-[310px] font-mono text-white select-none relative animate-in fade-in duration-200">

      <div className="relative flex items-stretch h-[145px]">

        <div className="flex items-center justify-center w-4 -mr-1">
          <span className="text-[8px] text-gray-400 rotate-[-90deg] whitespace-nowrap font-mono tracking-tighter opacity-80 select-none">
            colision probability / -1.00
          </span>
        </div>


        <div className="flex flex-col justify-between text-[8.5px] text-gray-400 font-mono pr-1.5 pb-5 text-right w-7 select-none leading-none">
          <span>e<sup>-4</sup></span>
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
                y1="8%"
                x2="100%"
                y2="8%"
                stroke="#ff2a85"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.9"
              />


              <path
                d="M 0 8 Q 80 12, 140 30 T 240 75"
                fill="none"
                stroke="#00ff88"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />


              <path
                d="M 0 8 Q 100 10, 160 50 T 185 130"
                fill="none"
                stroke="#00d8ff"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
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
