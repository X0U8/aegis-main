import React from 'react';

interface PageProps {
  onNavigate: (path: string) => void;
}

export default function PrivacyPage({ onNavigate }: PageProps) {
  return (
    <div className="h-screen w-screen bg-[#040806] text-white flex flex-col justify-between p-8 select-none font-sans font-variant-small-caps relative overflow-hidden">
      {/* Top Header Navbar */}
      <header className="w-full flex items-center justify-between z-20 px-2 py-2">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3 cursor-pointer group">
          <span className="text-white text-base font-normal tracking-[0.25em] font-brand group-hover:text-blue-300 transition-colors">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-[10px] text-gray-400 font-normal tracking-widest uppercase">
          <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => onNavigate('/privacy')} className="text-white font-medium cursor-pointer">Privacy Policy</button>
          <button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
          <button onClick={() => onNavigate('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact Us</button>
        </nav>
      </header>

      {/* Sleek Minimal Content Body */}
      <div className="flex-1 max-w-3xl w-full mx-auto my-6 p-6 bg-black/20 border border-white/10 rounded-xl backdrop-blur-md overflow-y-auto text-[11px] text-gray-400 font-normal leading-relaxed">
        <p className="text-gray-500 italic">
          Add your privacy policy content here...
        </p>
      </div>

      {/* Minimal Footer */}
      <footer className="w-full flex items-center justify-between text-[10px] text-gray-500 font-normal z-20 px-2">
        <span>© 2026 AEGIS Space Domain Intelligence</span>
        <button onClick={() => onNavigate('/')} className="hover:text-gray-300 transition-colors cursor-pointer">
          ← Return to Gateway
        </button>
      </footer>
    </div>
  );
}
