'use client';

import React from 'react';
import { Thermometer, Droplets, Zap, Sun, Users, Award, CheckCircle, AlertCircle } from 'lucide-react';
import { StateVector } from '@/lib/types';

interface TelemetryGridProps {
  state: StateVector;
  powerWatts: number;
  reward: number;
}

export const TelemetryGrid: React.FC<TelemetryGridProps> = ({ state, powerWatts, reward }) => {
  const isComfort = state.T_in >= 23.0 && state.T_in <= 27.0;
  const tempDiff = state.T_in - 25.0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* 1. Indoor Temperature - Summary Card in Baby Blue */}
      <div className={`p-4 rounded-xl border text-center transition-all shadow-xs ${
        isComfort 
          ? 'bg-sky-50/90 border-sky-300' 
          : 'bg-amber-50/80 border-amber-200'
      }`}>
        <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-sky-800 mb-1">
          <Thermometer className={`w-4 h-4 ${isComfort ? 'text-sky-700' : 'text-amber-600'}`} />
          <span>Indoor Temperature</span>
        </div>
        <div className="my-1.5 flex items-baseline justify-center space-x-1">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {state.T_in.toFixed(1)}
          </span>
          <span className="text-xs font-semibold text-slate-500">°C</span>
        </div>
        <div className="flex items-center justify-center text-xs">
          {isComfort ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-sky-800 font-medium border border-sky-200 shadow-2xs">
              <CheckCircle className="w-3 h-3 mr-1 text-sky-600" /> Comfort Envelope
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-amber-800 font-medium border border-amber-200 shadow-2xs">
              <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
              {tempDiff > 0 ? `+${tempDiff.toFixed(1)}°C Warm` : `${tempDiff.toFixed(1)}°C Cold`}
            </span>
          )}
        </div>
      </div>

      {/* 2. Indoor Humidity - White Card */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
        <div className="flex items-center justify-center space-x-1.5 text-xs font-medium text-slate-500 mb-1">
          <Droplets className="w-4 h-4 text-sky-500" />
          <span>Indoor Humidity</span>
        </div>
        <div className="my-1.5 flex items-baseline justify-center space-x-1">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {state.H_in.toFixed(1)}
          </span>
          <span className="text-xs font-semibold text-slate-500">%</span>
        </div>
        <div className="text-xs text-slate-500">
          Relative RH: <strong className="text-slate-700">Optimal</strong>
        </div>
      </div>

      {/* 3. Electrical Power Demand - White Card */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
        <div className="flex items-center justify-center space-x-1.5 text-xs font-medium text-slate-500 mb-1">
          <Zap className="w-4 h-4 text-sky-600" />
          <span>Power Demand</span>
        </div>
        <div className="my-1.5 flex items-baseline justify-center space-x-1">
          <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
            {powerWatts.toFixed(0)}
          </span>
          <span className="text-xs font-semibold text-slate-500">W</span>
        </div>
        <div className="text-xs text-slate-500">
          Load: <strong className="text-slate-700 font-mono">{(powerWatts / 1000).toFixed(2)} kW</strong>
        </div>
      </div>

      {/* 4. Ambient Weather Disturbance - White Card */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
        <div className="flex items-center justify-center space-x-1.5 text-xs font-medium text-slate-500 mb-1">
          <Sun className="w-4 h-4 text-sky-500" />
          <span>Ambient Weather</span>
        </div>
        <div className="my-1.5 flex items-baseline justify-center space-x-1">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {state.T_out.toFixed(1)}
          </span>
          <span className="text-xs font-semibold text-slate-500">°C</span>
        </div>
        <div className="text-xs text-slate-500">
          Outdoor RH: <strong className="text-slate-700">{state.H_out.toFixed(0)}%</strong>
        </div>
      </div>

      {/* 5. Building Occupancy - White Card */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
        <div className="flex items-center justify-center space-x-1.5 text-xs font-medium text-slate-500 mb-1">
          <Users className="w-4 h-4 text-sky-600" />
          <span>Occupancy</span>
        </div>
        <div className="my-1.5 flex items-baseline justify-center space-x-1">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {state.Occupancy.toFixed(0)}
          </span>
          <span className="text-xs font-semibold text-slate-500">persons</span>
        </div>
        <div className="text-xs text-slate-500">
          Internal Load: <strong className="text-slate-700">~{(state.Occupancy * 120).toFixed(0)} W</strong>
        </div>
      </div>

      {/* 6. RL Objective Reward - Summary Card in Baby Blue */}
      <div className="p-4 rounded-xl bg-sky-50/90 border border-sky-300 shadow-xs text-center">
        <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-sky-800 mb-1">
          <Award className="w-4 h-4 text-sky-700" />
          <span>RL Objective Reward</span>
        </div>
        <div className="my-1.5 flex items-baseline justify-center space-x-1">
          <span className={`text-3xl font-bold tracking-tight font-mono ${
            reward >= 0 ? 'text-sky-800' : 'text-slate-700'
          }`}>
            {reward.toFixed(3)}
          </span>
        </div>
        <div className="text-xs text-slate-600">
          Formulation: <strong className="text-sky-900">70% Comfort, 30% Energy</strong>
        </div>
      </div>
    </div>
  );
};
