import { useState, useEffect, useRef } from "react";

interface MassGaugeProps {
  value: number;
  unit?: string;
  max?: number;
  min?: number;
  size?: number;
  colorTheme?: 'emerald' | 'cyan';
  label?: string;
}


const MIN = 0;
const MAX = 4000;
const START_ANGLE = 140;
const SWEEP = 260;
const CX = 200;
const CY = 200;
const R_OUTER = 160;

function valueToAngle(v: number, minVal = MIN, maxVal = MAX) {
  const t = (v - minVal) / (maxVal - minVal);
  const clamped = Math.min(1, Math.max(0, t));
  return START_ANGLE + clamped * SWEEP;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const start = polar(cx, cy, r, a0);
  const end = polar(cx, cy, r, a1);
  const largeArc = a1 - a0 <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export default function MassGauge({
  value,
  unit = "KG",
  min = MIN,
  max = MAX,
  size = 175,
  colorTheme = 'emerald',
  label,
}: MassGaugeProps) {
  const [animatedVal, setAnimatedVal] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    let startVal = 0;
    const targetVal = Math.min(max, Math.max(min, value));
    const duration = 850;
    const startTime = performance.now();

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetVal - startVal) * easeProgress;
      setAnimatedVal(Math.round(current));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animateStep);
      }
    };

    animRef.current = requestAnimationFrame(animateStep);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, min, max]);

  const needleAngle = valueToAngle(animatedVal, min, max);

  const themeColors = colorTheme === 'cyan' ? {
    stop0: '#38bdf8',
    stop100: '#0284c7',
    needle0: '#38bdf8',
    needle100: '#0284c7',
    filterId: 'cyanGlow-gauge',
    fillId: 'cyanFill-gauge',
    needleId: 'cyanNeedle-gauge',
  } : {
    stop0: '#34d399',
    stop100: '#059669',
    needle0: '#34d399',
    needle100: '#10b981',
    filterId: 'emeraldGlow-gauge',
    fillId: 'emeraldFill-gauge',
    needleId: 'emeraldNeedle-gauge',
  };


  const ticks = Array.from({ length: 17 }).map((_, i) => {
    const v = min + (i * (max - min)) / 16;
    const isMajor = i % 4 === 0;
    const a = valueToAngle(v, min, max);
    const rOuter = R_OUTER - 16;
    const rInner = rOuter - (isMajor ? 12 : 6);
    const p0 = polar(CX, CY, rOuter, a);
    const p1 = polar(CX, CY, rInner, a);

    return (
      <line
        key={`tick-${i}`}
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke={isMajor ? "#71717a" : "#3f3f46"}
        strokeWidth={isMajor ? 2.5 : 1.2}
        strokeLinecap="round"
      />
    );
  });

  return (
    <div className="flex flex-col items-center justify-center select-none font-sans">

      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        className="touch-none select-none drop-shadow-2xl"
      >
        <defs>
          <radialGradient id="faceGrad-gauge" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="70%" stopColor="#0f0f11" />
            <stop offset="100%" stopColor="#040608" />
          </radialGradient>
          <linearGradient id="bezelGrad-gauge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
          <linearGradient id={themeColors.fillId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themeColors.stop0} />
            <stop offset="100%" stopColor={themeColors.stop100} />
          </linearGradient>
          <linearGradient id={themeColors.needleId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={themeColors.needle0} />
            <stop offset="100%" stopColor={themeColors.needle100} />
          </linearGradient>
          <filter id={themeColors.filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>


        <circle cx={CX} cy={CY} r={R_OUTER + 18} fill="url(#bezelGrad-gauge)" />
        <circle cx={CX} cy={CY} r={R_OUTER + 10} fill="#040608" />


        <circle cx={CX} cy={CY} r={R_OUTER} fill="url(#faceGrad-gauge)" stroke="#27272a" strokeWidth="2" />


        <path
          d={arcPath(CX, CY, R_OUTER - 8, START_ANGLE, START_ANGLE + SWEEP)}
          fill="none"
          stroke="#27272a"
          strokeWidth="10"
          strokeLinecap="round"
        />


        {animatedVal > min && (
          <path
            d={arcPath(CX, CY, R_OUTER - 8, START_ANGLE, needleAngle)}
            fill="none"
            stroke={`url(#${themeColors.fillId})`}
            strokeWidth="10"
            strokeLinecap="round"
            filter={`url(#${themeColors.filterId})`}
          />
        )}


        {ticks}


        <g transform={`rotate(${needleAngle}, ${CX}, ${CY})`}>

          <polygon
            points={`${CX - 4},${CY} ${CX},${CY - 6} ${CX + R_OUTER - 30},${CY} ${CX},${CY + 6}`}
            fill={`url(#${themeColors.needleId})`}
            filter={`url(#${themeColors.filterId})`}
          />

          <polygon
            points={`${CX - 4},${CY} ${CX},${CY - 6} ${CX - 26},${CY} ${CX},${CY + 6}`}
            fill="#a1a1aa"
          />
        </g>


        <circle cx={CX} cy={CY} r="12" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
        <circle cx={CX} cy={CY} r="4" fill="#ffffff" />


        <text
          x={CX}
          y={CY + 58}
          textAnchor="middle"
          fill="#f4f4f5"
          fontSize="30"
          fontWeight="700"
          fontFamily="'Roboto Mono', ui-monospace, monospace"
        >
          {animatedVal.toLocaleString()}
        </text>
        <text
          x={CX}
          y={CY + 78}
          textAnchor="middle"
          fill="#a1a1aa"
          fontSize="11"
          letterSpacing="2"
          fontFamily="'Inter', sans-serif"
        >
          {unit}
        </text>
      </svg>


      {label && (
        <span className="text-xs font-normal text-gray-400 mt-1.5">
          {label}
        </span>
      )}
    </div>
  );
}
