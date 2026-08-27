import { ShieldAlert, ChevronRight, Cpu, Radio, Zap } from 'lucide-react';

interface DemoCautionNoticeProps {
  onAcknowledge: () => void;
}

export default function DemoCautionNotice({ onAcknowledge }: DemoCautionNoticeProps) {
  return (
    <div className="w-full min-h-screen bg-[#050907] text-white flex items-center justify-center p-6 font-sans font-variant-small-caps selection:bg-emerald-500 selection:text-black">
      <div className="max-w-2xl w-full bg-black/80 p-8 rounded-xl border border-emerald-500/30 backdrop-blur-md space-y-6 shadow-[0_0_30px_rgba(0,255,102,0.15)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-emerald-500/20">
          <ShieldAlert className="w-7 h-7 text-emerald-400" />
          <div>
            <h1 className="text-xl font-normal text-emerald-400 tracking-wider">
              GLIX AEGIS // SANDBOX DEMO ADVISORY
            </h1>
            <p className="text-xs text-gray-400 font-normal mt-0.5">
              Interactive 3D Spacecraft Engineering & Autonomous Multi-Agent Simulation
            </p>
          </div>
        </div>

        {/* Advisory Body Text */}
        <div className="space-y-4 text-xs text-gray-300 font-normal leading-relaxed">
          <p>
            Welcome to the interactive sandbox demonstration of <span className="text-emerald-400 font-normal">GLIX AEGIS</span>. 
            This environment allows space enthusiasts, operators, and judges to visually build, configure, and launch a virtual satellite digital twin.
          </p>

          {/* Feature Equivalence Box */}
          <div className="p-4 rounded bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="text-emerald-400 text-xs tracking-wider">
              PRODUCTION & DEMO ENGINE EQUIVALENCE
            </div>
            <p className="text-gray-300 text-[11px]">
              Every underlying calculation—including coupled mass budgets, propellant consumption ($\Delta v$), power balance, 
              5-Node Neutral Consensus Jury Voting, and Google A2A Agent-to-Agent negotiations—is <span className="text-emerald-300">100% identical</span> in both Demo Sandbox Mode and Production Enterprise Mode.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
            <div className="p-3 rounded bg-black border border-emerald-500/20 flex flex-col gap-1">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> Public Sandbox Demo
              </span>
              <span className="text-gray-400 text-[10px]">
                Interactive 3D Visual CAD Customizer (`Hubble.glb` & STL components).
              </span>
            </div>

            <div className="p-3 rounded bg-black border border-emerald-500/20 flex flex-col gap-1">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" /> Production Enterprise
              </span>
              <span className="text-gray-400 text-[10px]">
                Non-invasive REST Webhooks (`POST /api/aegis/satellite`) & NORAD ID claiming.
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={onAcknowledge}
            className="w-full py-3.5 px-6 rounded bg-white hover:bg-gray-200 text-black font-normal text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)] tracking-wider"
          >
            <span>Acknowledge & Launch Sandbox Customizer</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
