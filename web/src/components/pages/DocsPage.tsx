import React from 'react';

interface PageProps {
  onNavigate: (path: string) => void;
}

export default function DocsPage({ onNavigate }: PageProps) {
  return (
    <div className="h-screen w-screen bg-[#040806] text-white flex flex-col justify-between p-8 select-none font-sans font-variant-small-caps relative overflow-hidden">
      {/* Top Header Navbar */}
      <header className="w-full flex items-center justify-between z-20 px-4 py-2 border-b border-white/10 pb-4">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3 cursor-pointer group">
          <span className="text-white text-lg font-normal tracking-[0.25em] font-brand group-hover:text-blue-300 transition-colors">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-[11px] text-gray-300/80 font-normal tracking-widest uppercase">
          <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => onNavigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
          <button onClick={() => onNavigate('/docs')} className="text-white font-medium border-b border-white cursor-pointer">Documentation</button>
          <button onClick={() => onNavigate('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact Us</button>
        </nav>
      </header>

      {/* Content Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto my-8 p-8 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-md overflow-y-auto">
        <h1 className="text-xl text-white font-normal tracking-[0.25em] mb-6 border-b border-white/10 pb-4 font-brand">
          DOCUMENTATION
        </h1>
        <div className="text-gray-400 text-xs font-normal leading-relaxed space-y-4">
          <p className="text-gray-500 italic">
            Add your Documentation content here...
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full flex items-center justify-between text-[10px] text-gray-400 font-normal z-20 px-4 border-t border-white/10 pt-4">
        <span>© 2026 AEGIS Space Domain Intelligence. All rights reserved.</span>
        <button onClick={() => onNavigate('/')} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
          Return to Gateway
        </button>
      </footer>
    </div>
  );
}
