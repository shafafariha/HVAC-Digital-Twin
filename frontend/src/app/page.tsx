'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { TelemetryGrid } from '@/components/TelemetryGrid';
import { ActionPreview } from '@/components/ActionPreview';
import { SimulationChart } from '@/components/SimulationChart';
import { ModelBenchmark } from '@/components/ModelBenchmark';
import { DataUploadSection } from '@/components/DataUploadSection';
import { ControlComparisonCard } from '@/components/ControlComparisonCard';
import { InputControlsAccordion } from '@/components/InputControlsAccordion';
import { AlertCircle, Sliders, Play, RotateCcw, Zap } from 'lucide-react';
import {
  fetchHealth,
  fetchComparison,
  predictAction,
  simulateStep,
  simulateTrajectory,
  fetchEngineeringPresets,
  calculateEngineeringLoads,
  calibrateDigitalTwin,
} from '@/lib/api';
import {
  HealthResponse,
  BenchmarkRecord,
  StateVector,
  ActionParams,
  ControlResponse,
  TrajectoryStepLog,
  BatchSimulationResponse,
  EngineeringZoneRequest,
  CalibratedTwinParameters,
  ZonePresetItem,
  EngineeringCalculationResponse,
} from '@/lib/types';

const INITIAL_STATE: StateVector = {
  T_in: 28.5,
  H_in: 60.0,
  P_last: 0.0,
  T_out: 32.0,
  H_out: 65.0,
  Occupancy: 4.0,
};

const DEFAULT_MANUAL_ACTION: ActionParams = {
  source: 1,
  mode: 1,
  fan_speed: 3,
  target_temp: 24.0,
};

