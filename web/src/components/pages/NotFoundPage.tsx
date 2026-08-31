import React from 'react';

interface PageProps {
  onNavigate: (path: string) => void;
}

export default function NotFoundPage({ onNavigate }: PageProps) {
  return (
    <div className="min-h-screen w-full bg-[#040806] text-white flex flex-col justify-between p-8 font-['Inter',sans-serif] select-none">

      <header className="w-full flex items-center justify-between z-20">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3 cursor-pointer group">
          <span className="text-white text-lg font-normal tracking-[0.25em] group-hover:text-blue-400 transition-colors">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-[11px] text-gray-300/80 font-normal tracking-widest uppercase">
          <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => onNavigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
          <button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
          <button onClick={() => onNavigate('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact Us</button>
        </nav>
      </header>


      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">

        <h1 className="text-3xl font-semibold text-white tracking-tight">
          Orbital Vector Not Found
        </h1>
        <p className="text-xs text-gray-400 leading-relaxed">
          The requested trajectory coordinate or page path does not exist in the space catalog registry.
        </p>
        <button
          onClick={() => onNavigate('/')}
          className="mt-4 bg-white text-black font-medium text-xs px-6 py-2.5 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
        >
          Return to Platform Home
        </button>
      </main>


      <footer className="w-full text-center text-xs text-gray-600 pt-8 border-t border-gray-900">
        © 2026 Aegis
      </footer>
    </div>
  );
}
