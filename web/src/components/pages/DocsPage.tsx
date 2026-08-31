import React, { useState } from 'react';
import { Copy, Check, ChevronRight, ChevronDown, Search } from 'lucide-react';

interface PageProps {
  onNavigate: (path: string) => void;
}

function CommandLineItem({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1 pt-1">
      <div className="text-xs text-gray-400 font-normal">{label}</div>
      <div className="bg-[#080d0a] border border-gray-800 rounded-lg px-3.5 py-2.5 font-mono text-xs text-gray-200 flex items-center justify-between gap-3 group">
        <span className="text-blue-300 select-all font-mono tracking-wide break-all whitespace-pre-wrap">{command}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded transition-colors cursor-pointer shrink-0 self-start mt-0.5"
          title="Copy command to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function DocsPage({ onNavigate }: PageProps) {
  const [activeSection, setActiveSection] = useState<string>('cli-installation');
  const [filterText, setFilterText] = useState<string>('');
  const [demoExpanded, setDemoExpanded] = useState<boolean>(true);
  const [cliExpanded, setCliExpanded] = useState<boolean>(true);
  const [webappExpanded, setWebappExpanded] = useState<boolean>(true);
  const [serverExpanded, setServerExpanded] = useState<boolean>(true);

  const query = filterText.toLowerCase().trim();
  const matches = (label: string) => {
    if (!query) return true;
    return label.toLowerCase().includes(query);
  };

  const isDemoExpanded = demoExpanded || Boolean(query);
  const isCliExpanded = cliExpanded || Boolean(query);
  const isWebappExpanded = webappExpanded || Boolean(query);
  const isServerExpanded = serverExpanded || Boolean(query);

  return (
    <div className="min-h-screen w-full bg-[#040806] text-gray-200 flex flex-col justify-between font-['Inter',sans-serif] select-text">

      <header className="w-full flex items-center justify-between z-20 px-6 py-4 border-b border-gray-800/80">
        <button onClick={() => onNavigate('/')} className="flex items-center gap-3 cursor-pointer group">
          <span className="text-white text-xl font-medium tracking-wider group-hover:text-blue-400 transition-colors">
            AEGIS
          </span>

        </button>
        <nav className="flex items-center gap-6 text-xs text-gray-400 font-normal tracking-wide">
          <button onClick={() => onNavigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => onNavigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
          <button onClick={() => onNavigate('/docs')} className="text-white font-medium cursor-pointer border-b border-gray-400 pb-0.5">Documentation</button>
          <button onClick={() => onNavigate('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact Us</button>
          <button onClick={() => onNavigate('/')} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ml-2">
            Back to Platform
          </button>
        </nav>
      </header>


      <div className="flex-1 flex w-full max-w-7xl mx-auto">


        <aside className="w-64 border-r border-gray-800/80 p-4 space-y-4 shrink-0 hidden md:block select-none">

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-[#080d0a] border border-gray-800 rounded px-8 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>


          <div className="space-y-1.5 text-xs">

            <div>
              <button
                onClick={() => setDemoExpanded(!demoExpanded)}
                className="w-full flex items-center gap-1.5 text-gray-300 font-medium hover:text-white py-1 cursor-pointer"
              >
                {isDemoExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Demo Version</span>
              </button>

              {isDemoExpanded && (
                <div className="pl-3 space-y-0.5 mt-1">

                  {matches('Aegis Overview') && (
                    <button
                      onClick={() => setActiveSection('overview')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'overview'
                        ? 'bg-blue-900/40 text-blue-300 font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                        }`}
                    >
                      Aegis Overview
                    </button>
                  )}


                  {matches('General Quickstart Guide') && (
                    <button
                      onClick={() => setActiveSection('general-guide')}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'general-guide'
                        ? 'bg-blue-900/40 text-blue-300 font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                        }`}
                    >
                      General Quickstart Guide
                    </button>
                  )}


                  <div>
                    <button
                      onClick={() => setCliExpanded(!cliExpanded)}
                      className="w-full flex items-center gap-1.5 text-gray-300 font-normal hover:text-white px-2.5 py-1.5 cursor-pointer"
                    >
                      {isCliExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>CLI</span>
                    </button>

                    {isCliExpanded && (
                      <div className="pl-4 space-y-0.5">
                        {matches('Installation') && (
                          <button
                            onClick={() => setActiveSection('cli-installation')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-installation'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Installation
                          </button>
                        )}
                        {matches('CLI Login') && (
                          <button
                            onClick={() => setActiveSection('cli-login')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-login'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            CLI Login
                          </button>
                        )}
                        {matches('CLI Menu Options') && (
                          <button
                            onClick={() => setActiveSection('cli-menu-options')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-menu-options'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            CLI Menu Options Reference
                          </button>
                        )}
                        {matches('Private Secret Key') && (
                          <button
                            onClick={() => setActiveSection('cli-private-key')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-private-key'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Private Secret Key
                          </button>
                        )}
                        {matches('Option 1: Company Details') && (
                          <button
                            onClick={() => setActiveSection('cli-company-details')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-company-details'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 1: Company Details
                          </button>
                        )}
                        {matches('Option 2: Register Satellite') && (
                          <button
                            onClick={() => setActiveSection('cli-register-satellite')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-register-satellite'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 2: Register Satellite
                          </button>
                        )}
                        {matches('Option 3: View Company Satellites') && (
                          <button
                            onClick={() => setActiveSection('cli-company-satellites')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-company-satellites'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 3: View Company Satellites
                          </button>
                        )}
                        {matches('Option 4: Launch Sovereign Server') && (
                          <button
                            onClick={() => setActiveSection('cli-launch-server')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-launch-server'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 4: Launch Sovereign Server
                          </button>
                        )}
                        {matches('Option 5: Ping Sovereign Server') && (
                          <button
                            onClick={() => setActiveSection('cli-ping-server')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-ping-server'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 5: Ping Sovereign Server
                          </button>
                        )}
                        {matches('Option 6: View Live Telemetry') && (
                          <button
                            onClick={() => setActiveSection('cli-telemetry')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-telemetry'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 6: View Live Telemetry
                          </button>
                        )}
                        {matches('Option 7: Check Collision Risks') && (
                          <button
                            onClick={() => setActiveSection('cli-collision-risks')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-collision-risks'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 7: Check Collision Risks
                          </button>
                        )}
                        {matches('Option 8: Spatial Neighborhood Check') && (
                          <button
                            onClick={() => setActiveSection('cli-neighborhood-check')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-neighborhood-check'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 8: Spatial Neighborhood Check
                          </button>
                        )}
                        {matches('Option 9: Reset Private Secret Key') && (
                          <button
                            onClick={() => setActiveSection('cli-reset-key')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-reset-key'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 9: Reset Secret Key
                          </button>
                        )}
                        {matches('Option 10: Configure Webhook') && (
                          <button
                            onClick={() => setActiveSection('cli-configure-webhook')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-configure-webhook'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 10: Configure Webhook
                          </button>
                        )}
                        {matches('Option 11: View AI Verdict Reports') && (
                          <button
                            onClick={() => setActiveSection('cli-verdict-reports')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-verdict-reports'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 11: View Verdict Reports
                          </button>
                        )}
                        {matches('Option 12: Execute Flight Ops') && (
                          <button
                            onClick={() => setActiveSection('cli-execute-ops')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-execute-ops'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 12: Execute Flight Ops
                          </button>
                        )}
                        {matches('Option 13: Logout') && (
                          <button
                            onClick={() => setActiveSection('cli-logout')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-logout'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 13: Logout / Switch
                          </button>
                        )}
                        {matches('Option 14: Exit CLI') && (
                          <button
                            onClick={() => setActiveSection('cli-exit')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'cli-exit'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Option 14: Exit Aegis CLI
                          </button>
                        )}
                      </div>
                    )}
                  </div>


                  <div>
                    <button
                      onClick={() => setWebappExpanded(!webappExpanded)}
                      className="w-full flex items-center gap-1.5 text-gray-300 font-normal hover:text-white px-2.5 py-1.5 cursor-pointer"
                    >
                      {isWebappExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>Aegis Webapp</span>
                    </button>

                    {isWebappExpanded && (
                      <div className="pl-4 space-y-0.5">
                        {matches('Webapp Login Page') && (
                          <button
                            onClick={() => setActiveSection('webapp-login')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'webapp-login'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Webapp Login Page
                          </button>
                        )}
                        {matches('Deploying Satellite') && (
                          <button
                            onClick={() => setActiveSection('webapp-deploy')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'webapp-deploy'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Deploying Satellite
                          </button>
                        )}
                      </div>
                    )}
                  </div>


                  <div>
                    <button
                      onClick={() => setServerExpanded(!serverExpanded)}
                      className="w-full flex items-center gap-1.5 text-gray-300 font-normal hover:text-white px-2.5 py-1.5 cursor-pointer"
                    >
                      {isServerExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>Sovereign Server</span>
                    </button>

                    {isServerExpanded && (
                      <div className="pl-4 space-y-0.5">
                        {matches('What is Sovereign Server') && (
                          <button
                            onClick={() => setActiveSection('server-what')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'server-what'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            What is Sovereign Server
                          </button>
                        )}
                        {matches('Architecture Diagram') && (
                          <button
                            onClick={() => setActiveSection('server-diagram')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'server-diagram'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Architecture Diagram
                          </button>
                        )}
                        {matches('Running Sovereign Server') && (
                          <button
                            onClick={() => setActiveSection('server-running')}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'server-running'
                              ? 'bg-blue-900/40 text-blue-300 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                              }`}
                          >
                            Running Sovereign Server
                          </button>
                        )}
                        <button
                          onClick={() => setActiveSection('server-simulator')}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'server-simulator'
                            ? 'bg-blue-900/40 text-blue-300 font-medium'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                            }`}
                        >
                          Preview Telemetry Simulator
                        </button>
                      </div>
                    )}
                  </div>


                  <button
                    onClick={() => setActiveSection('court')}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'court'
                      ? 'bg-blue-900/40 text-blue-300 font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                      }`}
                  >
                    AI Judicial Arbitration
                  </button>


                  <button
                    onClick={() => setActiveSection('spacetrack')}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'spacetrack'
                      ? 'bg-blue-900/40 text-blue-300 font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                      }`}
                  >
                    Space Catalog Data Query
                  </button>


                  <button
                    onClick={() => setActiveSection('verdicts')}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${activeSection === 'verdicts'
                      ? 'bg-blue-900/40 text-blue-300 font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                      }`}
                  >
                    Verdict Reports Registry
                  </button>
                </div>
              )}
            </div>


            <div className="pt-2">
              <div className="flex items-center gap-1.5 text-gray-600 font-medium py-1 px-1 select-none">
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                <span>Enterprise Version</span>
                <span className="text-[10px] bg-gray-900 border border-gray-800 text-gray-500 px-1.5 py-0.2 rounded ml-auto">Soon</span>
              </div>
            </div>
          </div>
        </aside>


        <main className="flex-1 p-6 md:p-10 space-y-6 max-w-3xl">


          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <span>Home</span>
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <span>Documentation</span>
            <ChevronRight className="w-3 h-3 text-gray-600" />
            <span>Demo Version</span>
            <ChevronRight className="w-3 h-3 text-gray-600" />
            {activeSection.startsWith('cli') && (
              <>
                <span>CLI</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </>
            )}
            {activeSection.startsWith('webapp') && (
              <>
                <span>Aegis Webapp</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </>
            )}
            {activeSection.startsWith('server') && (
              <>
                <span>Sovereign Server</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
              </>
            )}
            <span className="text-gray-200 capitalize">
              {activeSection === 'cli-installation' ? 'Installation' :
                activeSection === 'cli-login' ? 'CLI Login' :
                  activeSection === 'server-what' ? 'What is Sovereign Server' :
                    activeSection === 'server-diagram' ? 'Architecture Diagram' :
                      activeSection === 'server-running' ? 'Running Sovereign Server' :
                        activeSection}
            </span>
          </div>


          {activeSection === 'overview' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Aegis Overview</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Aegis is an open source space traffic coordination platform. It resolves satellite collision risks using multi agent AI court arbitration inside hardware encrypted Trusted Execution Environment enclaves.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Satellite operators deploy self hosted Sovereign Nodes to maintain zero knowledge control over proprietary telemetry, fuel reserves, and financial downtime costs.
              </p>
            </div>
          )}


          {activeSection === 'general-guide' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-white tracking-tight">General Quickstart Guide</h1>
                <p className="text-sm text-gray-400">Complete 6-step testing workflow from terminal initialization to 3D virtual satellite deployment.</p>
              </div>


              <div className="flex flex-col items-center space-y-1.5 pt-2">


                <div className="w-full bg-[#080d0a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-900/60 text-blue-300 font-mono text-xs px-2.5 py-1 rounded-full font-bold">01</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Open Aegis CLI</h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">npx aegis-sovereign-cli@latest</p>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-center py-0.5">
                  <div className="w-0.5 h-3 bg-blue-500/40"></div>
                  <div className="text-blue-400 text-xs font-bold font-mono">↓</div>
                </div>


                <div className="w-full bg-[#080d0a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-900/60 text-blue-300 font-mono text-xs px-2.5 py-1 rounded-full font-bold">02</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Register / Login Company Profile</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Select <span className="text-blue-300 font-mono">[1] Preview Login</span> to receive your Secret Key</p>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-center py-0.5">
                  <div className="w-0.5 h-3 bg-blue-500/40"></div>
                  <div className="text-blue-400 text-xs font-bold font-mono">↓</div>
                </div>


                <div className="w-full bg-[#080d0a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-900/60 text-blue-300 font-mono text-xs px-2.5 py-1 rounded-full font-bold">03</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Launch Sovereign Server</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Select <span className="text-blue-300 font-mono">[4] Launch Server</span> on port <span className="text-white font-mono">4001</span></p>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-center py-0.5">
                  <div className="w-0.5 h-3 bg-blue-500/40"></div>
                  <div className="text-blue-400 text-xs font-bold font-mono">↓</div>
                </div>


                <div className="w-full bg-[#080d0a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-900/60 text-blue-300 font-mono text-xs px-2.5 py-1 rounded-full font-bold">04</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Register Satellite Asset</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Bind satellite to <span className="text-white font-mono">http://localhost:4001</span> & pass 5-step verification</p>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-center py-0.5">
                  <div className="w-0.5 h-3 bg-blue-500/40"></div>
                  <div className="text-blue-400 text-xs font-bold font-mono">↓</div>
                </div>


                <div className="w-full bg-[#080d0a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-900/60 text-blue-300 font-mono text-xs px-2.5 py-1 rounded-full font-bold">05</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Open Web Application</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Sign in to web app with the <span className="text-amber-300 font-medium">same Google account / Company ID</span></p>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-center py-0.5">
                  <div className="w-0.5 h-3 bg-emerald-500/40"></div>
                  <div className="text-emerald-400 text-xs font-bold font-mono">↓</div>
                </div>


                <div className="w-full bg-[#080d0a] border border-emerald-900/40 rounded-xl p-4 flex items-center justify-between bg-emerald-950/10 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-900/60 text-emerald-300 font-mono text-xs px-2.5 py-1 rounded-full font-bold">06</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Deploy Satellite Virtually</h3>
                      <p className="text-xs text-gray-300 mt-0.5">Select orbit category & click <span className="text-emerald-400 font-medium">Deploy Satellite</span> onto 3D globe!</p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-bold font-mono">✔</span>
                </div>

              </div>
            </div>
          )}


          {activeSection === 'cli-installation' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">CLI Installation</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Aegis CLI is available globally on package registries. You can run the Aegis CLI directly using package runners or install it globally across your environment:
              </p>
              <div className="space-y-3 pt-1">
                <CommandLineItem label="Run directly via NPX without installation:" command="npx aegis-sovereign-cli@latest" />
                <CommandLineItem label="Launch CLI executable directly:" command="aegis" />
              </div>
            </div>
          )}


          {activeSection === 'cli-login' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">CLI Login</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                When launching Aegis CLI for the first time, choose your entry environment:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 pl-2">
                <li><strong className="text-white">Aegis Preview Login:</strong> Instant sandbox environment for testing proximity alerts, node pings, and TEE arbitration.</li>
                <li><strong className="text-white">Enterprise Login:</strong> Production login for registered satellite organizations connected to live catalog telemetry and production databases.</li>
              </ul>
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-300 mb-2">Example CLI Login Menu:</p>
                <img
                  src="https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-31%20at%201.47.47%E2%80%AFPM.png"
                  alt="Aegis CLI Login Menu"
                  className="w-full max-w-2xl rounded-lg border border-gray-800 shadow-xl"
                />
              </div>
            </div>
          )}

          {activeSection === 'cli-menu-options' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Sovereign CLI Menu Options Reference</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Complete reference guide for all 14 interactive options in the Aegis Sovereign CLI:
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-5 space-y-3.5 font-mono text-xs">
                <div><strong className="text-blue-300">[1] View Company Details:</strong> <span className="text-gray-300 font-sans">Inspect authenticated operator profile, company ID, and API keys.</span></div>
                <div><strong className="text-blue-300">[2] Register Satellite under Company Profile:</strong> <span className="text-gray-300 font-sans">Provision a new satellite asset with 5-step verification.</span></div>
                <div><strong className="text-blue-300">[3] View Company Satellites:</strong> <span className="text-gray-300 font-sans">List registered orbital assets owned by your organization.</span></div>
                <div><strong className="text-blue-300">[4] Launch Sovereign Server:</strong> <span className="text-gray-300 font-sans">Start local node server process with auto-synced live webhook URL.</span></div>
                <div><strong className="text-blue-300">[5] Ping Sovereign Server:</strong> <span className="text-gray-300 font-sans">Test health status, network latency, and attestation for running nodes.</span></div>
                <div><strong className="text-blue-300">[6] View Live Public Satellite Telemetry:</strong> <span className="text-gray-300 font-sans">Stream live orbital vectors, battery, and AOCS health status.</span></div>
                <div><strong className="text-blue-300">[7] Check Collision Risks:</strong> <span className="text-gray-300 font-sans">Inspect active conjunction events, miss distances, and TCA countdowns.</span></div>
                <div><strong className="text-blue-300">[8] Spatial Neighborhood Check:</strong> <span className="text-gray-300 font-sans">Query surrounding orbital shell corridor for sibling space assets.</span></div>
                <div><strong className="text-blue-300">[9] Reset Private Secret Key:</strong> <span className="text-gray-300 font-sans">Generate a new secret key for cryptographic authentication.</span></div>
                <div><strong className="text-blue-300">[10] Configure Live Webhook URL:</strong> <span className="text-gray-300 font-sans">Manually update public webhook endpoint URL for live alerts.</span></div>
                <div><strong className="text-blue-300">[11] View AI Judicial Verdict Reports:</strong> <span className="text-gray-300 font-sans">Inspect multi-agent arbitration verdicts, delta-v burn vectors, and TEE attestation proofs.</span></div>
                <div><strong className="text-blue-300">[12] Execute Copied Flight Ops Command:</strong> <span className="text-gray-300 font-sans">Launch Flight Ops simulator with pre-filled parameters.</span></div>
                <div><strong className="text-blue-300">[13] Logout / Switch Account:</strong> <span className="text-gray-300 font-sans">Clear active session credentials.</span></div>
                <div><strong className="text-blue-300">[14] Exit Aegis CLI:</strong> <span className="text-gray-300 font-sans">Safely terminate CLI process.</span></div>
              </div>
            </div>
          )}


          {activeSection === 'cli-company-details' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 1: Company Details</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[1] View Company Details</code> to inspect your authenticated operator profile from the Sentinel Registry.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  To authorize viewing company profile data, you are prompted to input your Private Secret Key.
                </p>
                <div className="pt-2">
                  <p className="text-xs font-medium text-gray-300 mb-2">Example CLI Company Details Output:</p>
                  <img
                    src="https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-30%20at%202.45.00%E2%80%AFPM.png"
                    alt="Aegis CLI Company Details Output"
                    className="w-full max-w-2xl rounded-lg border border-gray-800 shadow-xl"
                  />
                </div>
              </div>
            </div>
          )}


          {activeSection === 'cli-private-key' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Private Secret Key</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                The Private Secret Key is used to authorize any command or administrative action on your Sovereign Server. Keep your Private Secret Key safe and secure, as it cannot be recovered once lost.
              </p>
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-300 mb-2">Private Secret Key Confirmation Screen:</p>
                <img
                  src="https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-31%20at%202.20.47%E2%80%AFPM.png?updatedAt=1788166465869"
                  alt="Private Secret Key Output"
                  className="w-full max-w-2xl rounded-lg border border-gray-800 shadow-xl"
                />
              </div>
            </div>
          )}


          {activeSection === 'cli-register-satellite' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 2: Register Satellite</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[2] Register Satellite under Company Profile</code> to provision a new satellite asset and bind it to your Sovereign Server.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Interactive Prompts</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300 pl-1">
                    <li><strong className="text-white">Satellite Name:</strong> Name of your satellite asset (5 to 20 characters, e.g. <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">Sample Sat-1</code>).</li>
                    <li><strong className="text-white">Sovereign Server Endpoint URL:</strong> Listening address of your running Sovereign Server (e.g. <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">http://localhost:4001</code>). <span className="text-amber-300 font-medium font-mono text-[11px]">Note: One Sovereign Server can be connected with one satellite only.</span></li>
                    <li><strong className="text-white">Node Security Password:</strong> Access password set on your running Sovereign Server to verify ownership.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Multi-Step Verification Protocol</h3>
                  <p className="text-xs text-gray-300 leading-relaxed mb-2">
                    Before committing satellite registration, the CLI executes strict 5-step cryptographic verification:
                  </p>
                  <ul className="space-y-1 text-xs text-gray-400 font-mono pl-1">
                    <li>1. Sovereign server online</li>
                    <li>2. Private key verified</li>
                    <li>3. Code verified</li>
                    <li>4. Server ownership verified</li>
                    <li>5. Company verified</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-gray-800/60">
                  <p className="text-xs font-medium text-gray-300 mb-2">Example CLI Satellite Registration Verification Output:</p>
                  <img
                    src="https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-30%20at%203.00.13%E2%80%AFPM.png"
                    alt="Register Satellite CLI Verification Output"
                    className="w-full max-w-2xl rounded-lg border border-gray-800 shadow-xl"
                  />
                </div>
              </div>
            </div>
          )}


          {activeSection === 'cli-company-satellites' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 3: View Company Satellites</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[3] View Company Satellites</code> to list and inspect all registered satellite assets belonging to your company profile.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Displays a formatted table showing satellite NORAD ID, name, status, orbital altitude, inclination, and endpoint binding.
                </p>
              </div>
            </div>
          )}


          {activeSection === 'cli-launch-server' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 4: Launch Sovereign Server</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[4] Launch Sovereign Server</code> to launch a dedicated Sovereign Node server process for your company profile.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Interactive Startup Flow</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300 pl-1">
                    <li><strong className="text-white">Port Prompt:</strong> The CLI prompts for your target <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">Local Listening Port</code> (default <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">4001</code>).</li>
                    <li><strong className="text-white">Dedicated Terminal Spawning:</strong> The CLI automatically opens a dedicated terminal window running the Sovereign Node server process pre-configured with your active session credentials.</li>
                    <li><strong className="text-white">Node Security Password:</strong> In the newly spawned terminal window, input your custom <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">Node Security Password</code> to verify ownership and initialize server attestation.</li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-gray-800/60">
                  <CommandLineItem
                    label="Command executed automatically inside spawned terminal window:"
                    command="npm run start:node -- --port 4001"
                  />
                </div>
              </div>
            </div>
          )}


          {activeSection === 'cli-ping-server' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 5: Ping Sovereign Server</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[5] Ping Sovereign Server</code> to test network connectivity, health status, and attestation for any running Sovereign Server node.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Interactive Prompts</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300 pl-1">
                    <li><strong className="text-white">Server Port or URL:</strong> Target port number (e.g. <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">4001</code>) or full HTTP endpoint URL (e.g. <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">http://localhost:4001</code>).</li>
                    <li><strong className="text-white">Node Security Password:</strong> Access password set on that running Sovereign Server to verify ownership.</li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-gray-800/60">
                  <p className="text-xs font-medium text-gray-300 mb-2">Example CLI Sovereign Server Ping Diagnostic Output:</p>
                  <img
                    src="https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-30%20at%203.31.02%E2%80%AFPM.png"
                    alt="Ping Sovereign Server CLI Diagnostic Output"
                    className="w-full max-w-2xl rounded-lg border border-gray-800 shadow-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'cli-telemetry' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 6: View Live Public Satellite Telemetry</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[6] View Live Public Satellite Telemetry</code> to inspect real-time position vectors, velocity components, battery charge levels, and AOCS health status across public space catalog assets.
              </p>
            </div>
          )}

          {activeSection === 'cli-collision-risks' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 7: Check Collision Risks</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[7] Check Collision Risks</code> to query active conjunction events, miss distances, time-to-closest-approach (TCA) countdowns, and probability scores for your registered fleet.
              </p>
            </div>
          )}

          {activeSection === 'cli-neighborhood-check' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 8: Spatial Neighborhood Check</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[8] Spatial Neighborhood Check</code> to query surrounding orbital shell corridors (±50 km altitude window) for sibling space assets and evasive path clearance margins.
              </p>
            </div>
          )}

          {activeSection === 'cli-reset-key' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 9: Reset Private Secret Key</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[9] Reset Private Secret Key</code> to revoke your existing credentials and generate a new private secret key for API authentication and node attestation.
              </p>
            </div>
          )}

          {activeSection === 'cli-configure-webhook' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 10: Configure Live Webhook URL</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[10] Configure Live Webhook URL</code> to update your satellite asset's registered public HTTP webhook endpoint URL for receiving automated real-time alert pushes.
              </p>
            </div>
          )}

          {activeSection === 'cli-verdict-reports' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 11: View AI Judicial Verdict Reports</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[11] View AI Judicial Verdict Reports</code> to inspect past arbitration trial records stored in the Database Registry. Displays 4 structured tables showing Case Overview, Chief Justice & Bench Rulings, 5-Member Jury Votes, and TEE Hardware Attestation Proofs.
              </p>
            </div>
          )}

          {activeSection === 'cli-execute-ops' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 12: Execute Copied Flight Ops Command</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[12] Execute Copied Flight Ops Command</code> to paste a copied simulator command and launch a pre-configured Flight Ops ground station terminal window automatically.
              </p>
            </div>
          )}

          {activeSection === 'cli-logout' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 13: Logout / Switch Account</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[13] Logout / Switch Account</code> to clear active local session token files and return to the main environment login menu.
              </p>
            </div>
          )}

          {activeSection === 'cli-exit' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Option 14: Exit Aegis CLI</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[14] Exit Aegis CLI</code> to safely terminate the CLI process and exit back to your shell prompt.
              </p>
            </div>
          )}


          {activeSection === 'webapp-login' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Webapp Login Page</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                To access your orbital fleet dashboard and virtually deploy registered satellites on the 3D globe visualization, sign in to the web application.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Identity Alignment Requirement</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    You <strong className="text-amber-300 font-medium">must log in with the exact same Google account (or Company ID)</strong> that you used during Aegis CLI registration.
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    This ensures your operator identity matches your registered Sovereign Server nodes, private keys, and virtual satellite assets.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/60">
                  <p className="text-xs font-medium text-gray-300 mb-2">Aegis Webapp Authentication Portal:</p>
                  <img
                    src="https://ik.imagekit.io/my6lpmrjp/Screenshot%202026-08-30%20at%203.35.55%E2%80%AFPM.png"
                    alt="Aegis Webapp Login Page"
                    className="w-full max-w-2xl rounded-lg border border-gray-800 shadow-xl"
                  />
                </div>
              </div>
            </div>
          )}


          {activeSection === 'webapp-deploy' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Deploying Satellite</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Deploying your registered satellite asset onto the live 3D orbital globe is fast and intuitive:
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-3">
                <ol className="list-decimal list-inside space-y-2 text-xs text-gray-300 pl-1">
                  <li>
                    <strong className="text-white">Select Satellite Asset:</strong> Choose any registered satellite from your company fleet list.
                  </li>
                  <li>
                    <strong className="text-white">Choose Orbit Category Type:</strong> Select your desired satellite model category (e.g. Earth Observation, Communications, Navigation, or Deep Space).
                  </li>
                  <li>
                    <strong className="text-white">Deploy Satellite:</strong> Click <span className="text-emerald-400 font-medium">Deploy Satellite</span> to launch your asset into orbit on the 3D globe visualization.
                  </li>
                </ol>
              </div>
            </div>
          )}


          {activeSection === 'server-what' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">What is Sovereign Server</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                A Sovereign Server is a self hosted node deployed on an operator's own cloud or local infrastructure. It acts as the local zero knowledge vault for proprietary satellite data.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Companies run the Sovereign Server on their side to store confidential orbital telemetry, fuel reserve percentages, specific impulse ISP figures, and payload downtime costs. Private operator data never leaves the Sovereign Server until a verified close approach triggers hardware TEE enclave arbitration.
              </p>
            </div>
          )}


          {activeSection === 'server-diagram' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Architecture Diagram</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                The diagram below illustrates how operator Sovereign Nodes connect with company infrastructure and the central Sentinel Gateway:
              </p>


              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-5 font-mono text-xs text-gray-300 overflow-x-auto leading-relaxed">
                <pre>{`
  [ Operator Co. A ]             [ Operator Co. B ]
          │                              │
          ▼                              ▼
┌──────────────────┐           ┌──────────────────┐
│ Sovereign Node A │           │ Sovereign Node B │
│ (Port 4001)      │           │ (Port 4002)      │
│ Private Vault    │           │ Private Vault    │
└─────────┬────────┘           └─────────┬────────┘
          │                              │
          └──────────────┬───────────────┘
                         │ Encrypted RPC
                         ▼
             ┌───────────────────────┐
             │   Sentinel Gateway    │
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ Hardware TEE Enclave  │
             │ Isolated CPU Memory   │
             └───────────────────────┘
                `}</pre>
              </div>
            </div>
          )}


          {activeSection === 'server-running' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Running Sovereign Server</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Satellite operating entities can launch their Sovereign Node server using two deployment methods:
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Option 1 CLI Interactive Deployment</h3>
                  <p className="text-sm text-gray-300 leading-relaxed mb-2">
                    In the Aegis CLI main menu, select Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[3] Launch Sovereign Server</code>. The CLI prompts for your target port and spawns a dedicated terminal window:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300 pl-2 mb-2">
                    <li><strong className="text-white">Local Listening Port:</strong> Target port number (default <code className="bg-[#0e1612] px-1 py-0.5 rounded text-blue-300 font-mono text-[11px]">4001</code>).</li>
                    <li><strong className="text-white">Node Security Password:</strong> In the spawned terminal, set your node access password.</li>
                  </ul>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Upon submitting your password, the server completes cryptographic attestation setup and starts listening immediately.
                  </p>
                </div>

                <div className="pt-2">
                  <h3 className="text-base font-semibold text-white mb-1">Option 2 Direct Terminal Execution</h3>
                  <p className="text-sm text-gray-300 mb-2">
                    Run the Sovereign Node server directly from any terminal window specifying your target port:
                  </p>
                  <CommandLineItem
                    label="Launch Sovereign Node Server on target port 4001:"
                    command="npm run start:node -- --port 4001"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    The process interactively prompts for Company ID, Private Secret Key, and Node Security Password.
                  </p>
                </div>
              </div>
            </div>
          )}


          {activeSection === 'server-simulator' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Preview Telemetry Simulator</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                The Preview Telemetry Simulator enables company operators to test live orbital telemetry ingestion and conjunction screening pipelines against a running Sovereign Server.
              </p>
              <div className="bg-[#080d0a] border border-gray-800 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">Prerequisites & Operation</h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300 pl-1">
                  <li><strong className="text-white">Active Server Required:</strong> Must be executed <span className="text-amber-300 font-medium">after</span> your Sovereign Server is launched and actively listening on port 4001.</li>
                  <li><strong className="text-white">What it Simulates:</strong> Emulates an air-gapped company ground station pushing live orbital position vectors, thruster state, fuel reserve updates, and AOCS health metrics to your local Sovereign Node.</li>
                  <li><strong className="text-white">Telemetry Interval:</strong> Dispatches state vector updates every 300 seconds to simulate real-world satellite flight operations.</li>
                </ul>
                <CommandLineItem
                  label="Push simulated flight telemetry for preview testing (requires active Sovereign Server on port 4001):"
                  command="npm run ops"
                />
              </div>
            </div>
          )}


          {activeSection === 'court' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">AI Judicial Multi-Agent Arbitration</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Deliberations execute inside Hardware Trusted Execution Environment (TEE) Enclaves using 3 AI Supreme Judges and 5 Democratic Jurors powered by AI judicial reasoning models. Launch your Sovereign Server directly from the CLI via Option <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">[4] Launch Sovereign Server</code> or <code className="bg-[#0e1612] px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">npx aegis-sovereign-cli@latest</code>.
              </p>
              <div className="space-y-3">
                <CommandLineItem label="Launch Sovereign CLI to run automated arbitration:" command="npx aegis-sovereign-cli@latest" />
              </div>
            </div>
          )}


          {activeSection === 'spacetrack' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Space Catalog Data Query</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Queries live TLE orbital elements directly from official space catalog registries by NORAD Catalog ID.
              </p>
              <div className="space-y-3">
                <CommandLineItem label="Test Space Catalog Query:" command="npm run spacetrack" />
              </div>
            </div>
          )}


          {activeSection === 'verdicts' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold text-white tracking-tight">Verdict Reports Registry</h1>
              <p className="text-sm text-gray-300 leading-relaxed">
                Verdicts are signed using cryptographic key management services and stored in persistent database registries. Summary AI generates zero knowledge summaries, and Inspector AI audits cases for collusion.
              </p>
            </div>
          )}

        </main>
      </div>


      <footer className="w-full border-t border-gray-800/80 px-6 py-4 text-xs text-gray-500 flex items-center justify-between">
        <span>© 2026 Aegis</span>
      </footer>
    </div>
  );
}
