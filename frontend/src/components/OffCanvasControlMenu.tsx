'use client';

import React, { useState } from 'react';
import {
  X,
  Menu,
  Building2,
  Sliders,
  Wind,
  Sun,
  Users,
  Power,
  Snowflake,
  Flame,
  CloudSun,
  Play,
  RefreshCw,
  Zap,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  EngineeringZoneRequest,
  ZonePresetItem,
  WindowFenestrationInput,
  ActionParams,
  StateVector,
} from '@/lib/types';

interface OffCanvasControlMenuProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: 'control' | 'engineering';
  // Engineering Suite Props
  zoneRequest: EngineeringZoneRequest;
  setZoneRequest: React.Dispatch<React.SetStateAction<EngineeringZoneRequest>>;
  presets: ZonePresetItem[];
  onCalculateLoads: (customZone?: EngineeringZoneRequest) => void;
  onCalibrateTwin: () => void;
  isCalculating: boolean;
  isCalibrating: boolean;
  // Simulator & Control Props
  backend: 'pinn' | 'rc';
  setBackend: (b: 'pinn' | 'rc') => void;
  controlMode: 'dqn' | 'manual';
  setControlMode: (m: 'dqn' | 'manual') => void;
  manualAction: ActionParams;
  setManualAction: React.Dispatch<React.SetStateAction<ActionParams>>;
  state: StateVector;
  setState: React.Dispatch<React.SetStateAction<StateVector>>;
  onStep: () => void;
  onQueryAgent?: () => void;
  onRun24h?: () => void;
  onReset?: () => void;
  isLoading: boolean;
}

