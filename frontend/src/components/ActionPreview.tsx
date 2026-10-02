'use client';

import React from 'react';
import { Power, Snowflake, Flame, Wind, Gauge, Layers, Info } from 'lucide-react';
import { ActionParams, ControlResponse } from '@/lib/types';

interface ActionPreviewProps {
  currentAction: ActionParams;
  controlResponse: ControlResponse | null;
  controlMode: 'dqn' | 'manual';
}

export const ActionPreview: React.FC<ActionPreviewProps> = ({
  currentAction,
  controlResponse,
  controlMode,
}) => {
  const modeLabels: Record<number, { label: string; icon: any }> = {
    1: { label: 'Cooling', icon: Snowflake },
    2: { label: 'Heating', icon: Flame },
    3: { label: 'Ventilation / Fan', icon: Wind },
  };

  const currentMode = modeLabels[currentAction.mode] || modeLabels[1];
  const ModeIcon = currentMode.icon;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
      <div className="text-center pb-3 border-b border-slate-100">
        <div className="inline-flex items-center justify-center space-x-2 text-sky-700 font-semibold">
          <Layers className="w-5 h-5 text-sky-600" />
          <h2 className="text-base font-semibold text-slate-900">Active HVAC Control Command</h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Decision Origin: <strong className="text-sky-700">{controlMode === 'dqn' ? 'DQN Agent Policy' : 'Manual Setpoint'}</strong>
        </p>
      </div>

      {/* Primary Action Summary Grid in Baby Blue */}
      <div className="grid grid-cols-2 gap-3 text-center">
        {/* Unit Status */}
        <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
          <div className="flex justify-center mb-1 text-sky-700">
            <Power className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 block uppercase font-medium">Unit Power</span>
          <span className="text-sm font-bold text-slate-900">
            {currentAction.source === 1 ? 'ACTIVE (ON)' : 'STANDBY (OFF)'}
          </span>
        </div>

        {/* Operating Mode */}
        <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
          <div className="flex justify-center mb-1 text-sky-700">
            <ModeIcon className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 block uppercase font-medium">Operating Mode</span>
          <span className="text-sm font-bold text-slate-900">{currentMode.label}</span>
        </div>

        {/* Fan Speed */}
        <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
          <div className="flex justify-center mb-1 text-sky-700">
            <Wind className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 block uppercase font-medium">Fan Speed</span>
          <span className="text-sm font-bold text-slate-900">Level {currentAction.fan_speed} / 6</span>
        </div>

        {/* Temperature Setpoint */}
        <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
          <div className="flex justify-center mb-1 text-sky-700">
            <Gauge className="w-4 h-4" />
          </div>
          <span className="text-[11px] text-slate-500 block uppercase font-medium">Setpoint Temp</span>
          <span className="text-sm font-bold text-slate-900">{currentAction.target_temp.toFixed(1)}°C</span>
        </div>
      </div>

      {/* DQN Explainability & Top Candidates (if available) */}
      {controlResponse && controlMode === 'dqn' && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-start space-x-2 text-xs text-slate-700">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="text-justify leading-relaxed font-medium">
              {controlResponse.explanation}
            </p>
          </div>

          {/* Top Candidates table */}
          {controlResponse.top_candidates && controlResponse.top_candidates.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block mb-2 uppercase tracking-wider text-center">
                Top Candidate Actions Ranked by Q-Value
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center text-slate-600">
                  <thead className="bg-sky-100/70 text-slate-700 font-semibold">
                    <tr>
                      <th className="px-2 py-1.5 rounded-l-md">ID</th>
                      <th className="px-2 py-1.5">Power</th>
                      <th className="px-2 py-1.5">Mode</th>
                      <th className="px-2 py-1.5">Fan</th>
                      <th className="px-2 py-1.5">Setpoint</th>
                      <th className="px-2 py-1.5 rounded-r-md">Q-Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {controlResponse.top_candidates.map((cand, idx) => (
                      <tr
                        key={cand.action_index}
                        className={idx === 0 ? 'bg-sky-50 text-sky-950 font-semibold' : ''}
                      >
                        <td className="px-2 py-1.5 font-mono">#{cand.action_index}</td>
                        <td className="px-2 py-1.5">{cand.source === 1 ? 'ON' : 'OFF'}</td>
                        <td className="px-2 py-1.5">{modeLabels[cand.mode]?.label || 'Cooling'}</td>
                        <td className="px-2 py-1.5">{cand.fan_speed}</td>
                        <td className="px-2 py-1.5">{cand.target_temp}°C</td>
                        <td className="px-2 py-1.5 font-mono text-sky-700">{cand.q_value.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