const DEFAULT_ZONE: EngineeringZoneRequest = {
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
  cooling_cop: 3.4,
  t_out_c: 33.0,
  rh_out_pct: 65.0,
  hour_of_day: 14.0,
  supply_temp_c: 14.0,
  clothing_clo: 0.65,
  met_rate: 1.15,
  air_velocity_m_s: 0.15,
};

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Office Engineering Specification State
  const [currentZone, setCurrentZone] = useState<EngineeringZoneRequest>(DEFAULT_ZONE);
  const [calcResult, setCalcResult] = useState<EngineeringCalculationResponse | null>(null);
  const [calibratedTwinParams, setCalibratedTwinParams] = useState<CalibratedTwinParameters | null>(null);
  const [isInputControlsOpen, setIsInputControlsOpen] = useState<boolean>(false);
  const [presets, setPresets] = useState<ZonePresetItem[]>([]);
  const [isCalculatingLoads, setIsCalculatingLoads] = useState<boolean>(false);
  const [isCalibratingTwin, setIsCalibratingTwin] = useState<boolean>(false);

  // Simulation State
  const [state, setState] = useState<StateVector>(INITIAL_STATE);
  const [powerWatts, setPowerWatts] = useState<number>(0);
  const [reward, setReward] = useState<number>(0);

  // Controls & Backend Selection
  const [backend, setBackend] = useState<'pinn' | 'rc'>('pinn');
  const [controlMode, setControlMode] = useState<'dqn' | 'manual'>('dqn');
  const [manualAction, setManualAction] = useState<ActionParams>(DEFAULT_MANUAL_ACTION);
  const [currentAction, setCurrentAction] = useState<ActionParams>(DEFAULT_MANUAL_ACTION);
  const [controlResponse, setControlResponse] = useState<ControlResponse | null>(null);

  // Trajectory Log
  const [history, setHistory] = useState<TrajectoryStepLog[]>([]);

  const handleTwinCalibrated = useCallback((params: CalibratedTwinParameters) => {
    setCalibratedTwinParams(params);
  }, []);

  // Fetch presets on mount
  useEffect(() => {
    async function loadPresets() {
      try {
        const p = await fetchEngineeringPresets();
        if (p.presets && p.presets.length > 0) setPresets(p.presets);
      } catch (err) {
        console.warn('Preset fetch offline fallback:', err);
      }
    }
    loadPresets();
  }, []);

  const handleCalculateLoads = useCallback(async (customZone?: EngineeringZoneRequest) => {
    setIsCalculatingLoads(true);
    try {
      const zoneToCalc = customZone || currentZone;
      const res = await calculateEngineeringLoads(zoneToCalc);
      setCalcResult(res);
      if (res.calibrated_twin_parameters) {
        setCalibratedTwinParams(res.calibrated_twin_parameters);
      }
    } catch (err: any) {
      console.error('Calculate loads error:', err);
      alert(`Calculation error: ${err.message}`);
    } finally {
      setIsCalculatingLoads(false);
    }
  }, [currentZone]);

  const handleCalibrateTwin = useCallback(async () => {
    setIsCalibratingTwin(true);
    try {
      const res = await calibrateDigitalTwin(currentZone);
      handleTwinCalibrated(res.parameters);
      alert(`Digital Twin Successfully Calibrated!\n${res.message}`);
    } catch (err: any) {
      console.error('Calibration error:', err);
      alert(`Calibration error: ${err.message}`);
    } finally {
      setIsCalibratingTwin(false);
    }
  }, [currentZone, handleTwinCalibrated]);

  // 1. Initial Load: Health, Benchmarks, Initial Agent Policy, Initial Load Sizing
  useEffect(() => {
    async function init() {
      const h = await fetchHealth();
      setHealth(h);

      if (h.status !== 'online') {
        // SnapDeploy container may be waking up, retry after 5 seconds
        setTimeout(async () => {
          const retryH = await fetchHealth();
          if (retryH.status === 'online') {
            setHealth(retryH);
            const retryB = await fetchComparison();
            setBenchmarks(retryB);
            try {
              const ctrl = await predictAction(INITIAL_STATE);
              setControlResponse(ctrl);
              setCurrentAction(ctrl.action_params);
            } catch (err) {}
          }
        }, 5000);
      }

      const b = await fetchComparison();
      setBenchmarks(b);

      try {
        const ctrl = await predictAction(INITIAL_STATE);
        setControlResponse(ctrl);
        setCurrentAction(ctrl.action_params);
      } catch (err) {
        console.warn('Backend service is offline or unreachable:', err);
      }

      try {
        const res = await calculateEngineeringLoads(DEFAULT_ZONE);
        setCalcResult(res);
        if (res.calibrated_twin_parameters) {
          setCalibratedTwinParams(res.calibrated_twin_parameters);
        }
      } catch (err) {
        console.warn('Initial engineering load calculation offline fallback:', err);
      }
    }
    init();
  }, []);

  // 2. Step Simulation Forward
  const handleStep = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await simulateStep({
        state,
        backend,
        use_agent: controlMode === 'dqn',
        action_params: controlMode === 'manual' ? manualAction : undefined,
      });

      setState(res.next_state);
      setPowerWatts(res.power_watts);
      setReward(res.reward);
      setCurrentAction(res.action_taken);

      const newStepLog: TrajectoryStepLog = {
        step: history.length + 1,
        time_label: `Step ${history.length + 1}`,
        T_in: res.next_state.T_in,
        H_in: res.next_state.H_in,
        P_last: res.power_watts,
        T_out: res.next_state.T_out,
        H_out: res.next_state.H_out,
        Occupancy: res.next_state.Occupancy,
        power_watts: res.power_watts,
        reward: res.reward,
        is_comfort: res.is_comfort,
        action: res.action_taken,
      };
      setHistory((prev) => [...prev.slice(-30), newStepLog]);

      if (controlMode === 'dqn') {
        const ctrl = await predictAction(res.next_state);
        setControlResponse(ctrl);
      }
    } catch (err: any) {
      console.error('Simulation step error:', err);
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [state, backend, controlMode, manualAction, history]);

  // 3. Query DQN Agent Policy without Stepping
  const handleQueryAgent = useCallback(async () => {
    setIsLoading(true);
    try {
      const ctrl = await predictAction(state);
      setControlResponse(ctrl);
      setCurrentAction(ctrl.action_params);
    } catch (err: any) {
      alert(`DQN policy inference error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [state]);

  // 4. Run 24h Trajectory Cycle
  const handleRun24h = useCallback(async () => {
    setIsLoading(true);
    try {
      const logs = await simulateTrajectory({
        initial_state: state,
        steps: 24,
        backend,
        control_mode: controlMode,
        manual_action: controlMode === 'manual' ? manualAction : undefined,
        outdoor_temp_pattern: 'diurnal',
        occupancy_pattern: 'office',
      });

      if (logs && logs.length > 0) {
        setHistory(logs);
        const last = logs[logs.length - 1];
        setState({
          T_in: last.T_in,
          H_in: last.H_in,
          P_last: last.power_watts,
          T_out: last.T_out,
          H_out: last.H_out,
          Occupancy: last.Occupancy,
        });
        setPowerWatts(last.power_watts);
        setReward(last.reward);
        setCurrentAction(last.action);
      }
    } catch (err: any) {
      alert(`24-hour trajectory simulation error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [state, backend, controlMode, manualAction]);

  // 5. Reset Simulation
  const handleReset = useCallback(() => {
    setState(INITIAL_STATE);
    setPowerWatts(0);
    setReward(0);
    setHistory([]);
    setCurrentAction(DEFAULT_MANUAL_ACTION);
    setControlResponse(null);
  }, []);

  // 6. Handle Batch/File Dataset Simulation Complete
  const handleBatchSimulationComplete = useCallback((result: BatchSimulationResponse) => {
    if (result.trajectory && result.trajectory.length > 0) {
      setHistory(result.trajectory);
      const last = result.trajectory[result.trajectory.length - 1];
      setState({
        T_in: last.T_in,
        H_in: last.H_in,
        P_last: last.power_watts,
        T_out: last.T_out,
        H_out: last.H_out,
        Occupancy: last.Occupancy,
      });
      setPowerWatts(last.power_watts);
      setReward(last.reward);
      setCurrentAction(last.action);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar
        health={health}
        onReset={handleReset}
        onRun24h={handleRun24h}
        onToggleInputControls={() => setIsInputControlsOpen((prev) => !prev)}
        isInputControlsOpen={isInputControlsOpen}
        isLoading={isLoading}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Backend Status Notice */}
        {health?.status !== 'online' && (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-2xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-sky-700 shrink-0" />
              <span>
                <strong>Connecting to Cloud Backend:</strong> SnapDeploy free container wakes up automatically upon visit (~15-20 detik). Jika baru dibuka, tunggu sejenak atau klik Reconnect.
              </span>
            </div>
            <button
              onClick={async () => {
                const h = await fetchHealth();
                setHealth(h);
                if (h.status === 'online') {
                  const b = await fetchComparison();
                  setBenchmarks(b);
                  try {
                    const ctrl = await predictAction(INITIAL_STATE);
                    setControlResponse(ctrl);
                    setCurrentAction(ctrl.action_params);
                  } catch (err) {}
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium transition shadow-xs shrink-0"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Downwards-Expanding Input Controls Panel */}
        <InputControlsAccordion
          isOpen={isInputControlsOpen}
          onToggleOpen={() => setIsInputControlsOpen((prev) => !prev)}
          backend={backend}
          setBackend={setBackend}
          controlMode={controlMode}
          setControlMode={setControlMode}
          manualAction={manualAction}
          setManualAction={setManualAction}
          state={state}
          setState={setState}
          onStep={handleStep}
          onQueryAgent={handleQueryAgent}
          onRun24h={handleRun24h}
          onReset={handleReset}
          isLoading={isLoading}
          calibratedTwinParams={calibratedTwinParams}
          zoneRequest={currentZone}
          setZoneRequest={setCurrentZone}
          calcResult={calcResult}
          presets={presets}
          onCalculateLoads={handleCalculateLoads}
          onCalibrateTwin={handleCalibrateTwin}
          isCalculating={isCalculatingLoads}
          isCalibrating={isCalibratingTwin}
        />

        {/* 1. Live Telemetry Matrix */}
        <TelemetryGrid state={state} powerWatts={powerWatts} reward={reward} />

        {/* 2. Active HVAC Control Command & AI Policy Preview */}
        <ActionPreview
          currentAction={currentAction}
          controlResponse={controlResponse}
          controlMode={controlMode}
        />

        {/* 3. Dynamics Trajectory Chart with Interactive Point Click */}
        <SimulationChart history={history} />

        {/* 4. Control Strategy Evaluation: DQN Agent vs Baseline Thermostat */}
        <ControlComparisonCard currentZone={currentZone} />

        {/* 5. Multi-Model Benchmark Comparison */}
        <ModelBenchmark benchmarks={benchmarks} />

        {/* 6. Dataset Batch Simulation (Excel / CSV) */}
        <DataUploadSection
          backend={backend}
          controlMode={controlMode}
          manualTemp={manualAction.target_temp}
          onSimulationComplete={handleBatchSimulationComplete}
        />
      </main>

      {/* Floating Input Controls Quick Launcher (Scrolls & Opens Downwards) */}
      <button
        onClick={() => {
          setIsInputControlsOpen(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xl flex items-center space-x-2 border border-sky-400 transition hover:scale-105"
        title="Open Input Controls (Opens Downwards)"
      >
        <Sliders className="w-4 h-4 text-white" />
        <span>Input Controls ▾</span>
      </button>

      {/* Centered Footer */}
      <footer className="border-t border-sky-100 bg-white py-4 text-center text-xs text-slate-500">
        HVAC Digital Twin & Reinforcement Learning System • Physics-Informed Neural Networks • Next.js & FastAPI
      </footer>
    </div>
  );
}
