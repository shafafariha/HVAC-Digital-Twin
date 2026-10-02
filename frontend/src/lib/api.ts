/**
 * Typed API Client for FastAPI HVAC Backend
 */

import {
  HealthResponse,
  BenchmarkRecord,
  StateVector,
  ControlResponse,
  SimulateStepRequest,
  SimulateStepResponse,
  TrajectorySimulateRequest,
  TrajectoryStepLog,
  BatchSimulationResponse,
  EngineeringZoneRequest,
  EngineeringPresetsResponse,
  EngineeringCalculationResponse,
  CalibratedTwinParameters,
  ControlComparisonRequest,
  ControlComparisonResponse,
} from './types';

const PRODUCTION_API_URL = 'https://hvac-digital-twin-c0eaf.containers.snapdeploy.app';
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');

export async function wakeBackend(): Promise<void> {
  try {
    await fetch('https://snapdeploy.dev/api/public/wake/hvac-digital-twin-c0eaf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (e) {
    // ignore
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 503) {
        wakeBackend();
      }
      throw new Error(`Health check failed: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    wakeBackend();
    return {
      status: 'offline',
      device: 'unknown',
      models_loaded: { pinn: false, dqn: false, rc: false },
      available_backends: [],
    };
  }
}

export async function fetchComparison(): Promise<BenchmarkRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/comparison`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch comparison failed`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    // Graceful offline fallback benchmark numbers
    return [
      {
        backend: 'pinn',
        reward_mean: 69.82,
        reward_std: 0.001,
        temp_mean: 23.98,
        temp_std: 0.012,
        power_mean: 30.3,
        power_std: 0.18,
        comfort_mean: 100.0,
        comfort_std: 0.0,
      },
      {
        backend: 'vanilla_nn',
        reward_mean: -248.85,
        reward_std: 148.44,
        temp_mean: 21.29,
        temp_std: 1.69,
        power_mean: 944.85,
        power_std: 36.95,
        comfort_mean: 20.4,
        comfort_std: 36.89,
      },
      {
        backend: 'rc',
        reward_mean: -106.21,
        reward_std: 95.92,
        temp_mean: 26.45,
        temp_std: 1.61,
        power_mean: 1508.24,
        power_std: 233.84,
        comfort_mean: 40.6,
        comfort_std: 33.65,
      },
    ];
  }
}

export async function predictAction(state: StateVector): Promise<ControlResponse> {
  const res = await fetch(`${API_BASE}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Control API error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

export async function simulateStep(req: SimulateStepRequest): Promise<SimulateStepResponse> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Simulate API error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

export async function simulateTrajectory(
  req: TrajectorySimulateRequest
): Promise<TrajectoryStepLog[]> {
  const res = await fetch(`${API_BASE}/simulate/trajectory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Trajectory API error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

export async function uploadAndSimulateDataset(
  file: File,
  backend: string = 'pinn',
  controlMode: string = 'dqn',
  manualTemp: number = 24.0,
  manualFan: number = 3,
  manualMode: number = 1
): Promise<BatchSimulationResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('backend', backend);
  formData.append('control_mode', controlMode);
  formData.append('manual_temp', manualTemp.toString());
  formData.append('manual_fan', manualFan.toString());
  formData.append('manual_mode', manualMode.toString());

  const res = await fetch(`${API_BASE}/simulate/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) detail = parsed.detail;
    } catch {}
    throw new Error(detail);
  }

  return await res.json();
}

export async function simulateSampleDataset(
  backend: string = 'pinn',
  controlMode: string = 'dqn'
): Promise<BatchSimulationResponse> {
  const res = await fetch(
    `${API_BASE}/simulate/sample-dataset?backend=${encodeURIComponent(backend)}&control_mode=${encodeURIComponent(controlMode)}`
  );
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Sample dataset simulation error: ${errorText}`);
  }
  return await res.json();
}

export function getTemplateCsvUrl(): string {
  return `${API_BASE}/simulate/template-csv`;
}

export async function fetchEngineeringPresets(): Promise<EngineeringPresetsResponse> {
  const res = await fetch(`${API_BASE}/engineering/presets`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch engineering presets: ${res.statusText}`);
  }
  return await res.json();
}

export async function calculateEngineeringLoads(
  req: EngineeringZoneRequest
): Promise<EngineeringCalculationResponse> {
  const res = await fetch(`${API_BASE}/engineering/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Engineering calculation error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

export async function calibrateDigitalTwin(
  req: EngineeringZoneRequest
): Promise<{ status: string; message: string; parameters: CalibratedTwinParameters }> {
  const res = await fetch(`${API_BASE}/engineering/calibrate-twin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Twin calibration error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

export async function compareControllers(
  req: ControlComparisonRequest
): Promise<ControlComparisonResponse> {
  const res = await fetch(`${API_BASE}/engineering/compare-control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Control comparison error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

