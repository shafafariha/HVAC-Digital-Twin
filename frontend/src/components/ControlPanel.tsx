'use client';

import React from 'react';
import { Sliders, Play, Wind, Flame, Snowflake, Power, CloudSun, Users, CheckSquare } from 'lucide-react';
import { ActionParams, StateVector } from '@/lib/types';

interface ControlPanelProps {
  backend: 'pinn' | 'rc';
  setBackend: (b: 'pinn' | 'rc') => void;
  controlMode: 'dqn' | 'manual';
  setControlMode: (m: 'dqn' | 'manual') => void;
  manualAction: ActionParams;
  setManualAction: React.Dispatch<React.SetStateAction<ActionParams>>;
  state: StateVector;
  setState: React.Dispatch<React.SetStateAction<StateVector>>;
  onStep: () => void;
  onQueryAgent: () => void;
  isLoading: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  backend,
  setBackend,
  controlMode,
  setControlMode,
  manualAction,
  setManualAction,
  state,
  setState,
  onStep,
  onQueryAgent,
  isLoading,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Centered Header */}
      <div className="text-center pb-4 border-b border-slate-100 space-y-1">
        <div className="inline-flex items-center justify-center space-x-2 text-sky-700 font-semibold">
          <Sliders className="w-5 h-5 text-sky-600" />
          <h2 className="text-base font-semibold text-slate-900">Control & Simulator Configuration</h2>
        </div>
        <p className="text-xs text-slate-500 max-w-xl mx-auto text-center">
          Select digital twin model variant and configure operational HVAC dispatch policies.
        </p>

        {/* Mode & Backend Switchers Centered */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          {/* Digital Twin Variant */}
          <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setBackend('pinn')}
              className={`px-3.5 py-1.5 rounded-md font-medium transition ${
                backend === 'pinn'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PINN Digital Twin
            </button>
            <button
              onClick={() => setBackend('rc')}
              className={`px-3.5 py-1.5 rounded-md font-medium transition ${
                backend === 'rc'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Analytical RC Model
            </button>
          </div>

          {/* Control Strategy */}
          <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setControlMode('dqn')}
              className={`flex items-center space-x-1 px-3.5 py-1.5 rounded-md font-medium transition ${
                controlMode === 'dqn'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1" />
              <span>Autonomous (DQN Agent)</span>
            </button>
            <button
              onClick={() => setControlMode('manual')}
              className={`px-3.5 py-1.5 rounded-md font-medium transition ${
                controlMode === 'manual'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Manual Dispatch
            </button>
          </div>
        </div>
      </div>

      {/* Control Details */}
      {controlMode === 'manual' && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-xs font-semibold text-sky-800 uppercase tracking-wider">
              Manual Override Parameters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-sky-50/50 border border-sky-200">
            {/* Unit Power Status */}
            <div className="text-center">
              <label className="text-xs font-medium text-slate-600 block mb-2">
                Unit Power
              </label>
              <button
                onClick={() =>
                  setManualAction((prev) => ({ ...prev, source: prev.source === 1 ? 0 : 1 }))
                }
                className={`w-full py-2.5 px-3 rounded-lg font-medium text-xs flex items-center justify-center space-x-1.5 border transition ${
                  manualAction.source === 1
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{manualAction.source === 1 ? 'UNIT ACTIVE (ON)' : 'STANDBY (OFF)'}</span>
              </button>
            </div>

            {/* Operating Mode */}
            <div className="text-center">
              <label className="text-xs font-medium text-slate-600 block mb-2">
                Operating Mode
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 1, label: 'Cool', icon: Snowflake },
                  { id: 2, label: 'Heat', icon: Flame },
                  { id: 3, label: 'Fan', icon: Wind },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setManualAction((prev) => ({ ...prev, mode: id }))}
                    className={`py-2 px-1 rounded-lg text-xs font-medium flex items-center justify-center space-x-1 border transition ${
                      manualAction.mode === id
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fan Speed */}
            <div className="text-center">
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-xs font-medium text-slate-600">Fan Speed</label>
                <span className="text-xs font-bold text-sky-700">Level {manualAction.fan_speed} / 6</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={manualAction.fan_speed}
                onChange={(e) =>
                  setManualAction((prev) => ({ ...prev, fan_speed: Number(e.target.value) }))
                }
                className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Target Temperature Setpoint */}
            <div className="text-center">
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-xs font-medium text-slate-600">Target Setpoint</label>
                <span className="text-xs font-bold text-sky-700">{manualAction.target_temp.toFixed(1)}°C</span>
              </div>
              <input
                type="range"
                min={18}
                max={30}
                step={0.5}
                value={manualAction.target_temp}
                onChange={(e) =>
                  setManualAction((prev) => ({ ...prev, target_temp: Number(e.target.value) }))
                }
                className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Environmental Disturbances (Disturbances) */}
      <div className="space-y-3 pt-1">
        <div className="text-center">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Environmental Disturbance Injection
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Both ambient temperature and occupant count serve as live thermodynamic disturbance inputs to the Digital Twin and the DQN state vector.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ambient Temperature */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
              <span className="flex items-center space-x-1.5">
                <CloudSun className="w-4 h-4 text-sky-600" />
                <span>Ambient Temperature Disturbance (T_out)</span>
              </span>
              <span className="text-sky-700 font-bold font-mono">{state.T_out.toFixed(1)}°C</span>
            </div>
            <p className="text-[10px] text-slate-400 text-left mb-2">
              External weather heat transmission across walls and windows.
            </p>
            <input
              type="range"
              min={15}
              max={42}
              step={0.5}
              value={state.T_out}
              onChange={(e) =>
                setState((prev) => ({ ...prev, T_out: Number(e.target.value) }))
              }
              className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Occupancy */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
              <span className="flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-sky-600" />
                <span>Building Occupant Count</span>
              </span>
              <span className="text-sky-700 font-bold font-mono">{state.Occupancy.toFixed(0)} persons</span>
            </div>
            <p className="text-[10px] text-slate-400 text-left mb-2">
              Internal sensible + latent heat gains (~130W/person) &amp; fresh air ventilation.
            </p>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={state.Occupancy}
              onChange={(e) =>
                setState((prev) => ({ ...prev, Occupancy: Number(e.target.value) }))
              }
              className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Centered Simulation Button */}
      <div className="pt-2 flex justify-center">
        <button
          onClick={onStep}
          disabled={isLoading}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-xs transition disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{isLoading ? 'Simulating Step...' : `Execute Simulation Step (${backend.toUpperCase()})`}</span>
        </button>
      </div>
    </div>
  );
};
