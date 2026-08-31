import React from 'react';

interface PageProps {
  onNavigate: (path: string) => void;
}

export default function PrivacyPage({ onNavigate }: PageProps) {
  return (
    <div className="min-h-screen w-full bg-[#040806] text-gray-200 flex flex-col justify-between p-6 md:p-12 font-['Inter',sans-serif] select-text relative">
      {/* Top Header Navbar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between z-20 pb-8 border-b border-gray-800/80 mb-10">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3 cursor-pointer group">
          <span className="text-white text-xl font-medium tracking-wider group-hover:text-blue-400 transition-colors">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-xs text-gray-400 font-normal tracking-wide">
          <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => onNavigate('/privacy')} className="text-white font-medium cursor-pointer border-b border-gray-400 pb-0.5">Privacy Policy</button>
          <button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
          <button onClick={() => onNavigate('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact Us</button>
          <button onClick={() => onNavigate('/')} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ml-2">
            Back to Platform
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto space-y-6 text-sm text-gray-300 font-normal leading-relaxed">

        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-6">
          Privacy Policy
        </h1>

        <p className="text-base text-gray-200 leading-relaxed font-normal">
          Aegis is committed to protecting the privacy and operational confidentiality of satellite operators. This Privacy Policy outlines how telemetry data, court verdicts, and company profiles are collected, processed, and secured.
        </p>

        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-semibold text-white tracking-tight">1. Zero Knowledge Telemetry Architecture</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Proprietary satellite telemetry including fuel reserves, specific impulse ISP figures, and financial downtime costs per hour is kept strictly local on operator managed Sovereign Nodes. During court arbitration trials, telemetry is processed in memory inside hardware encrypted TEE Enclaves without being logged to external third party storage.
          </p>

          <h2 className="text-xl font-semibold text-white tracking-tight">2. Zero Knowledge Public Summaries</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Publicly displayed arbitration reports on the Aegis Web Dashboard use Summary AI to sanitize raw data. Public records display only right of way assignments and cleared safety margins while stripping proprietary company secrets and classified coordinates.
          </p>

          <h2 className="text-xl font-semibold text-white tracking-tight">3. Data Storage and Security Controls</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Public satellite catalog data and cryptographic verdict attestation hashes are stored on persistent database registries. Cryptographic signatures are generated using hardware security modules.
          </p>

          <h2 className="text-xl font-semibold text-white tracking-tight">4. Operator Data Rights and Session Removal</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Operators may delete local CLI session tokens and private node credentials at any time using the Aegis CLI logout command.
          </p>
        </div>

      </main>

      {/* Minimal Footer */}
      <footer className="w-full max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-500 pt-8 border-t border-gray-800/80 mt-12">
        <span>© 2026 Aegis</span>
        <span>Privacy Policy</span>
      </footer>
    </div>
  );
}
