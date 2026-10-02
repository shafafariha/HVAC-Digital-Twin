'use client';

import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Zap,
  ShieldCheck,
  Thermometer,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  uploadAndSimulateDataset,
  simulateSampleDataset,
  getTemplateCsvUrl,
} from '@/lib/api';
import { BatchSimulationResponse, BatchSimulationSummary } from '@/lib/types';

interface DataUploadSectionProps {
  backend: 'pinn' | 'rc';
  controlMode: 'dqn' | 'manual';
  manualTemp: number;
  onSimulationComplete: (result: BatchSimulationResponse) => void;
}

export const DataUploadSection: React.FC<DataUploadSectionProps> = ({
  backend,
  controlMode,
  manualTemp,
  onSimulationComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<BatchSimulationSummary | null>(null);
  const [autoRun, setAutoRun] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const executeSimulation = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await uploadAndSimulateDataset(
        file,
        backend,
        controlMode,
        manualTemp,
        3,
        1
      );
      setSummary(res.summary);
      onSimulationComplete(res);
    } catch (err: any) {
      console.error('File simulation error:', err);
      setErrorMessage(err.message || 'Failed to simulate uploaded dataset.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
      if (autoRun) {
        executeSimulation(file);
      }
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        setErrorMessage('Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      if (autoRun) {
        executeSimulation(file);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSampleRun = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await simulateSampleDataset(backend, controlMode);
      setSummary(res.summary);
      setSelectedFile(new File([''], 'dataset.csv', { type: 'text/csv' }));
      onSimulationComplete(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute CSV dataset simulation.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Formal Header */}
      <div className="text-center pb-3 border-b border-slate-100">
        <div className="inline-flex items-center justify-center space-x-2 text-sky-700 font-semibold">
          <FileSpreadsheet className="w-5 h-5 text-sky-600" />
          <h2 className="text-base font-semibold text-slate-900">
            Dataset Batch Simulation (Excel / CSV)
          </h2>
        </div>
      </div>

      {/* Main Grid: Upload Dropzone & Action Options */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Dropzone Card */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`md:col-span-8 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition text-center ${
            isDragging
              ? 'border-sky-500 bg-sky-50/60'
              : 'border-sky-200 bg-sky-50/20 hover:bg-sky-50/40 hover:border-sky-300'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-white border border-sky-200 text-sky-600 flex items-center justify-center shadow-3xs mb-3">
            <UploadCloud className="w-6 h-6 text-sky-600" />
          </div>

          <p className="text-xs font-semibold text-slate-800">
            {selectedFile ? (
              <span className="text-sky-800 font-mono">{selectedFile.name}</span>
            ) : (
              'Click to browse or drop an Excel (.xlsx, .xls) or CSV (.csv) file'
            )}
          </p>

          {selectedFile && (
            <div className="mt-3 flex items-center space-x-2 text-[11px] text-sky-800 font-medium bg-sky-100/60 px-3 py-1 rounded-full border border-sky-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
              <span>File ready: {(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>

        {/* Control & Auxiliary Options */}
        <div className="md:col-span-4 flex flex-col justify-between space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Automatic Execution</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRun}
                  onChange={(e) => setAutoRun(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* Run Button */}
            <button
              onClick={() => selectedFile && executeSimulation(selectedFile)}
              disabled={!selectedFile || isProcessing}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Simulating Dataset...' : 'Run Simulation'}</span>
            </button>
          </div>

          {/* Quick Presets & Template */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <button
              onClick={handleSampleRun}
              disabled={isProcessing}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Load CSV Dataset (48 Steps)</span>
            </button>

            <a
              href={getTemplateCsvUrl()}
              download="hvac_simulation_template.csv"
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition shadow-2xs text-center"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download CSV Template</span>
            </a>
          </div>
        </div>
      </div>

      {/* Error Message Notice */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-center space-x-2 text-center">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Dataset Simulation Summary Metrics */}
      {summary && (
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-5 space-y-4">
          <div className="text-center pb-2 border-b border-sky-200/60">
            <h3 className="text-xs font-bold text-sky-900 uppercase tracking-wider">
              Simulation Results Summary: {summary.filename}
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Simulated {summary.total_steps} sequential time steps utilizing {summary.backend_used.toUpperCase()} Digital Twin under {summary.control_mode.toUpperCase()} control policy.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Comfort Compliance */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 text-center shadow-3xs">
              <span className="text-[11px] text-slate-500 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600 mr-1" /> Comfort Rate
              </span>
              <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                {summary.comfort_adherence_pct.toFixed(1)}%
              </span>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, summary.comfort_adherence_pct)}%` }}
                />
              </div>
            </div>

            {/* Mean Indoor Temp */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 text-center shadow-3xs">
              <span className="text-[11px] text-slate-500 flex items-center justify-center">
                <Thermometer className="w-3.5 h-3.5 text-sky-600 mr-1" /> Mean Temp
              </span>
              <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                {summary.mean_indoor_temp.toFixed(2)} °C
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Target: 25.0 °C</span>
            </div>

            {/* Average Power Draw */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 text-center shadow-3xs">
              <span className="text-[11px] text-slate-500 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-sky-600 mr-1" /> Average Power
              </span>
              <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                {summary.mean_power_watts.toFixed(1)} W
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Electrical Demand</span>
            </div>

            {/* Total Energy */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 text-center shadow-3xs">
              <span className="text-[11px] text-slate-500 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-sky-600 mr-1" /> Total Energy
              </span>
              <span className="text-base font-bold text-slate-900 mt-1 block font-mono">
                {summary.total_energy_kwh.toFixed(3)} kWh
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Accumulated</span>
            </div>

            {/* Mean Reward */}
            <div className="bg-white p-3 rounded-lg border border-sky-100 text-center shadow-3xs">
              <span className="text-[11px] text-slate-500 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 mr-1" /> Mean Reward
              </span>
              <span
                className={`text-base font-bold mt-1 block font-mono ${
                  summary.mean_reward >= 0 ? 'text-sky-700' : 'text-slate-700'
                }`}
              >
                {summary.mean_reward.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Objective Metric</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
