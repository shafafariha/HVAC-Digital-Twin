'use client';

import React from 'react';
import { BarChart3, ShieldCheck, Zap, Award } from 'lucide-react';
import { BenchmarkRecord } from '@/lib/types';

interface ModelBenchmarkProps {
  benchmarks: BenchmarkRecord[];
}

export const ModelBenchmark: React.FC<ModelBenchmarkProps> = ({ benchmarks }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
      <div className="text-center pb-3 border-b border-slate-100">
        <div className="inline-flex items-center justify-center space-x-2 text-sky-700 font-semibold">
          <BarChart3 className="w-5 h-5 text-sky-600" />
          <h2 className="text-base font-semibold text-slate-900">Digital Twin Model Benchmark Comparison</h2>
        </div>
      </div>

      {/* Comparison Cards Centered */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {benchmarks.map((b) => {
          const isPINN = b.backend.toLowerCase() === 'pinn';
          const name =
            b.backend === 'pinn'
              ? 'PINN Digital Twin'
              : b.backend === 'vanilla_nn'
              ? 'Vanilla Neural Net'
              : 'Analytical RC Model';

          return (
            <div
              key={b.backend}
              className={`p-5 rounded-xl border text-center transition ${
                isPINN
                  ? 'bg-sky-50/70 border-sky-300 shadow-2xs'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-col items-center justify-center mb-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {name}
                </span>
                {isPINN && (
                  <span className="mt-1 text-[10px] uppercase font-semibold px-2.5 py-0.5 rounded-full bg-white text-sky-800 border border-sky-200 shadow-3xs">
                    Physics-Informed
                  </span>
                )}
              </div>

              {/* Comfort Score Bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between items-center text-xs px-1">
                  <span className="text-slate-500 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600 mr-1" />
                    Thermal Comfort Compliance
                  </span>
                  <span className="font-bold text-slate-800">{b.comfort_mean.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      isPINN ? 'bg-sky-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, b.comfort_mean)}%` }}
                  />
                </div>
              </div>

              {/* Power & Reward Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
                <div className="p-2 rounded bg-white border border-slate-100">
                  <span className="text-slate-500 block text-[11px] flex items-center justify-center">
                    <Zap className="w-3 h-3 text-sky-600 mr-1" /> Average Power
                  </span>
                  <span className="font-bold text-slate-800 mt-1 block font-mono">
                    {b.power_mean.toFixed(0)} W
                  </span>
                </div>
                <div className="p-2 rounded bg-white border border-slate-100">
                  <span className="text-slate-500 block text-[11px] flex items-center justify-center">
                    <Award className="w-3 h-3 text-sky-600 mr-1" /> Mean Reward
                  </span>
                  <span
                    className={`font-bold mt-1 block font-mono ${
                      b.reward_mean >= 0 ? 'text-sky-700' : 'text-slate-600'
                    }`}
                  >
                    {b.reward_mean.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
