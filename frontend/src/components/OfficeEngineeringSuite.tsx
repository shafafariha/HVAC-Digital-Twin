'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Sliders,
  Wind,
  Sun,
  Users,
  Cpu,
  Gauge,
  CheckCircle2,
  RefreshCw,
  Layers,
  Thermometer,
  ShieldCheck,
  Zap,
  Menu,
} from 'lucide-react';
import {
  EngineeringZoneRequest,
  EngineeringCalculationResponse,
  ZonePresetItem,
  WindowFenestrationInput,
  OfficeEquipmentInput,
  CalibratedTwinParameters,
} from '@/lib/types';
import {
  fetchEngineeringPresets,
  calculateEngineeringLoads,
  calibrateDigitalTwin,
} from '@/lib/api';

interface OfficeEngineeringSuiteProps {
  onTwinCalibrated?: (params: CalibratedTwinParameters) => void;
  onOpenOffCanvas?: (section?: 'control' | 'engineering') => void;
  zoneRequest?: EngineeringZoneRequest;
  setZoneRequest?: React.Dispatch<React.SetStateAction<EngineeringZoneRequest>>;
  calcResult?: EngineeringCalculationResponse | null;
  onCalculateLoads?: (req?: EngineeringZoneRequest) => void;
  isCalculating?: boolean;
}

const DEFAULT_WINDOWS: WindowFenestrationInput[] = [
  { orientation: 'North', area_m2: 8.0, u_value: 2.2, shgc: 0.40, solar_irradiance_w_m2: 120.0 },
  { orientation: 'South', area_m2: 10.0, u_value: 2.2, shgc: 0.35, solar_irradiance_w_m2: 280.0 },
  { orientation: 'East', area_m2: 6.0, u_value: 2.4, shgc: 0.42, solar_irradiance_w_m2: 320.0 },
  { orientation: 'West', area_m2: 6.0, u_value: 2.4, shgc: 0.38, solar_irradiance_w_m2: 360.0 },
];

const DEFAULT_EQUIPMENT: OfficeEquipmentInput[] = [
  { name: 'Workstation PC & Dual Monitors', quantity: 12, rated_power_w: 140.0, utilization_factor: 0.75 },
  { name: 'Network Multi-Function Printer / Copier', quantity: 1, rated_power_w: 450.0, utilization_factor: 0.30 },
  { name: 'Local Network Switch & PoE Hub', quantity: 1, rated_power_w: 120.0, utilization_factor: 0.90 },
];