export const OffCanvasControlMenu: React.FC<OffCanvasControlMenuProps> = ({
  isOpen,
  onClose,
  initialSection = 'control',
  zoneRequest,
  setZoneRequest,
  presets,
  onCalculateLoads,
  onCalibrateTwin,
  isCalculating,
  isCalibrating,
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
  onRun24h,
  onReset,
  isLoading,
}) => {
  const [activeSection, setActiveSection] = useState<'control' | 'engineering'>(initialSection);
  const [engineeringSubTab, setEngineeringSubTab] = useState<'geometry' | 'envelope' | 'internal'>('geometry');

  // Sync active tab whenever initialSection changes or menu opens
  React.useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection, isOpen]);

  if (!isOpen) return null;

  // Window change helper
  const handleWindowChange = (index: number, field: keyof WindowFenestrationInput, value: number) => {
    const wins = [...(zoneRequest.windows || [])];
    wins[index] = { ...wins[index], [field]: value };
    const updated = { ...zoneRequest, windows: wins };
    setZoneRequest(updated);
  };

  // Preset Selection
  const handlePresetSelect = (presetName: string) => {
    const found = presets.find((p) => p.preset_type.toLowerCase() === presetName.toLowerCase());
    if (found) {
      const def = found.defaults;
      const updated: EngineeringZoneRequest = {
        ...zoneRequest,
        preset_type: found.preset_type,
        name: `${found.preset_type} Zone`,
        area_m2: def.area_m2,
        height_m: def.height_m,
        max_occupants: def.max_occupants,
        lpd_w_m2: def.lpd_w_m2,
        oa_person_l_s: def.oa_person_l_s,
        oa_area_l_s_m2: def.oa_area_l_s_m2,
        ach: def.ach,
        wall_u_value: def.wall_u,
        roof_u_value: def.roof_u,
        cooling_cop: def.cooling_cop,
        equipment_items: def.default_equipment && def.default_equipment.length > 0
          ? def.default_equipment
          : zoneRequest.equipment_items,
      };
      setZoneRequest(updated);
      onCalculateLoads(updated);
    } else {
      setZoneRequest((prev) => ({ ...prev, preset_type: presetName }));
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop with Click to Close */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity z-[9998]"
      />

      {/* Slide-over Drawer on the Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 z-[9999]">
        <div className="w-screen max-w-md sm:max-w-lg md:max-w-2xl bg-white shadow-2xl border-l border-sky-100 flex flex-col h-full transform transition ease-in-out duration-300">
          
          {/* Drawer Header with 3-Line Hamburger Icon */}
          <div className="p-4 border-b border-sky-100 flex items-center justify-between bg-sky-50/60">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-sky-600 text-white shadow-xs">
                <Menu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Input Controls
                </h3>
                <span className="text-[11px] text-slate-500">
                  System Configuration &amp; Parameter Management
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section Switcher Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-medium">
            <button
              onClick={() => setActiveSection('control')}
              className={`flex-1 py-3 text-center transition flex items-center justify-center space-x-1.5 border-b-2 ${
                activeSection === 'control'
                  ? 'border-sky-600 text-sky-700 bg-white font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>1. Simulator Control Center</span>
            </button>
            <button
              onClick={() => setActiveSection('engineering')}
              className={`flex-1 py-3 text-center transition flex items-center justify-center space-x-1.5 border-b-2 ${
                activeSection === 'engineering'
                  ? 'border-sky-600 text-sky-700 bg-white font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>2. Office Engineering Specification &amp; Load Sizing Suite</span>
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            
            {/* ========================================================= */}
            {/* SECTION 1: SIMULATOR CONTROL CENTER                       */}
            {/* ========================================================= */}
            {activeSection === 'control' && (
              <div className="space-y-5">
                {/* Simulator Model Backend Variant */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    World Model Simulator Backend:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBackend('pinn')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition ${
                        backend === 'pinn'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      PINN Digital Twin
                    </button>
                    <button
                      onClick={() => setBackend('rc')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition ${
                        backend === 'rc'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Analytical RC Model
                    </button>
                  </div>
                </div>

                {/* Control Mode Strategy */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    HVAC Control Strategy:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setControlMode('dqn')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition ${
                        controlMode === 'dqn'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Autonomous (DQN Agent)
                    </button>
                    <button
                      onClick={() => setControlMode('manual')}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition ${
                        controlMode === 'manual'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Manual Dispatch
                    </button>
                  </div>
                </div>

                {/* Manual Override Controls */}
                {controlMode === 'manual' && (
                  <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-900">Unit Power:</span>
                      <button
                        onClick={() =>
                          setManualAction((prev) => ({ ...prev, source: prev.source === 1 ? 0 : 1 }))
                        }
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          manualAction.source === 1
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {manualAction.source === 1 ? 'UNIT ON (Active)' : 'UNIT OFF (Standby)'}
                      </button>
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1">Operating Mode:</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 1, label: 'Cool', icon: Snowflake },
                          { id: 2, label: 'Heat', icon: Flame },
                          { id: 3, label: 'Fan', icon: Wind },
                        ].map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setManualAction((prev) => ({ ...prev, mode: id }))}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center space-x-1 border transition ${
                              manualAction.mode === id
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Fan Speed</span>
                        <span className="font-bold text-sky-800">Level {manualAction.fan_speed} / 6</span>
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
                        className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Target Setpoint Temperature</span>
                        <span className="font-bold text-sky-800">{manualAction.target_temp.toFixed(1)}°C</span>
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
                        className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Environmental Disturbances Injection */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 block">
                      Environmental Disturbances Injection:
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center space-x-1">
                        <CloudSun className="w-3.5 h-3.5 text-sky-600" />
                        <span>Outdoor Ambient Temperature (T_out)</span>
                      </span>
                      <span className="font-mono font-bold text-sky-800">{state.T_out.toFixed(1)}°C</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={42}
                      step={0.5}
                      value={state.T_out}
                      onChange={(e) => setState((prev) => ({ ...prev, T_out: Number(e.target.value) }))}
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-sky-600" />
                        <span>Building Occupancy Count</span>
                      </span>
                      <span className="font-mono font-bold text-sky-800">{state.Occupancy.toFixed(0)} Persons</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={1}
                      value={state.Occupancy}
                      onChange={(e) => setState((prev) => ({ ...prev, Occupancy: Number(e.target.value) }))}
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Simulation Action Buttons */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <button
                    onClick={onStep}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{isLoading ? 'Simulating Step...' : `Execute Simulation Step (${backend.toUpperCase()})`}</span>
                  </button>

                  {onQueryAgent && (
                    <button
                      onClick={onQueryAgent}
                      disabled={isLoading}
                      className="w-full py-2 px-3 rounded-lg bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 text-xs font-medium transition shadow-2xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5 text-sky-600" />
                      <span>Evaluate DQN Policy (Query Agent)</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {onRun24h && (
                      <button
                        onClick={onRun24h}
                        disabled={isLoading}
                        className="py-2 px-3 rounded-lg bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 text-xs font-medium transition shadow-2xs text-center disabled:opacity-50"
                      >
                        Run 24h Cycle
                      </button>
                    )}
                    {onReset && (
                      <button
                        onClick={onReset}
                        disabled={isLoading}
                        className="py-2 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-2xs flex items-center justify-center space-x-1 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span>Reset Simulation</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* SECTION 2: OFFICE ENGINEERING SPECIFICATION & LOAD SIZING SUITE   */}
            {/* ================================================================= */}
            {activeSection === 'engineering' && (
              <div className="space-y-5">
                {/* Subtabs for Engineering */}
                <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
                  <button
                    onClick={() => setEngineeringSubTab('geometry')}
                    className={`flex-1 py-1.5 rounded-md font-medium transition ${
                      engineeringSubTab === 'geometry'
                        ? 'bg-white text-sky-800 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Geometry &amp; Criteria
                  </button>
                  <button
                    onClick={() => setEngineeringSubTab('envelope')}
                    className={`flex-1 py-1.5 rounded-md font-medium transition ${
                      engineeringSubTab === 'envelope'
                        ? 'bg-white text-sky-800 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Envelope &amp; Fenestration
                  </button>
                  <button
                    onClick={() => setEngineeringSubTab('internal')}
                    className={`flex-1 py-1.5 rounded-md font-medium transition ${
                      engineeringSubTab === 'internal'
                        ? 'bg-white text-sky-800 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Occupancy &amp; Ventilation
                  </button>
                </div>

                {/* SubTab 1: Geometry & Presets */}
                {engineeringSubTab === 'geometry' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                        Select Commercial Office Preset:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {[
                          'Open Office',
                          'Private Office',
                          'Conference Room',
                          'Server / IT Room',
                          'Executive Suite',
                          'Custom Office',
                        ].map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handlePresetSelect(name)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition ${
                              zoneRequest.preset_type.toLowerCase() === name.toLowerCase()
                                ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-2xs font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 font-medium">Zone Floor Area (m²)</label>
                        <input
                          type="number"
                          step="5"
                          min="5"
                          value={zoneRequest.area_m2}
                          onChange={(e) => {
                            const updated = { ...zoneRequest, area_m2: parseFloat(e.target.value) || 10 };
                            setZoneRequest(updated);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 font-medium">Ceiling Height (m)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="2.0"
                          max="8.0"
                          value={zoneRequest.height_m}
                          onChange={(e) => {
                            const updated = { ...zoneRequest, height_m: parseFloat(e.target.value) || 2.8 };
                            setZoneRequest(updated);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 font-medium">Conditioned Volume (m³)</label>
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-mono">
                          {(zoneRequest.area_m2 * zoneRequest.height_m).toFixed(1)} m³
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 font-medium">Equipment Cooling COP</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1.5"
                          max="6.0"
                          value={zoneRequest.cooling_cop}
                          onChange={(e) => {
                            const updated = { ...zoneRequest, cooling_cop: parseFloat(e.target.value) || 3.0 };
                            setZoneRequest(updated);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-700 block">
                        Indoor &amp; Outdoor Design Criteria:
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-500">Outdoor Design Temp (°C)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={zoneRequest.t_out_c}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, t_out_c: parseFloat(e.target.value) || 30.0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Outdoor Design RH (%)</label>
                          <input
                            type="number"
                            step="1.0"
                            value={zoneRequest.rh_out_pct}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, rh_out_pct: parseFloat(e.target.value) || 60.0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Target Setpoint Temp (°C)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={zoneRequest.target_temp_c}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, target_temp_c: parseFloat(e.target.value) || 24.0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Target Humidity RH (%)</label>
                          <input
                            type="number"
                            step="1.0"
                            value={zoneRequest.target_rh_pct}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, target_rh_pct: parseFloat(e.target.value) || 50.0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SubTab 2: Envelope & Windows */}
                {engineeringSubTab === 'envelope' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-600 font-medium">Exterior Wall U-Value (W/(m²·K))</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          value={zoneRequest.wall_u_value || 0.45}
                          onChange={(e) => setZoneRequest({ ...zoneRequest, wall_u_value: parseFloat(e.target.value) || 0.45 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-medium">Roof U-Value (W/(m²·K))</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          value={zoneRequest.roof_u_value || 0.30}
                          onChange={(e) => setZoneRequest({ ...zoneRequest, roof_u_value: parseFloat(e.target.value) || 0.30 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Window Fenestration &amp; Solar Gains by Orientation:
                      </span>
                      <div className="space-y-2">
                        {(zoneRequest.windows || []).map((w, idx) => (
                          <div key={w.orientation} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between font-semibold text-slate-700">
                              <span>{w.orientation} Facade</span>
                              <span className="font-mono text-sky-800 text-[10px]">
                                Solar: {(w.area_m2 * w.shgc * w.solar_irradiance_w_m2).toFixed(0)} W
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                              <div>
                                <label className="text-slate-500">Area (m²)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={w.area_m2}
                                  onChange={(e) => handleWindowChange(idx, 'area_m2', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500">U-Val</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.5"
                                  value={w.u_value}
                                  onChange={(e) => handleWindowChange(idx, 'u_value', parseFloat(e.target.value) || 2.0)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500">SHGC</label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0.1"
                                  max="0.9"
                                  value={w.shgc}
                                  onChange={(e) => handleWindowChange(idx, 'shgc', parseFloat(e.target.value) || 0.4)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500">W/m²</label>
                                <input
                                  type="number"
                                  step="10"
                                  min="0"
                                  value={w.solar_irradiance_w_m2}
                                  onChange={(e) => handleWindowChange(idx, 'solar_irradiance_w_m2', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SubTab 3: Internal Gains & Ventilation */}
                {engineeringSubTab === 'internal' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-600 font-medium">Design Peak Occupants (Persons)</label>
                        <input
                          type="number"
                          min="0"
                          value={zoneRequest.max_occupants}
                          onChange={(e) => setZoneRequest({ ...zoneRequest, max_occupants: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 font-medium">Lighting LPD (W/m²)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={zoneRequest.lpd_w_m2}
                          onChange={(e) => setZoneRequest({ ...zoneRequest, lpd_w_m2: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-2">
                        ASHRAE 62.1 Ventilation &amp; Infiltration Rates:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500">Rp (L/s·person)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={zoneRequest.oa_person_l_s}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, oa_person_l_s: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Ra (L/s·m²)</label>
                          <input
                            type="number"
                            step="0.05"
                            value={zoneRequest.oa_area_l_s_m2}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, oa_area_l_s_m2: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Infiltration (ACH)</label>
                          <input
                            type="number"
                            step="0.05"
                            value={zoneRequest.ach}
                            onChange={(e) => setZoneRequest({ ...zoneRequest, ach: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Equipment Inventory */}
                    {zoneRequest.equipment_items && zoneRequest.equipment_items.length > 0 && (
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <span className="text-[11px] font-semibold text-slate-700 block">
                          Office Equipment &amp; Plug Loads:
                        </span>
                        <div className="space-y-1.5">
                          {zoneRequest.equipment_items.map((eq, idx) => (
                            <div key={eq.name} className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
                              <div className="font-medium text-slate-800 truncate mr-2 max-w-[140px]">{eq.name}</div>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-slate-500 text-[10px]">Qty:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={eq.quantity}
                                  onChange={(e) => {
                                    const items = [...(zoneRequest.equipment_items || [])];
                                    items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 0 };
                                    setZoneRequest({ ...zoneRequest, equipment_items: items });
                                  }}
                                  className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-xs text-center"
                                />
                                <span className="font-mono text-sky-800 text-[10px] ml-1">
                                  {(eq.quantity * eq.rated_power_w * eq.utilization_factor).toFixed(0)} W
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Actions for Engineering */}
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <button
                    onClick={() => onCalculateLoads(zoneRequest)}
                    disabled={isCalculating}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
                    <span>{isCalculating ? 'Computing Loads...' : 'Calculate Loads & Sizing'}</span>
                  </button>

                  <button
                    onClick={onCalibrateTwin}
                    disabled={isCalibrating}
                    className="w-full py-2 px-4 rounded-xl bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 font-medium text-xs transition shadow-2xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 text-sky-600 ${isCalibrating ? 'animate-spin' : ''}`} />
                    <span>Calibrate Digital Twin (Sync Physics)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
