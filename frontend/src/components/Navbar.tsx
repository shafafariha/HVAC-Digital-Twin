'use client';

import React from 'react';
import { RefreshCw, ExternalLink, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { HealthResponse } from '@/lib/types';

interface NavbarProps {
  health: HealthResponse | null;
  onReset: () => void;
  onRun24h: () => void;
  onToggleInputControls: () => void;
  isInputControlsOpen: boolean;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  onReset,
  onRun24h,
  onToggleInputControls,
  isInputControlsOpen,
  isLoading,
}) => {
  const isOnline = health?.status === 'online';

  return (
    <header className="border-b border-sky-100 bg-white shadow-xs sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            HVAC Digital Twin System
          </h1>
          <p className="text-xs text-slate-500">
            Autonomous Control Architecture via Physics-Informed Digital Twin
          </p>
        </div>

        {/* Action Buttons & Input Controls */}
        <div className="flex items-center space-x-3">

          {/* Action Buttons */}
          <button
            onClick={onReset}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
            <span>Reset</span>
          </button>

          <button
            onClick={onRun24h}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            <span>Run 24h Simulation</span>
          </button>

          {/* Input Controls Dropdown Toggle (Opens Downwards) */}
          <button
            onClick={onToggleInputControls}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${
              isInputControlsOpen
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
            }`}
            title="Toggle Calculation Inputs & Simulator Controls (Opens Downwards)"
          >
            <Sliders className={`w-4 h-4 ${isInputControlsOpen ? 'text-white' : 'text-sky-700'}`} />
            <span className="hidden sm:inline">Input Controls</span>
            {isInputControlsOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Swagger Link */}
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-sky-600 transition p-1"
            title="OpenAPI / Swagger Documentation"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
