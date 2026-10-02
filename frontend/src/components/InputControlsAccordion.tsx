'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Building2,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  Zap,
  RotateCcw,
  Wind,
  Sun,
  Users,
  Power,
  Snowflake,
  Flame,
  CloudSun,
  CheckCircle2,
  Layers,
  Thermometer,
  ShieldCheck,
  Plus,
  Trash2,
  Info,
  Gauge,
  X,
  Sparkles,
} from 'lucide-react';
import {
  EngineeringZoneRequest,
  ZonePresetItem,
  WindowFenestrationInput,
  OfficeEquipmentInput,
  ActionParams,
  StateVector,
  CalibratedTwinParameters,
  EngineeringCalculationResponse,
} from '@/lib/types';

interface InputControlsAccordionProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  // Simulator Controls Props
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
  onRun24h: () => void;
  onReset: () => void;
  isLoading: boolean;
  calibratedTwinParams: CalibratedTwinParameters | null;
  // Office Engineering Suite Props
  zoneRequest: EngineeringZoneRequest;
  setZoneRequest: React.Dispatch<React.SetStateAction<EngineeringZoneRequest>>;
  calcResult: EngineeringCalculationResponse | null;
  presets: ZonePresetItem[];
  onCalculateLoads: (customZone?: EngineeringZoneRequest) => void;
  onCalibrateTwin: () => void;
  isCalculating: boolean;
  isCalibrating: boolean;
}

