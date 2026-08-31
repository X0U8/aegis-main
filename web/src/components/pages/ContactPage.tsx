import React from 'react';
import { Mail } from 'lucide-react';

interface PageProps {
  onNavigate: (path: string) => void;
}

export default function ContactPage({ onNavigate }: PageProps) {
  return (
    <div className="min-h-screen w-full bg-[#040806] text-gray-200 flex flex-col justify-between p-6 md:p-12 font-['Inter',sans-serif] select-text relative">

      <header className="w-full max-w-4xl mx-auto flex items-center justify-between z-20 pb-8 border-b border-gray-800/80 mb-10">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3 cursor-pointer group">
          <span className="text-white text-xl font-medium tracking-wider group-hover:text-blue-400 transition-colors">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-xs text-gray-400 font-normal tracking-wide">
          <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => onNavigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
          <button onClick={() => onNavigate('/docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
          <button onClick={() => onNavigate('/contact')} className="text-white font-medium cursor-pointer border-b border-gray-400 pb-0.5">Contact Us</button>
          <button onClick={() => onNavigate('/')} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ml-2">
            Back to Platform
          </button>
        </nav>
      </header>


      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col justify-center items-start space-y-6 text-sm text-gray-300 font-normal leading-relaxed my-auto py-12">
        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-2">
          Contact Us
        </h1>
        <p className="text-base text-gray-300 leading-relaxed font-normal max-w-xl">
          Get in touch directly with our team for operator inquiries, partnerships, or support.
        </p>


        <div className="pt-4">
          <a
            href="mailto:Soham@glixar.com"
            className="inline-flex items-center gap-3 bg-[#080d14]/90 hover:bg-blue-950/40 border border-gray-800 hover:border-blue-500/50 px-6 py-4 rounded-2xl transition-all shadow-2xl group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-base font-medium text-white group-hover:text-blue-300 transition-colors">
              Mail Us
            </span>
          </a>
        </div>
      </main>


      <footer className="w-full max-w-4xl mx-auto pt-12 pb-4 text-xs text-gray-500 flex items-center justify-between border-t border-gray-800/80 mt-12">
        <span>© 2026 Aegis Platform. All rights reserved.</span>
        <span>Space Situational Awareness & Orbital Safety</span>
      </footer>
    </div>
  );
}