export const OfficeEngineeringSuite: React.FC<OfficeEngineeringSuiteProps> = ({
  onTwinCalibrated,
  onOpenOffCanvas,
  zoneRequest: externalZoneRequest,
  setZoneRequest: externalSetZoneRequest,
  calcResult: externalCalcResult,
  onCalculateLoads: externalOnCalculateLoads,
  isCalculating: externalIsCalculating,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'envelope' | 'internal' | 'results'>('results');
  const [presets, setPresets] = useState<ZonePresetItem[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState<boolean>(false);
  const [internalIsCalculating, setInternalIsCalculating] = useState<boolean>(false);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationNotice, setCalibrationNotice] = useState<string | null>(null);

  const isCalculating = externalIsCalculating !== undefined ? externalIsCalculating : internalIsCalculating;

  // Form State
  const [internalZoneRequest, setInternalZoneRequest] = useState<EngineeringZoneRequest>({
    name: 'Main Open Office Zone',
    preset_type: 'Open Office',
    area_m2: 120.0,
    height_m: 3.0,
    target_temp_c: 24.0,
    target_rh_pct: 50.0,
    max_occupants: 12,
    lpd_w_m2: 8.0,
    ach: 0.25,
    oa_person_l_s: 2.5,
    oa_area_l_s_m2: 0.3,
    wall_u_value: 0.45,
    roof_u_value: 0.30,
    windows: DEFAULT_WINDOWS,
    equipment_items: DEFAULT_EQUIPMENT,
    cooling_cop: 3.4,
    t_out_c: 33.0,
    rh_out_pct: 65.0,
    hour_of_day: 14.0,
    supply_temp_c: 14.0,
    clothing_clo: 0.65,
    met_rate: 1.15,
    air_velocity_m_s: 0.15,
  });

  const zoneRequest = externalZoneRequest || internalZoneRequest;
  const setZoneRequest = externalSetZoneRequest || setInternalZoneRequest;

  const [internalCalcResult, setInternalCalcResult] = useState<EngineeringCalculationResponse | null>(null);
  const calcResult = externalCalcResult !== undefined ? externalCalcResult : internalCalcResult;

  // Load presets on mount
  useEffect(() => {
    async function loadPresets() {
      setIsLoadingPresets(true);
      try {
        const data = await fetchEngineeringPresets();
        if (data.presets && data.presets.length > 0) {
          setPresets(data.presets);
        }
      } catch (err) {
        console.warn('Preset fetching offline; using local defaults.', err);
      } finally {
        setIsLoadingPresets(false);
      }
    }
    loadPresets();
  }, []);

  // Run calculation helper
  const handleCalculate = useCallback(async (customReq?: EngineeringZoneRequest) => {
    if (externalOnCalculateLoads) {
      externalOnCalculateLoads(customReq || zoneRequest);
      return;
    }
    setInternalIsCalculating(true);
    setCalibrationNotice(null);
    try {
      const reqToRun = customReq || zoneRequest;
      const res = await calculateEngineeringLoads(reqToRun);
      setInternalCalcResult(res);
      setActiveTab('results');
    } catch (err: any) {
      alert(`Engineering Calculation Failed: ${err.message}`);
    } finally {
      setInternalIsCalculating(false);
    }
  }, [zoneRequest, externalOnCalculateLoads]);

  // Initial calculation on mount if not provided externally
  useEffect(() => {
    if (externalCalcResult === undefined) {
      handleCalculate(zoneRequest);
    }
  }, []); // Run once on mount

  // Handle Preset Selection
  const handleApplyPreset = (presetName: string) => {
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
          : DEFAULT_EQUIPMENT,
      };
      setZoneRequest(updated);
      handleCalculate(updated);
    } else {
      setZoneRequest((prev) => ({ ...prev, preset_type: presetName }));
    }
  };

  // Calibrate Digital Twin
  const handleCalibrateTwin = async () => {
    setIsCalibrating(true);
    try {
      const res = await calibrateDigitalTwin(zoneRequest);
      setCalibrationNotice(res.message);
      if (onTwinCalibrated) {
        onTwinCalibrated(res.parameters);
      }
    } catch (err: any) {
      alert(`Twin Calibration Failed: ${err.message}`);
    } finally {
      setIsCalibrating(false);
    }
  };

  // Window update helper
  const handleWindowChange = (index: number, field: keyof WindowFenestrationInput, value: number) => {
    const wins = [...(zoneRequest.windows || DEFAULT_WINDOWS)];
    wins[index] = {
      ...wins[index],
      [field]: value,
    };
    setZoneRequest({ ...zoneRequest, windows: wins });
  };

  return (
    <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sky-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-semibold text-slate-800 tracking-tight">
              Office Engineering Specification & Load Sizing Suite
            </h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-medium">
              Zone: {zoneRequest.name}
            </span>
            <span>•</span>
            <span>{zoneRequest.area_m2} m²</span>
            <span>•</span>
            <span>{zoneRequest.max_occupants} Max Occupants</span>
            <span>•</span>
            <span>COP {zoneRequest.cooling_cop}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {onOpenOffCanvas && (
            <button
              onClick={() => onOpenOffCanvas('engineering')}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-300 transition shadow-2xs"
              title="Configure Office Engineering Specifications in Off-Canvas Menu"
            >
              <Menu className="w-3.5 h-3.5 text-sky-700" />
              <span>Input Controls (☰)</span>
            </button>
          )}

          <button
            onClick={() => handleCalculate()}
            disabled={isCalculating}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
            <span>{isCalculating ? 'Computing Loads...' : 'Calculate Loads'}</span>
          </button>

          <button
            onClick={handleCalibrateTwin}
            disabled={isCalibrating}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white border border-sky-300 hover:bg-sky-50 text-sky-800 text-xs font-medium transition shadow-2xs disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-sky-600 ${isCalibrating ? 'animate-spin' : ''}`} />
            <span>Calibrate Digital Twin</span>
          </button>
        </div>
      </div>

      {/* Calibration Alert */}
      {calibrationNotice && (
        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{calibrationNotice}</span>
          </div>
          <button
            onClick={() => setCalibrationNotice(null)}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}


      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-4 text-xs font-medium text-slate-600">
        <button
          onClick={() => setActiveTab('architecture')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'architecture'
              ? 'border-sky-600 text-sky-700 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          1. Zone Geometry & Presets
        </button>
        <button
          onClick={() => setActiveTab('envelope')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'envelope'
              ? 'border-sky-600 text-sky-700 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          2. Envelope & Fenestration
        </button>
        <button
          onClick={() => setActiveTab('internal')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'internal'
              ? 'border-sky-600 text-sky-700 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          3. Internal Gains & Ventilation
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'results'
              ? 'border-sky-600 text-sky-700 font-semibold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          4. Load Breakdown & Twin Bridge
        </button>
      </div>

      {/* Tab 1: Zone Geometry & Presets */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Select Standard Commercial Office Preset:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
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
                  onClick={() => handleApplyPreset(name)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition ${
                    zoneRequest.preset_type.toLowerCase() === name.toLowerCase()
                      ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Geometry Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Zone Floor Area (m²)</label>
              <input
                type="number"
                step="5"
                min="5"
                value={zoneRequest.area_m2}
                onChange={(e) => setZoneRequest({ ...zoneRequest, area_m2: parseFloat(e.target.value) || 10 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[10px] text-slate-400">Total conditioned floor space</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Ceiling Height (m)</label>
              <input
                type="number"
                step="0.1"
                min="2.0"
                max="8.0"
                value={zoneRequest.height_m}
                onChange={(e) => setZoneRequest({ ...zoneRequest, height_m: parseFloat(e.target.value) || 2.8 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[10px] text-slate-400">Floor-to-ceiling clear height</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Calculated Volume (m³)</label>
              <div className="w-full bg-white/70 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold">
                {(zoneRequest.area_m2 * zoneRequest.height_m).toFixed(1)} m³
              </div>
              <span className="text-[10px] text-slate-400">Air thermal mass volume</span>
            </div>

            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Equipment Cooling COP</label>
              <input
                type="number"
                step="0.1"
                min="1.5"
                max="6.0"
                value={zoneRequest.cooling_cop}
                onChange={(e) => setZoneRequest({ ...zoneRequest, cooling_cop: parseFloat(e.target.value) || 3.0 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[10px] text-slate-400">Coefficient of Performance</span>
            </div>
          </div>

          {/* Design Indoor / Outdoor Conditions */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-3">Outdoor & Indoor Design Criteria:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-xl border border-sky-100 space-y-1">
                <span className="text-[11px] text-slate-500">Outdoor Design Temp (°C)</span>
                <input
                  type="number"
                  step="0.5"
                  value={zoneRequest.t_out_c}
                  onChange={(e) => setZoneRequest({ ...zoneRequest, t_out_c: parseFloat(e.target.value) || 30.0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-sky-100 space-y-1">
                <span className="text-[11px] text-slate-500">Outdoor Relative Humidity (%)</span>
                <input
                  type="number"
                  step="1.0"
                  min="10"
                  max="100"
                  value={zoneRequest.rh_out_pct}
                  onChange={(e) => setZoneRequest({ ...zoneRequest, rh_out_pct: parseFloat(e.target.value) || 60.0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-sky-100 space-y-1">
                <span className="text-[11px] text-slate-500">Indoor Temp Setpoint (°C)</span>
                <input
                  type="number"
                  step="0.5"
                  min="18"
                  max="28"
                  value={zoneRequest.target_temp_c}
                  onChange={(e) => setZoneRequest({ ...zoneRequest, target_temp_c: parseFloat(e.target.value) || 24.0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium"
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-sky-100 space-y-1">
                <span className="text-[11px] text-slate-500">Indoor Target Humidity (%)</span>
                <input
                  type="number"
                  step="1.0"
                  min="20"
                  max="80"
                  value={zoneRequest.target_rh_pct}
                  onChange={(e) => setZoneRequest({ ...zoneRequest, target_rh_pct: parseFloat(e.target.value) || 50.0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Envelope & Fenestration */}
      {activeTab === 'envelope' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Exterior Wall Overall U-Value (W/(m²·K))
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="3.0"
                value={zoneRequest.wall_u_value || 0.45}
                onChange={(e) => setZoneRequest({ ...zoneRequest, wall_u_value: parseFloat(e.target.value) || 0.45 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
              />
              <p className="text-[11px] text-slate-500">
                Corresponds to R-value of {((1 / (zoneRequest.wall_u_value || 0.45))).toFixed(2)} (m²·K)/W. Standard insulated brick / concrete masonry.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Roof Overall U-Value (W/(m²·K))
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="2.5"
                value={zoneRequest.roof_u_value || 0.30}
                onChange={(e) => setZoneRequest({ ...zoneRequest, roof_u_value: parseFloat(e.target.value) || 0.30 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
              />
              <p className="text-[11px] text-slate-500">
                Corresponds to R-value of {((1 / (zoneRequest.roof_u_value || 0.30))).toFixed(2)} (m²·K)/W. Commercial built-up roof with continuous insulation.
              </p>
            </div>
          </div>

          {/* Windows / Fenestration by Orientation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-700">
                Window Fenestration & Solar Gains by Cardinal Orientation:
              </h3>
              <span className="text-[11px] text-slate-500">
                Formula: Q_solar = A_window × SHGC × I_solar
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Orientation</th>
                    <th className="px-3 py-2.5">Area (m²)</th>
                    <th className="px-3 py-2.5">U-Value (W/(m²·K))</th>
                    <th className="px-3 py-2.5">SHGC</th>
                    <th className="px-3 py-2.5">Design Solar Irradiance (W/m²)</th>
                    <th className="px-3 py-2.5 text-right">Est. Peak Solar (W)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(zoneRequest.windows || DEFAULT_WINDOWS).map((w, idx) => {
                    const estSolar = w.area_m2 * w.shgc * w.solar_irradiance_w_m2;
                    return (
                      <tr key={w.orientation} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-800">{w.orientation}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={w.area_m2}
                            onChange={(e) => handleWindowChange(idx, 'area_m2', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            value={w.u_value}
                            onChange={(e) => handleWindowChange(idx, 'u_value', parseFloat(e.target.value) || 2.0)}
                            className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            max="0.9"
                            value={w.shgc}
                            onChange={(e) => handleWindowChange(idx, 'shgc', parseFloat(e.target.value) || 0.4)}
                            className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="10"
                            min="0"
                            value={w.solar_irradiance_w_m2}
                            onChange={(e) => handleWindowChange(idx, 'solar_irradiance_w_m2', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-sky-800">
                          {estSolar.toFixed(0)} W
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Internal Gains & Ventilation */}
      {activeTab === 'internal' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Occupants */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-1.5 text-slate-700 font-semibold text-xs">
                <Users className="w-4 h-4 text-sky-600" />
                <span>Occupancy Heat Gains</span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500">Design Peak Occupants</label>
                <input
                  type="number"
                  min="0"
                  value={zoneRequest.max_occupants}
                  onChange={(e) => setZoneRequest({ ...zoneRequest, max_occupants: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                ASHRAE standard office metabolism: ~75 W sensible + 55 W latent per person.
              </p>
            </div>

            {/* Lighting */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-1.5 text-slate-700 font-semibold text-xs">
                <Sun className="w-4 h-4 text-sky-600" />
                <span>Lighting Power Density (LPD)</span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500">LPD (W/m²)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={zoneRequest.lpd_w_m2}
                  onChange={(e) => setZoneRequest({ ...zoneRequest, lpd_w_m2: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Total lighting load: {(zoneRequest.lpd_w_m2 * zoneRequest.area_m2).toFixed(0)} W. Modern LED office target ~6-8 W/m².
              </p>
            </div>

            {/* Ventilation ASHRAE 62.1 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-1.5 text-slate-700 font-semibold text-xs">
                <Wind className="w-4 h-4 text-sky-600" />
                <span>ASHRAE 62.1 Outdoor Air</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Rp (L/s·person)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={zoneRequest.oa_person_l_s}
                    onChange={(e) => setZoneRequest({ ...zoneRequest, oa_person_l_s: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Ra (L/s·m²)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={zoneRequest.oa_area_l_s_m2}
                    onChange={(e) => setZoneRequest({ ...zoneRequest, oa_area_l_s_m2: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Combined OA: {(zoneRequest.oa_person_l_s * zoneRequest.max_occupants + zoneRequest.oa_area_l_s_m2 * zoneRequest.area_m2).toFixed(1)} L/s.
              </p>
            </div>
          </div>

          {/* Equipment Inventory */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-2">Office Equipment & Plug Load Inventory:</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Equipment Name</th>
                    <th className="px-3 py-2.5">Quantity</th>
                    <th className="px-3 py-2.5">Rated Power (W)</th>
                    <th className="px-3 py-2.5">Utilization Factor</th>
                    <th className="px-3 py-2.5 text-right">Heat Output (W)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(zoneRequest.equipment_items || DEFAULT_EQUIPMENT).map((eq, idx) => {
                    const heat = eq.quantity * eq.rated_power_w * eq.utilization_factor;
                    return (
                      <tr key={eq.name} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-800">{eq.name}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={eq.quantity}
                            onChange={(e) => {
                              const items = [...(zoneRequest.equipment_items || DEFAULT_EQUIPMENT)];
                              items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 0 };
                              setZoneRequest({ ...zoneRequest, equipment_items: items });
                            }}
                            className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={eq.rated_power_w}
                            onChange={(e) => {
                              const items = [...(zoneRequest.equipment_items || DEFAULT_EQUIPMENT)];
                              items[idx] = { ...items[idx], rated_power_w: parseFloat(e.target.value) || 0 };
                              setZoneRequest({ ...zoneRequest, equipment_items: items });
                            }}
                            className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1.0"
                            value={eq.utilization_factor}
                            onChange={(e) => {
                              const items = [...(zoneRequest.equipment_items || DEFAULT_EQUIPMENT)];
                              items[idx] = { ...items[idx], utilization_factor: parseFloat(e.target.value) || 0 };
                              setZoneRequest({ ...zoneRequest, equipment_items: items });
                            }}
                            className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-sky-800">
                          {heat.toFixed(0)} W
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Results & Twin Bridge */}
      {activeTab === 'results' && calcResult && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-sky-50/60 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[11px] text-sky-700 font-medium block">Total Cooling Load</span>
              <span className="text-xl font-bold text-sky-950 font-mono">
                {calcResult.loads_and_airflow.total_cooling_load_kw.toFixed(2)} kW
              </span>
              <span className="text-[10px] text-sky-600 block mt-0.5">
                ({calcResult.loads_and_airflow.total_cooling_load_tr.toFixed(2)} TR)
              </span>
            </div>

            <div className="bg-sky-50/60 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[11px] text-sky-700 font-medium block">Sensible Heat Ratio (SHR)</span>
              <span className="text-xl font-bold text-sky-950 font-mono">
                {calcResult.loads_and_airflow.sensible_heat_ratio.toFixed(2)}
              </span>
              <span className="text-[10px] text-sky-600 block mt-0.5">
                Sensible: {calcResult.loads_and_airflow.sensible_cooling_w.total_sensible_kw.toFixed(2)} kW
              </span>
            </div>

            <div className="bg-sky-50/60 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[11px] text-sky-700 font-medium block">Supply Airflow Rate</span>
              <span className="text-xl font-bold text-sky-950 font-mono">
                {calcResult.loads_and_airflow.hvac_airflow_and_coil.supply_airflow_m3_h.toFixed(0)} m³/h
              </span>
              <span className="text-[10px] text-sky-600 block mt-0.5">
                ({calcResult.loads_and_airflow.hvac_airflow_and_coil.supply_airflow_l_s.toFixed(0)} L/s)
              </span>
            </div>

            <div className="bg-sky-50/60 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[11px] text-sky-700 font-medium block">Fanger PMV / PPD</span>
              <span className="text-xl font-bold text-sky-950 font-mono">
                {calcResult.thermal_comfort.pmv > 0 ? `+${calcResult.thermal_comfort.pmv.toFixed(2)}` : calcResult.thermal_comfort.pmv.toFixed(2)}
              </span>
              <span className="text-[10px] text-sky-600 block mt-0.5">
                PPD: {calcResult.thermal_comfort.ppd_pct.toFixed(1)}% ({calcResult.thermal_comfort.compliance_iso7730})
              </span>
            </div>
          </div>

          {/* Load Component Breakdown Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-semibold text-xs text-slate-700">
                Sensible Cooling Heat Gains (W & kW)
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Wall & Roof Conduction (UA·ΔT)</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.conduction_wall_roof_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Window Solar Fenestration (A·SHGC·I)</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.solar_fenestration_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Occupants Sensible Gains</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.occupants_sensible_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Lighting (LPD × Area)</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.lighting_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Office Equipment / Plug Loads</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.equipment_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Ventilation Outdoor Air (Sensible)</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.ventilation_sensible_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">Infiltration Air (Sensible)</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                      {calcResult.loads_and_airflow.sensible_cooling_w.infiltration_sensible_w.toFixed(0)} W
                    </td>
                  </tr>
                  <tr className="bg-sky-50/50 font-bold text-sky-900">
                    <td className="px-3 py-2">Total Sensible Cooling Load</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {calcResult.loads_and_airflow.sensible_cooling_w.total_sensible_kw.toFixed(2)} kW
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-semibold text-xs text-slate-700">
                  Latent Cooling & Coil Specifications
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-3 py-2 text-slate-600">Occupants Latent Gains (Perspiration)</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                        {calcResult.loads_and_airflow.latent_cooling_w.occupants_latent_w.toFixed(0)} W
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-600">Ventilation Moisture Dehumidification</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                        {calcResult.loads_and_airflow.latent_cooling_w.ventilation_latent_w.toFixed(0)} W
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-600">Infiltration Moisture Load</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                        {calcResult.loads_and_airflow.latent_cooling_w.infiltration_latent_w.toFixed(0)} W
                      </td>
                    </tr>
                    <tr className="bg-sky-50/50 font-semibold text-sky-900">
                      <td className="px-3 py-2">Total Latent Cooling Load</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {calcResult.loads_and_airflow.latent_cooling_w.total_latent_kw.toFixed(2)} kW
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-600">Coil Total Capacity (Gross)</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                        {calcResult.loads_and_airflow.hvac_airflow_and_coil.coil_cooling_total_kw.toFixed(2)} kW
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-600">Supply Fan Motor Electrical Draw</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                        {calcResult.loads_and_airflow.hvac_airflow_and_coil.fan_power_w.toFixed(0)} W
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Psychrometric State Table */}
              <div className="bg-slate-50/70 p-3 border-t border-slate-200">
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Psychrometric Points Summary (ASHRAE Fundamentals):
                </span>
                <div className="grid grid-cols-4 gap-2 text-[10px] text-center">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-500 font-medium block">Outdoor</span>
                    <span className="font-mono text-slate-800">{calcResult.loads_and_airflow.psychrometrics.outdoor.t_db_c}°C</span>
                    <span className="text-slate-400 block">{calcResult.loads_and_airflow.psychrometrics.outdoor.rh_pct}% RH</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-500 font-medium block">Room</span>
                    <span className="font-mono text-slate-800">{calcResult.loads_and_airflow.psychrometrics.room.t_db_c}°C</span>
                    <span className="text-slate-400 block">{calcResult.loads_and_airflow.psychrometrics.room.rh_pct}% RH</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-500 font-medium block">Supply Air</span>
                    <span className="font-mono text-slate-800">{calcResult.loads_and_airflow.psychrometrics.supply_air.t_db_c}°C</span>
                    <span className="text-slate-400 block">{(calcResult.loads_and_airflow.psychrometrics.supply_air.w_kg_kg * 1000).toFixed(1)} g/kg</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <span className="text-slate-500 font-medium block">Mixed Air</span>
                    <span className="font-mono text-slate-800">{calcResult.loads_and_airflow.psychrometrics.mixed_air.t_db_c}°C</span>
                    <span className="text-slate-400 block">{(calcResult.loads_and_airflow.psychrometrics.mixed_air.w_kg_kg * 1000).toFixed(1)} g/kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calibrated Digital Twin Parameters Banner */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-semibold text-sky-900">
                Synchronize Parameters with Digital Twin Simulator
              </span>
            </div>

            <button
              onClick={handleCalibrateTwin}
              disabled={isCalibrating}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition shadow-xs shrink-0 disabled:opacity-50"
            >
              {isCalibrating ? 'Applying Calibration...' : 'Apply Calibration to Simulator'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