export const InputControlsAccordion: React.FC<InputControlsAccordionProps> = ({
  isOpen,
  onToggleOpen,
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
  calibratedTwinParams,
  zoneRequest,
  setZoneRequest,
  calcResult,
  presets,
  onCalculateLoads,
  onCalibrateTwin,
  isCalculating,
  isCalibrating,
}) => {
  // Accordion section expansion states: both collapsed by default upon opening
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState<boolean>(false);
  const [isEngineeringExpanded, setIsEngineeringExpanded] = useState<boolean>(false);

  // Subtab within Office Engineering Suite
  const [engineeringSubTab, setEngineeringSubTab] = useState<
    'geometry' | 'envelope' | 'internal' | 'results'
  >('geometry');

  // Humidity setpoint state for manual dispatch
  const [manualRhSetpoint, setManualRhSetpoint] = useState<number>(50.0);
  const [compressorPowerCapKw, setCompressorPowerCapKw] = useState<number>(7.5);
  const [solarDisturbanceW, setSolarDisturbanceW] = useState<number>(350.0);

  // Helper for window fenestration updates
  const handleWindowChange = (
    index: number,
    field: keyof WindowFenestrationInput,
    value: number
  ) => {
    const windows = [...(zoneRequest.windows || [])];
    windows[index] = { ...windows[index], [field]: value };
    setZoneRequest({ ...zoneRequest, windows });
  };

  // Helper for preset selection
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
        equipment_items:
          def.default_equipment && def.default_equipment.length > 0
            ? def.default_equipment
            : zoneRequest.equipment_items,
      };
      setZoneRequest(updated);
      onCalculateLoads(updated);
    } else {
      setZoneRequest((prev) => ({ ...prev, preset_type: presetName }));
    }
  };

  // Add new equipment item
  const handleAddEquipment = () => {
    const newItem: OfficeEquipmentInput = {
      name: 'Custom Office Appliance',
      quantity: 1,
      rated_power_w: 150.0,
      utilization_factor: 0.8,
    };
    setZoneRequest({
      ...zoneRequest,
      equipment_items: [...(zoneRequest.equipment_items || []), newItem],
    });
  };

  // Remove equipment item
  const handleRemoveEquipment = (index: number) => {
    const items = [...(zoneRequest.equipment_items || [])];
    items.splice(index, 1);
    setZoneRequest({ ...zoneRequest, equipment_items: items });
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white border border-sky-200 rounded-2xl shadow-md overflow-hidden transition-all duration-300">
      {/* Top Banner / Master Header */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-sky-50/80 px-6 py-4 border-b border-sky-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-xs">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Input Controls &amp; System Configuration
            </h2>
          </div>
        </div>

        {/* Close / Collapse Button */}
        <button
          onClick={onToggleOpen}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold border border-slate-200 transition shadow-2xs"
          title="Collapse Input Controls"
        >
          <span>Collapse</span>
          <ChevronUp className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Accordion Master Cards Container */}
      <div className="p-6 space-y-4">
        {/* ==================================================================== */}
        {/* CARD 1: SIMULATOR CONTROL CENTER                                     */}
        {/* ==================================================================== */}
        <div
          className={`border rounded-xl transition-all duration-200 overflow-hidden ${
            isSimulatorExpanded
              ? 'border-sky-300 bg-white shadow-sm ring-1 ring-sky-200'
              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          {/* Card 1 Clickable Header */}
          <button
            type="button"
            onClick={() => setIsSimulatorExpanded((prev) => !prev)}
            className="w-full px-5 py-4 flex items-center justify-between text-left transition focus:outline-hidden"
          >
            <div className="flex items-center space-x-3.5">
              <div
                className={`p-2 rounded-lg transition ${
                  isSimulatorExpanded
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Simulator Control Center
                </h3>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 ml-4">
              <span className="text-xs font-semibold text-sky-700 hidden sm:inline">
                {isSimulatorExpanded ? 'Hide Details' : 'Configure Settings'}
              </span>
              <div
                className={`p-1.5 rounded-full transition-transform duration-200 ${
                  isSimulatorExpanded ? 'bg-sky-100 text-sky-800 rotate-180' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          {/* Card 1 Expanded Body */}
          {isSimulatorExpanded && (
            <div className="px-5 pb-6 pt-2 border-t border-sky-100 space-y-6 text-xs">
              {/* Row 1: Model Selection & Control Strategy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Simulator World Model Backend */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      World Model Simulator Engine
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBackend('pinn')}
                      className={`py-2 px-3 rounded-lg font-medium text-xs border text-center transition ${
                        backend === 'pinn'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      PINN Digital Twin
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackend('rc')}
                      className={`py-2 px-3 rounded-lg font-medium text-xs border text-center transition ${
                        backend === 'rc'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Analytical RC Model
                    </button>
                  </div>
                </div>

                {/* Control Mode Strategy */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      HVAC Control Strategy
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setControlMode('dqn')}
                      className={`py-2 px-3 rounded-lg font-medium text-xs border text-center transition ${
                        controlMode === 'dqn'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Autonomous (DQN Agent)
                    </button>
                    <button
                      type="button"
                      onClick={() => setControlMode('manual')}
                      className={`py-2 px-3 rounded-lg font-medium text-xs border text-center transition ${
                        controlMode === 'manual'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Manual Engineering Dispatch
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Manual Override Controls (Visible always or highlightable) */}
              <div
                className={`p-4 rounded-xl border transition ${
                  controlMode === 'manual'
                    ? 'bg-sky-50/60 border-sky-200'
                    : 'bg-slate-50/60 border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/70">
                  <div className="flex items-center space-x-2">
                    <Power className="w-4 h-4 text-sky-700" />
                    <span className="font-bold text-slate-900 text-xs">
                      Manual Engineering Dispatch Parameters
                    </span>
                    {controlMode !== 'manual' && (
                      <span className="text-[10px] text-slate-500 italic">
                        (Switch to Manual Dispatch above to enforce these setpoints)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setManualAction((prev) => ({ ...prev, source: prev.source === 1 ? 0 : 1 }))
                    }
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      manualAction.source === 1
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {manualAction.source === 1 ? 'UNIT ON (Active)' : 'UNIT OFF (Standby)'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Operating Mode */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                      HVAC Operating Mode:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 1, label: 'Cool', icon: Snowflake },
                        { id: 2, label: 'Heat', icon: Flame },
                        { id: 3, label: 'Fan', icon: Wind },
                      ].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setManualAction((prev) => ({ ...prev, mode: id }))}
                          className={`py-1.5 px-1 rounded-lg text-xs font-medium flex items-center justify-center space-x-1 border transition ${
                            manualAction.mode === id
                              ? 'bg-sky-600 text-white border-sky-600 shadow-2xs font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fan Speed */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Supply Fan Speed:
                      </label>
                      <span className="font-mono font-bold text-sky-800">
                        Stage {manualAction.fan_speed} / 6
                      </span>
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
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Off</span>
                      <span>Medium</span>
                      <span>Max Airflow</span>
                    </div>
                  </div>

                  {/* Target Temperature Setpoint */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Target Setpoint Temp:
                      </label>
                      <span className="font-mono font-bold text-sky-800">
                        {manualAction.target_temp.toFixed(1)}°C
                      </span>
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
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>18.0°C</span>
                      <span className="text-sky-700 font-semibold">24.0°C Comfort</span>
                      <span>30.0°C</span>
                    </div>
                  </div>

                  {/* Target RH Setpoint */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Target RH Setpoint:
                      </label>
                      <span className="font-mono font-bold text-sky-800">
                        {manualRhSetpoint.toFixed(0)}% RH
                      </span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={75}
                      step={1}
                      value={manualRhSetpoint}
                      onChange={(e) => setManualRhSetpoint(Number(e.target.value))}
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>35% Dry</span>
                      <span>50% Optimal</span>
                      <span>75% Humid</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Environmental Disturbances Injection */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <CloudSun className="w-4 h-4 text-sky-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      Live Environmental Disturbance Injection
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Outdoor Temp Disturbance */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium text-[11px]">Outdoor Temp (T_out)</span>
                      <span className="font-mono font-bold text-sky-800">
                        {state.T_out.toFixed(1)}°C
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={45}
                      step={0.5}
                      value={state.T_out}
                      onChange={(e) => setState((prev) => ({ ...prev, T_out: Number(e.target.value) }))}
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block">External weather envelope heat transfer</span>
                  </div>

                  {/* Outdoor Humidity Disturbance */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium text-[11px]">Outdoor RH (H_out)</span>
                      <span className="font-mono font-bold text-sky-800">
                        {state.H_out.toFixed(0)}% RH
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={95}
                      step={1}
                      value={state.H_out}
                      onChange={(e) => setState((prev) => ({ ...prev, H_out: Number(e.target.value) }))}
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block">Moisture ingress via infiltration &amp; fresh air</span>
                  </div>

                  {/* Occupancy Count Disturbance */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium text-[11px]">Occupants Count</span>
                      <span className="font-mono font-bold text-sky-800">
                        {state.Occupancy.toFixed(0)} Persons
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={state.Occupancy}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, Occupancy: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Sensible: {(state.Occupancy * 75).toFixed(0)}W • Latent: {(state.Occupancy * 55).toFixed(0)}W
                    </span>
                  </div>

                  {/* Solar Irradiance Disturbance */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium text-[11px]">Solar Radiation</span>
                      <span className="font-mono font-bold text-sky-800">
                        {solarDisturbanceW.toFixed(0)} W/m²
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={25}
                      value={solarDisturbanceW}
                      onChange={(e) => setSolarDisturbanceW(Number(e.target.value))}
                      className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded cursor-pointer"
                    />
                    <div className="flex space-x-1 pt-0.5">
                      {[
                        { label: 'Night', w: 0 },
                        { label: 'Overcast', w: 250 },
                        { label: 'Clear Sun', w: 850 },
                      ].map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => setSolarDisturbanceW(s.w)}
                          className="px-1.5 py-0.5 text-[9px] bg-slate-100 hover:bg-sky-100 text-slate-600 rounded transition"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Calibrated ODE Parameters Readout */}
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
                  <span className="font-semibold text-sky-900">
                    Active World Model ODE Parameters:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-700">
                  <span className="bg-white px-2 py-1 rounded border border-sky-200">
                    C_air = <strong>{(calibratedTwinParams?.c_air || 500).toFixed(0)}</strong> J/K
                  </span>
                  <span className="bg-white px-2 py-1 rounded border border-sky-200">
                    R_wall = <strong>{(calibratedTwinParams?.r_wall || 0.0105).toFixed(6)}</strong> K/W
                  </span>
                  <span className="bg-white px-2 py-1 rounded border border-sky-200">
                    Time Constant τ ={' '}
                    <strong>
                      {(
                        calibratedTwinParams?.time_constant_hours ||
                        ((calibratedTwinParams?.c_air || 500) *
                          (calibratedTwinParams?.r_wall || 0.0105)) /
                          3600
                      ).toFixed(2)}
                    </strong>{' '}
                    hours
                  </span>
                  <span className="bg-white px-2 py-1 rounded border border-sky-200">
                    COP = <strong>{(zoneRequest.cooling_cop || 3.4).toFixed(1)}</strong>
                  </span>
                </div>
              </div>

              {/* Row 5: Simulation Execution Toolbar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onStep}
                  disabled={isLoading}
                  className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    {isLoading
                      ? 'Simulating Forward Step...'
                      : `Execute Simulation Step (${backend.toUpperCase()})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onQueryAgent}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-xl bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 font-semibold text-xs transition shadow-2xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  title="Query Deep Q-Network policy inference without advancing simulation step"
                >
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span>Evaluate DQN Policy (Query Agent)</span>
                </button>

                <button
                  type="button"
                  onClick={onRun24h}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-xl bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 font-semibold text-xs transition shadow-2xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  title="Run automated 24-step diurnal cycle simulation"
                >
                  <span>Run 24h Diurnal Cycle</span>
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  disabled={isLoading}
                  className="py-2.5 px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition shadow-2xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  title="Reset simulation state to default baseline"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset State</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* CARD 2: OFFICE ENGINEERING SPECIFICATION & LOAD SIZING SUITE         */}
        {/* ==================================================================== */}
        <div
          className={`border rounded-xl transition-all duration-200 overflow-hidden ${
            isEngineeringExpanded
              ? 'border-sky-300 bg-white shadow-sm ring-1 ring-sky-200'
              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          {/* Card 2 Clickable Header */}
          <button
            type="button"
            onClick={() => setIsEngineeringExpanded((prev) => !prev)}
            className="w-full px-5 py-4 flex items-center justify-between text-left transition focus:outline-hidden"
          >
            <div className="flex items-center space-x-3.5">
              <div
                className={`p-2 rounded-lg transition ${
                  isEngineeringExpanded
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Office Engineering Specification &amp; Load Sizing Suite
                </h3>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 ml-4">
              <span className="text-xs font-semibold text-sky-700 hidden sm:inline">
                {isEngineeringExpanded ? 'Hide Details' : 'Configure Settings'}
              </span>
              <div
                className={`p-1.5 rounded-full transition-transform duration-200 ${
                  isEngineeringExpanded ? 'bg-sky-100 text-sky-800 rotate-180' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          {/* Card 2 Expanded Body */}
          {isEngineeringExpanded && (
            <div className="px-5 pb-6 pt-2 border-t border-sky-100 space-y-6 text-xs">
              {/* Presets Row */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Select Commercial Office Space Preset:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    'Open Office',
                    'Private Office',
                    'Conference Room',
                    'Server / IT Room',
                    'Executive Suite',
                    'Custom Office',
                  ].map((presetName) => (
                    <button
                      key={presetName}
                      type="button"
                      onClick={() => handlePresetSelect(presetName)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition ${
                        zoneRequest.preset_type.toLowerCase() === presetName.toLowerCase()
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {presetName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtab Navigation Bar */}
              <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 rounded-xl text-xs font-medium">
                {[
                  { id: 'geometry', label: '1. Geometry & Criteria' },
                  { id: 'envelope', label: '2. Envelope & Fenestration' },
                  { id: 'internal', label: '3. Occupancy & Ventilation' },
                  { id: 'results', label: '4. Psychrometrics & Sizing' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEngineeringSubTab(tab.id as any)}
                    className={`flex-1 py-2 rounded-lg text-center transition font-semibold ${
                      engineeringSubTab === tab.id
                        ? 'bg-white text-sky-800 shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Subtab 1: Geometry & Criteria */}
              {engineeringSubTab === 'geometry' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-slate-700 font-semibold block text-[11px]">
                        Conditioned Floor Area (m²)
                      </label>
                      <input
                        type="number"
                        step="5"
                        min="5"
                        value={zoneRequest.area_m2}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            area_m2: parseFloat(e.target.value) || 10,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block">Total net floor footprint</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-slate-700 font-semibold block text-[11px]">
                        Floor-to-Ceiling Height (m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2.0"
                        max="8.0"
                        value={zoneRequest.height_m}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            height_m: parseFloat(e.target.value) || 2.8,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Volume:{' '}
                        <strong>{(zoneRequest.area_m2 * zoneRequest.height_m).toFixed(1)} m³</strong>
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-slate-700 font-semibold block text-[11px]">
                        Equipment Cooling COP
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.5"
                        max="6.0"
                        value={zoneRequest.cooling_cop}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            cooling_cop: parseFloat(e.target.value) || 3.0,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block">Coefficient of Performance</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="text-slate-700 font-semibold block text-[11px]">
                        Supply Air Delivery Temp (°C)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="8.0"
                        max="18.0"
                        value={zoneRequest.supply_temp_c || 14.0}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            supply_temp_c: parseFloat(e.target.value) || 14.0,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block">AHU/FCU coil off-coil temperature</span>
                    </div>
                  </div>

                  {/* Design Criteria Row */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      Summer Peak Outdoor &amp; Indoor Design Setpoints:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Outdoor Summer DB Temp (°C)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={zoneRequest.t_out_c}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              t_out_c: parseFloat(e.target.value) || 33.0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Outdoor Summer RH (%)
                        </label>
                        <input
                          type="number"
                          step="1.0"
                          value={zoneRequest.rh_out_pct}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              rh_out_pct: parseFloat(e.target.value) || 65.0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Target Indoor Setpoint Temp (°C)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={zoneRequest.target_temp_c}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              target_temp_c: parseFloat(e.target.value) || 24.0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Target Indoor RH (%)
                        </label>
                        <input
                          type="number"
                          step="1.0"
                          value={zoneRequest.target_rh_pct}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              target_rh_pct: parseFloat(e.target.value) || 50.0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Thermal Comfort Parameters */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">
                      ISO 7730 / ASHRAE 55 Thermal Comfort Parameters:
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Clothing Insulation (clo)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.3"
                          max="2.0"
                          value={zoneRequest.clothing_clo || 0.65}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              clothing_clo: parseFloat(e.target.value) || 0.65,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                        <span className="text-[9px] text-slate-400">Summer office attire ~ 0.5–0.7 clo</span>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Metabolic Rate (met)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.8"
                          max="2.5"
                          value={zoneRequest.met_rate || 1.15}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              met_rate: parseFloat(e.target.value) || 1.15,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                        <span className="text-[9px] text-slate-400">Seated, typing ~ 1.1–1.2 met</span>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Room Air Velocity (m/s)
                        </label>
                        <input
                          type="number"
                          step="0.02"
                          min="0.05"
                          max="0.5"
                          value={zoneRequest.air_velocity_m_s || 0.15}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              air_velocity_m_s: parseFloat(e.target.value) || 0.15,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                        />
                        <span className="text-[9px] text-slate-400">Draft limit standard ~ 0.15 m/s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Envelope & Fenestration */}
              {engineeringSubTab === 'envelope' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Exterior Wall U-Value (W/m²·K)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        value={zoneRequest.wall_u_value || 0.45}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            wall_u_value: parseFloat(e.target.value) || 0.45,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">Insulated spandrel / masonry</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Roof / Ceiling U-Value (W/m²·K)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        value={zoneRequest.roof_u_value || 0.3}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            roof_u_value: parseFloat(e.target.value) || 0.3,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">Deck insulation thermal transfer</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Infiltration Rate (ACH)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.0"
                        max="2.0"
                        value={zoneRequest.ach}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            ach: parseFloat(e.target.value) || 0.25,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">Air Changes per Hour through cracks</span>
                    </div>
                  </div>

                  {/* Multi-Orientation Fenestration Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Multi-Orientation Glazing &amp; Solar Fenestration (N, E, S, W):
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Q_solar = Area × SHGC × Irradiance
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(zoneRequest.windows || []).map((w, idx) => {
                        const solarLoadWatts = w.area_m2 * w.shgc * w.solar_irradiance_w_m2;
                        return (
                          <div
                            key={w.orientation}
                            className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center space-x-2.5">
                              <Sun className="w-4 h-4 text-sky-600 shrink-0" />
                              <div>
                                <span className="font-bold text-slate-800 text-xs">
                                  {w.orientation} Facade
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  Transmitted Solar Load: <strong>{solarLoadWatts.toFixed(0)} W</strong>
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-[10px] sm:w-[420px]">
                              <div>
                                <label className="text-slate-500 block mb-0.5">Area (m²)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={w.area_m2}
                                  onChange={(e) =>
                                    handleWindowChange(
                                      idx,
                                      'area_m2',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 block mb-0.5">U-Value</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.5"
                                  value={w.u_value}
                                  onChange={(e) =>
                                    handleWindowChange(
                                      idx,
                                      'u_value',
                                      parseFloat(e.target.value) || 2.0
                                    )
                                  }
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 block mb-0.5">SHGC</label>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0.1"
                                  max="0.9"
                                  value={w.shgc}
                                  onChange={(e) =>
                                    handleWindowChange(
                                      idx,
                                      'shgc',
                                      parseFloat(e.target.value) || 0.4
                                    )
                                  }
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-slate-500 block mb-0.5">Peak W/m²</label>
                                <input
                                  type="number"
                                  step="10"
                                  min="0"
                                  value={w.solar_irradiance_w_m2}
                                  onChange={(e) =>
                                    handleWindowChange(
                                      idx,
                                      'solar_irradiance_w_m2',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Occupancy & Ventilation */}
              {engineeringSubTab === 'internal' && (
                <div className="space-y-4">
                  {/* Internal Occupancy & Lighting */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Peak Design Occupants (Persons)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={zoneRequest.max_occupants}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            max_occupants: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        ~75W sensible + ~55W latent per person
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Lighting Power Density (W/m²)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={zoneRequest.lpd_w_m2}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            lpd_w_m2: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Total Lighting: <strong>{(zoneRequest.area_m2 * zoneRequest.lpd_w_m2).toFixed(0)} W</strong>
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Infiltration ACH
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={zoneRequest.ach}
                        onChange={(e) =>
                          setZoneRequest({
                            ...zoneRequest,
                            ach: parseFloat(e.target.value) || 0.25,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">Air changes per hour</span>
                    </div>
                  </div>

                  {/* ASHRAE 62.1-2022 Ventilation Rates */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        ASHRAE 62.1-2022 Ventilation Specification:
                      </span>
                      <span className="text-[11px] text-sky-800 font-mono font-semibold">
                        V_oa = (P_z · R_p) + (A_z · R_a) ={' '}
                        {(
                          zoneRequest.max_occupants * zoneRequest.oa_person_l_s +
                          zoneRequest.area_m2 * zoneRequest.oa_area_l_s_m2
                        ).toFixed(1)}{' '}
                        L/s
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          People Outdoor Air Rate R_p (L/s·person)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={zoneRequest.oa_person_l_s}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              oa_person_l_s: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          Area Outdoor Air Rate R_a (L/s·m²)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={zoneRequest.oa_area_l_s_m2}
                          onChange={(e) =>
                            setZoneRequest({
                              ...zoneRequest,
                              oa_area_l_s_m2: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Office Equipment Inventory Table */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          Office Equipment &amp; Plug Loads Inventory:
                        </span>
                        <p className="text-[10px] text-slate-500">
                          Actual sensible heat contribution = Quantity × Rated Power × Diversity Factor
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddEquipment}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white hover:bg-sky-50 text-sky-800 text-[11px] font-semibold border border-sky-300 shadow-2xs transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-sky-600" />
                        <span>Add Appliance</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(zoneRequest.equipment_items || []).map((eq, idx) => {
                        const itemWatts = eq.quantity * eq.rated_power_w * eq.utilization_factor;
                        return (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
                          >
                            <input
                              type="text"
                              value={eq.name}
                              onChange={(e) => {
                                const items = [...(zoneRequest.equipment_items || [])];
                                items[idx] = { ...items[idx], name: e.target.value };
                                setZoneRequest({ ...zoneRequest, equipment_items: items });
                              }}
                              className="font-medium text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 px-1 py-0.5 w-full sm:w-56"
                            />

                            <div className="flex items-center space-x-3 text-[11px]">
                              <div className="flex items-center space-x-1">
                                <span className="text-slate-500">Qty:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={eq.quantity}
                                  onChange={(e) => {
                                    const items = [...(zoneRequest.equipment_items || [])];
                                    items[idx] = {
                                      ...items[idx],
                                      quantity: parseInt(e.target.value) || 0,
                                    };
                                    setZoneRequest({ ...zoneRequest, equipment_items: items });
                                  }}
                                  className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center font-mono"
                                />
                              </div>

                              <div className="flex items-center space-x-1">
                                <span className="text-slate-500">Rated W:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={eq.rated_power_w}
                                  onChange={(e) => {
                                    const items = [...(zoneRequest.equipment_items || [])];
                                    items[idx] = {
                                      ...items[idx],
                                      rated_power_w: parseFloat(e.target.value) || 0,
                                    };
                                    setZoneRequest({ ...zoneRequest, equipment_items: items });
                                  }}
                                  className="w-16 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center font-mono"
                                />
                              </div>

                              <div className="flex items-center space-x-1">
                                <span className="text-slate-500">Factor:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={eq.utilization_factor}
                                  onChange={(e) => {
                                    const items = [...(zoneRequest.equipment_items || [])];
                                    items[idx] = {
                                      ...items[idx],
                                      utilization_factor: parseFloat(e.target.value) || 0,
                                    };
                                    setZoneRequest({ ...zoneRequest, equipment_items: items });
                                  }}
                                  className="w-14 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center font-mono"
                                />
                              </div>

                              <span className="font-mono font-bold text-sky-800 text-[11px] w-16 text-right">
                                {itemWatts.toFixed(0)} W
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveEquipment(idx)}
                                className="text-slate-400 hover:text-red-500 p-1 transition"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Psychrometrics & Sizing Results */}
              {engineeringSubTab === 'results' && (
                <div className="space-y-4">
                  {calcResult ? (
                    <div className="space-y-4">
                      {/* Top Metrics Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                            Sensible Cooling Load
                          </span>
                          <span className="text-lg font-bold text-slate-900 font-mono">
                            {(calcResult.loads_and_airflow?.sensible_cooling_w?.total_sensible_kw ?? 0).toFixed(2)} kW
                          </span>
                          <span className="text-[10px] text-sky-700 block mt-0.5">
                            {calcResult.loads_and_airflow?.sensible_heat_ratio !== undefined
                              ? `SHR: ${(calcResult.loads_and_airflow.sensible_heat_ratio * 100).toFixed(0)}%`
                              : ''}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                            Latent Cooling Load
                          </span>
                          <span className="text-lg font-bold text-slate-900 font-mono">
                            {(calcResult.loads_and_airflow?.latent_cooling_w?.total_latent_kw ?? 0).toFixed(2)} kW
                          </span>
                          <span className="text-[10px] text-sky-700 block mt-0.5">
                            Moisture Dehumidification
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-sky-100/70 border border-sky-300 text-center">
                          <span className="text-[10px] text-sky-900 font-bold uppercase block">
                            Total Cooling Capacity
                          </span>
                          <span className="text-xl font-extrabold text-sky-950 font-mono">
                            {(calcResult.loads_and_airflow?.total_cooling_load_kw ?? 0).toFixed(2)} kW
                          </span>
                          <span className="text-[10px] text-sky-800 font-semibold block mt-0.5">
                            {((calcResult.loads_and_airflow?.total_cooling_load_kw ?? 0) / 3.51685).toFixed(2)} TR (Tons)
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                            Supply Airflow Rate
                          </span>
                          <span className="text-lg font-bold text-slate-900 font-mono">
                            {(calcResult.loads_and_airflow?.hvac_airflow_and_coil?.supply_airflow_m3_h ?? 0).toFixed(0)} m³/h
                          </span>
                          <span className="text-[10px] text-sky-700 block mt-0.5">
                            {((calcResult.loads_and_airflow?.hvac_airflow_and_coil?.supply_airflow_m3_h ?? 0) * 0.588578).toFixed(0)} CFM
                          </span>
                        </div>
                      </div>

                      {/* ISO 7730 Comfort & Calibrated Parameters Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Thermal Comfort */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">
                              ISO 7730 / ASHRAE 55 Thermal Comfort:
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                Math.abs(calcResult.thermal_comfort?.pmv ?? 0) <= 0.5
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {calcResult.thermal_comfort?.compliance_iso7730 || 'Class B'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-center pt-1">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-500 block">PMV Index</span>
                              <span className="text-base font-bold text-slate-900 font-mono">
                                {(calcResult.thermal_comfort?.pmv ?? 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-500 block">PPD Dissatisfied</span>
                              <span className="text-base font-bold text-slate-900 font-mono">
                                {(calcResult.thermal_comfort?.ppd_pct ?? 0).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Derived ODE Coefficients */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">
                              Derived Digital Twin ODE Parameters:
                            </span>
                            <span className="text-[10px] font-mono text-sky-800 font-semibold">
                              Calibrated Physics
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono text-[11px]">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[9px] text-slate-500 block">C_air (J/K)</span>
                              <span className="font-bold text-slate-900">
                                {calcResult.calibrated_twin_parameters?.c_air?.toFixed(0) || '500'}
                              </span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[9px] text-slate-500 block">R_wall (K/W)</span>
                              <span className="font-bold text-slate-900">
                                {calcResult.calibrated_twin_parameters?.r_wall?.toFixed(6) || '0.0105'}
                              </span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[9px] text-slate-500 block">Time Const τ</span>
                              <span className="font-bold text-slate-900">
                                {calcResult.calibrated_twin_parameters?.time_constant_hours?.toFixed(2) || '0.00'}h
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                      <Thermometer className="w-8 h-8 text-sky-600 mx-auto" />
                      <p className="text-xs font-medium">
                        Click &ldquo;Calculate Loads &amp; Sizing&rdquo; below to compute sensible/latent cooling kW, airflow m³/h, and ISO 7730 PMV.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Actions for Office Engineering Suite */}
              <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onCalculateLoads(zoneRequest)}
                  disabled={isCalculating}
                  className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
                  <span>
                    {isCalculating ? 'Computing Cooling Loads...' : 'Calculate Loads & Sizing'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onCalibrateTwin}
                  disabled={isCalibrating}
                  className="py-2.5 px-4 rounded-xl bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 font-semibold text-xs transition shadow-2xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  title="Synchronize architectural C_air and R_wall values to Digital Twin simulator ODE"
                >
                  <Zap className={`w-4 h-4 text-sky-600 ${isCalibrating ? 'animate-spin' : ''}`} />
                  <span>Calibrate Digital Twin (Sync Derived Physics)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
