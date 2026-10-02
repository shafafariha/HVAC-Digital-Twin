"""
FastAPI Backend for Deep-RL HVAC Control with PINN Digital Twin.
Serves as the bridge between the Next.js frontend and the underlying
ML engine (PINN, DQN, RC, and HVAC Simulator).
"""

import sys
import os
import csv
from pathlib import Path
from typing import Dict, List, Optional, Any, Union

import numpy as np

try:
    import torch
    HAS_TORCH = True
except ImportError:
    torch = None
    HAS_TORCH = False

import yaml
import io
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.env.simulator import HVACSimulator, BackendType
from src.env.pinn_model import PINNModel, NumPyPINNModel
from src.agent.dqn import DQNAgent, NumPyDQNAgent
from src.utils.reward import calculate_total_reward

from src.engineering import (
    PsychrometricState,
    OfficeZonePreset,
    OfficeZone,
    BuildingEnvelope,
    WallAssembly,
    MaterialLayer,
    WindowFenestration,
    OccupancySchedule,
    LightingLoad,
    OfficeEquipment,
    OfficeEquipmentItem,
    InternalLoadsSummary,
    VentilationRequirement,
    InfiltrationACH,
    calculate_office_loads,
    calculate_fanger_pmv_ppd,
    derive_twin_parameters,
    MATERIAL_LIBRARY,
)

app = FastAPI(
    title="HVAC Digital Twin & Deep-RL Control API",
    description="FastAPI interface connecting Next.js UI with PINN Digital Twin, RC World Model, and DQN Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Next.js (localhost:3000) and other clients
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = PROJECT_ROOT / "models"
CONFIGS_DIR = PROJECT_ROOT / "configs"
PINN_CHECKPOINT = MODELS_DIR / "pinn_model.pth"
DQN_CHECKPOINT = MODELS_DIR / "dqn_agent.pth"
ENV_COMPARISON_CSV = MODELS_DIR / "env_comparison.csv"
RL_CONFIG_PATH = CONFIGS_DIR / "rl_config.yaml"
PINN_CONFIG_PATH = CONFIGS_DIR / "pinn_config.yaml"

DEVICE = "cuda" if (HAS_TORCH and torch.cuda.is_available()) else "cpu"
PINN_WEIGHTS_NPZ = MODELS_DIR / "pinn_weights.npz"
DQN_WEIGHTS_NPZ = MODELS_DIR / "dqn_weights.npz"

class ModelManager:
    """Manages loaded checkpoints, simulators, and DQN agents in memory."""
    def __init__(self):
        self.device = DEVICE
        self.pinn_info: Optional[Dict[str, Any]] = None
        self.dqn_agent: Optional[Any] = None
        self.simulators: Dict[str, HVACSimulator] = {}
        self.load_models()

    def load_models(self):
        if PINN_WEIGHTS_NPZ.exists():
            try:
                pinn = NumPyPINNModel(str(PINN_WEIGHTS_NPZ))
                self.pinn_info = {
                    "model": pinn,
                    "state_dim": 6,
                    "action_dim": 5,
                    "state_bounds": {
                        "T_in": [15.0, 35.0],
                        "H_in": [20.0, 85.0],
                        "P_last": [0.0, 3500.0],
                        "T_out": [15.0, 45.0],
                        "H_out": [20.0, 95.0],
                        "Occupancy": [0.0, 15.0],
                    },
                    "action_bounds": {
                        "min": np.array([0.0, 0.0, 0.0, 16.0, 0.0]),
                        "max": np.array([1.0, 3.0, 6.0, 29.0, 3600.0]),
                    },
                    "config": {"hidden_dims": [128, 128, 64], "dropout": 0.1},
                    "epochs": 100,
                    "physics_lambda": 0.1,
                }
                print(f"[Backend] Loaded PINN model via lightweight NumPy engine from {PINN_WEIGHTS_NPZ}")
            except Exception as e:
                print(f"[Backend] Failed to load PINN NPZ: {e}")
                self.pinn_info = None
        elif HAS_TORCH and PINN_CHECKPOINT.exists():
            try:
                checkpoint = torch.load(PINN_CHECKPOINT, map_location=self.device, weights_only=False)
                state_dim = checkpoint.get("state_dim", 6)
                action_dim = checkpoint.get("action_dim", 5)
                config = checkpoint.get("config", {})
                hidden_dims = config.get("hidden_dims", [128, 128, 64])

                pinn = PINNModel(
                    state_dim=state_dim,
                    action_dim=action_dim,
                    hidden_dims=hidden_dims,
                ).to(self.device)
                pinn.load_state_dict(checkpoint["model_state_dict"])
                pinn.eval()

                self.pinn_info = {
                    "model": pinn,
                    "state_dim": state_dim,
                    "action_dim": action_dim,
                    "state_bounds": checkpoint.get("state_bounds"),
                    "action_bounds": checkpoint.get("action_bounds"),
                    "config": config,
                    "epochs": config.get("num_epochs", None),
                    "physics_lambda": config.get("physics_lambda", None),
                }
                print(f"[Backend] Loaded PINN model from {PINN_CHECKPOINT}")
            except Exception as e:
                print(f"[Backend] Failed to load PINN checkpoint: {e}")
                self.pinn_info = None

        if DQN_WEIGHTS_NPZ.exists():
            try:
                agent = NumPyDQNAgent(str(DQN_WEIGHTS_NPZ), action_dim=546)
                self.dqn_agent = agent
                print(f"[Backend] Loaded DQN agent via lightweight NumPy engine from {DQN_WEIGHTS_NPZ}")
            except Exception as e:
                print(f"[Backend] Failed to load DQN NPZ: {e}")
                self.dqn_agent = None
        elif HAS_TORCH and DQN_CHECKPOINT.exists():
            try:
                agent = DQNAgent(state_dim=6, action_dim=546, device=self.device)
                agent.load(str(DQN_CHECKPOINT))
                agent.epsilon = 0.0
                agent.q_network.eval()
                agent.target_network.eval()
                self.dqn_agent = agent
                print(f"[Backend] Loaded DQN agent from {DQN_CHECKPOINT}")
            except Exception as e:
                print(f"[Backend] Failed to load DQN checkpoint: {e}")
                self.dqn_agent = None

        self._init_simulators()

    def _init_simulators(self):
        state_bounds = self.pinn_info.get("state_bounds") if self.pinn_info else None
        action_bounds = self.pinn_info.get("action_bounds") if self.pinn_info else None

        if self.pinn_info:
            try:
                self.simulators["pinn"] = HVACSimulator(
                    backend="pinn",
                    pinn_model=self.pinn_info["model"],
                    state_dim=self.pinn_info["state_dim"],
                    action_dim=self.pinn_info["action_dim"],
                    device=self.device,
                    normalize=True,
                    state_bounds=state_bounds,
                    action_bounds=action_bounds,
                    rc_delta_t=60.0,
                )
            except Exception as e:
                print(f"[Backend] Failed to init PINN simulator: {e}")

        try:
            self.simulators["rc"] = HVACSimulator(
                backend="rc",
                pinn_model=None,
                state_dim=6,
                action_dim=4,
                device=self.device,
                normalize=True,
                state_bounds=state_bounds,
                action_bounds=action_bounds,
                rc_delta_t=60.0,
            )
        except Exception as e:
            print(f"[Backend] Failed to init RC simulator: {e}")

    def get_simulator(self, backend: str) -> HVACSimulator:
        backend_clean = backend.lower()
        if backend_clean not in self.simulators:
            if backend_clean == "rc":
                self._init_simulators()
            if backend_clean not in self.simulators:
                raise HTTPException(
                    status_code=400,
                    detail=f"Simulator for backend '{backend}' is not initialized. Available: {list(self.simulators.keys())}",
                )
        return self.simulators[backend_clean]

manager = ModelManager()

def decode_action_index(action_idx: int) -> Dict[str, Union[int, float]]:
    """Decodes action index [0..545] to physical HVAC commands."""
    temp_idx = action_idx % 13
    remainder = action_idx // 13
    fan_idx = remainder % 7
    remainder //= 7
    mode_idx = remainder % 3
    source_idx = remainder // 3

    return {
        "source": int(source_idx),             # 0: OFF, 1: ON
        "mode": int(mode_idx + 1),             # 1: Cool, 2: Heat, 3: Fan Only
        "fan_speed": int(fan_idx),             # 0 - 6
        "target_temp": float(temp_idx + 18),   # 18°C - 30°C
        "action_index": action_idx,
    }

def encode_action_params(source: int, mode: int, fan_speed: int, target_temp: float) -> int:
    """Encodes physical HVAC commands to discrete index [0..545]."""
    src_idx = max(0, min(1, int(round(source))))
    m_idx = max(0, min(2, int(round(mode)) - 1))
    f_idx = max(0, min(6, int(round(fan_speed))))
    t_idx = max(0, min(12, int(round(target_temp)) - 18))
    return ((src_idx * 3 + m_idx) * 7 + f_idx) * 13 + t_idx

class StateVector(BaseModel):
    T_in: float = Field(..., description="Indoor temperature in °C", example=26.5)
    H_in: float = Field(..., description="Indoor relative humidity in %", example=55.0)
    P_last: float = Field(..., description="Last power consumption in Watts", example=350.0)
    T_out: float = Field(..., description="Outdoor disturbance temperature in °C", example=32.0)
    H_out: float = Field(..., description="Outdoor relative humidity in %", example=65.0)
    Occupancy: float = Field(..., description="Number of occupants / presence indicator", example=3.0)

class ActionParams(BaseModel):
    source: int = Field(1, description="0=OFF, 1=ON", ge=0, le=1)
    mode: int = Field(1, description="1=Cool, 2=Heat, 3=Ventilation", ge=1, le=3)
    fan_speed: int = Field(3, description="Fan speed level (0-6)", ge=0, le=6)
    target_temp: float = Field(24.0, description="Setpoint temperature in °C (18-30)", ge=18.0, le=30.0)

class ControlRequest(BaseModel):
    state: StateVector

class ActionCandidate(BaseModel):
    action_index: int
    source: int
    mode: int
    fan_speed: int
    target_temp: float
    q_value: float

class ControlResponse(BaseModel):
    action_index: int
    action_params: ActionParams
    q_value: float
    top_candidates: List[ActionCandidate]
    explanation: str

class SimulateStepRequest(BaseModel):
    state: StateVector
    backend: str = Field("pinn", description="'pinn' or 'rc'")
    action_index: Optional[int] = Field(None, description="Optional discrete action index [0..545]")
    action_params: Optional[ActionParams] = Field(None, description="Optional explicit action controls")
    use_agent: bool = Field(False, description="If True, agent chooses action automatically")

class SimulateStepResponse(BaseModel):
    next_state: StateVector
    power_watts: float
    reward: float
    is_comfort: bool
    comfort_band: Dict[str, float]
    action_taken: ActionParams
    backend_used: str

class TrajectorySimulateRequest(BaseModel):
    initial_state: Optional[StateVector] = None
    steps: int = Field(24, description="Number of steps (e.g. 24 for 24-step cycle)", ge=1, le=300)
    backend: str = Field("pinn", description="'pinn' or 'rc'")
    control_mode: str = Field("dqn", description="'dqn' (autonomous AI), 'manual', or 'fixed_setpoint'")
    manual_action: Optional[ActionParams] = None
    outdoor_temp_pattern: Optional[str] = Field("diurnal", description="'diurnal' (hot afternoon cycle), 'heatwave', or 'constant'")
    occupancy_pattern: Optional[str] = Field("office", description="'office' (9-5 occupancy), 'constant', or 'empty'")

class TrajectoryStepLog(BaseModel):
    step: int
    time_label: str
    T_in: float
    H_in: float
    P_last: float
    T_out: float
    H_out: float
    Occupancy: float
    power_watts: float
    reward: float
    is_comfort: bool
    action: ActionParams

class BatchSimulationSummary(BaseModel):
    filename: str
    total_steps: int
    backend_used: str
    control_mode: str
    comfort_adherence_pct: float
    mean_indoor_temp: float
    mean_power_watts: float
    total_energy_kwh: float
    mean_reward: float

class BatchSimulationResponse(BaseModel):
    summary: BatchSimulationSummary
    trajectory: List[TrajectoryStepLog]

@app.get("/", summary="Root Health Check")
def root_check():
    """Root endpoint for cloud ALB and load balancer health checks."""
    return {"status": "online", "service": "HVAC Digital Twin API"}

@app.get("/health", summary="Service Health Check")
def get_health():
    """Return system health, device info, and loaded model checkpoints."""
    return {
        "status": "online",
        "device": manager.device,
        "models_loaded": {
            "pinn": manager.pinn_info is not None,
            "dqn": manager.dqn_agent is not None,
            "rc": "rc" in manager.simulators,
        },
        "available_backends": list(manager.simulators.keys()),
        "pinn_checkpoint": str(PINN_CHECKPOINT) if PINN_CHECKPOINT.exists() else None,
        "dqn_checkpoint": str(DQN_CHECKPOINT) if DQN_CHECKPOINT.exists() else None,
    }

@app.get("/models", summary="Model Metadata & Specs")
def get_models_info():
    """Return architecture details and metadata for PINN and DQN models."""
    pinn_data = None
    if manager.pinn_info:
        pinn_data = {
            "loaded": True,
            "state_dim": manager.pinn_info["state_dim"],
            "action_dim": manager.pinn_info["action_dim"],
            "hidden_dims": manager.pinn_info["config"].get("hidden_dims", [128, 128, 64]),
            "physics_lambda": manager.pinn_info.get("physics_lambda", 0.1),
            "state_bounds": manager.pinn_info.get("state_bounds"),
            "action_bounds": manager.pinn_info.get("action_bounds"),
        }

    dqn_data = None
    if manager.dqn_agent:
        dqn_data = {
            "loaded": True,
            "state_dim": 6,
            "action_dim": 546,
            "epsilon": manager.dqn_agent.epsilon,
            "gamma": manager.dqn_agent.gamma,
            "action_breakdown": {
                "source": ["0 (OFF)", "1 (ON)"],
                "modes": ["1 (Cool)", "2 (Heat)", "3 (Fan)"],
                "fan_speeds": [0, 1, 2, 3, 4, 5, 6],
                "target_temps": list(range(18, 31)),
            }
        }

    return {
        "device": manager.device,
        "pinn_world_model": pinn_data,
        "dqn_control_agent": dqn_data,
        "rc_analytical_model": {
            "enabled": True,
            "description": "Deterministic Resistance-Capacitance thermal model without weights."
        }
    }

@app.get("/comparison", summary="Environment Backend Benchmark Results")
def get_backend_comparison():
    """Return benchmark metrics comparing PINN, Vanilla NN, and RC backends from env_comparison.csv."""
    if not ENV_COMPARISON_CSV.exists():
        raise HTTPException(status_code=404, detail="env_comparison.csv benchmark file not found.")

    results = []
    try:
        with open(ENV_COMPARISON_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                results.append({
                    "backend": row["backend"],
                    "reward_mean": float(row["reward_mean"]),
                    "reward_std": float(row["reward_std"]),
                    "temp_mean": float(row["temp_mean"]),
                    "temp_std": float(row["temp_std"]),
                    "power_mean": float(row["power_mean"]),
                    "power_std": float(row["power_std"]),
                    "comfort_mean": float(row["comfort_mean"]),
                    "comfort_std": float(row["comfort_std"]),
                })
        return {"data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading benchmark CSV: {str(e)}")

@app.get("/configs", summary="System Hyperparameters & Configs")
def get_configs():
    """Return contents of rl_config.yaml and pinn_config.yaml."""
    rl_cfg = {}
    pinn_cfg = {}
    if RL_CONFIG_PATH.exists():
        with open(RL_CONFIG_PATH, "r") as f:
            rl_cfg = yaml.safe_load(f)
    if PINN_CONFIG_PATH.exists():
        with open(PINN_CONFIG_PATH, "r") as f:
            pinn_cfg = yaml.safe_load(f)

    return {
        "rl_config": rl_cfg,
        "pinn_config": pinn_cfg,
    }

@app.post("/control", response_model=ControlResponse, summary="Query DQN Agent for Optimal Action")
def predict_action(req: ControlRequest):
    """
    Given the current HVAC state vector, evaluate Q-values via DQN agent
    and return the optimal discrete action with physical parameters.
    """
    if manager.dqn_agent is None:
        raise HTTPException(status_code=503, detail="DQN Agent is not loaded.")

    state_arr = np.array([
        req.state.T_in,
        req.state.H_in,
        req.state.P_last,
        req.state.T_out,
        req.state.H_out,
        req.state.Occupancy,
    ], dtype=np.float64)

    sim = manager.get_simulator("pinn") if "pinn" in manager.simulators else manager.get_simulator("rc")
    norm_state = sim.normalize_state(state_arr)

    if hasattr(manager.dqn_agent, 'predict_q_values'):
        q_values_arr = manager.dqn_agent.predict_q_values(norm_state)
    else:
        state_t = torch.FloatTensor(norm_state).unsqueeze(0).to(manager.device)
        with torch.no_grad():
            q_values_arr = manager.dqn_agent.q_network(state_t).squeeze(0).cpu().numpy()

    best_action_idx = int(np.argmax(q_values_arr))
    best_q_val = float(q_values_arr[best_action_idx])

    top_indices = np.argsort(q_values_arr)[-5:][::-1].tolist()
    top_candidates = []
    for idx in top_indices:
        p = decode_action_index(idx)
        top_candidates.append(ActionCandidate(
            action_index=idx,
            source=p["source"],
            mode=p["mode"],
            fan_speed=p["fan_speed"],
            target_temp=p["target_temp"],
            q_value=float(q_values_arr[idx]),
        ))

    best_params = decode_action_index(best_action_idx)
    mode_names = {1: "Cooling", 2: "Heating", 3: "Ventilation"}
    source_name = "ON" if best_params["source"] == 1 else "OFF"
    explanation = (
        f"DQN recommends AC {source_name} in {mode_names.get(best_params['mode'], 'Auto')} mode "
        f"at setpoint {best_params['target_temp']}°C with Fan Speed {best_params['fan_speed']} "
        f"(Estimated Q-value: {best_q_val:.3f})."
    )

    return ControlResponse(
        action_index=best_action_idx,
        action_params=ActionParams(
            source=best_params["source"],
            mode=best_params["mode"],
            fan_speed=best_params["fan_speed"],
            target_temp=best_params["target_temp"],
        ),
        q_value=best_q_val,
        top_candidates=top_candidates,
        explanation=explanation,
    )

@app.post("/simulate", response_model=SimulateStepResponse, summary="Step Simulation with PINN or RC")
def simulate_step(req: SimulateStepRequest):
    """
    Execute one step forward in the chosen world model simulator (PINN or RC).
    """
    sim = manager.get_simulator(req.backend)

    state_arr = np.array([
        req.state.T_in,
        req.state.H_in,
        req.state.P_last,
        req.state.T_out,
        req.state.H_out,
        req.state.Occupancy,
    ], dtype=np.float64)

    if req.use_agent:
        if manager.dqn_agent is None:
            raise HTTPException(status_code=503, detail="DQN Agent is not available for autonomous control.")
        norm_s = sim.normalize_state(state_arr)
        action_idx = manager.dqn_agent.select_action(norm_s, training=False)
    elif req.action_index is not None:
        action_idx = max(0, min(545, req.action_index))
    elif req.action_params is not None:
        action_idx = encode_action_params(
            req.action_params.source,
            req.action_params.mode,
            req.action_params.fan_speed,
            req.action_params.target_temp,
        )
    else:
        action_idx = encode_action_params(1, 1, 3, 24.0)

    norm_state = sim.normalize_state(state_arr)
    next_norm_state, power, done, info = sim.step(norm_state, action_idx)
    next_denorm_state = sim.denormalize_state(next_norm_state)

    next_t_in = float(next_denorm_state[0])
    total_reward, r_comfort, r_energy = calculate_total_reward(
        temperature=next_t_in,
        power=power,
        target_temp=25.0,
        tolerance=2.0,
        w_comfort=0.7,
        w_energy=0.3,
    )
    is_comfort = (23.0 <= next_t_in <= 27.0)

    decoded = decode_action_index(action_idx)
    return SimulateStepResponse(
        next_state=StateVector(
            T_in=round(float(next_denorm_state[0]), 2),
            H_in=round(float(next_denorm_state[1]), 2),
            P_last=round(float(next_denorm_state[2]), 2),
            T_out=round(float(next_denorm_state[3]), 2),
            H_out=round(float(next_denorm_state[4]), 2),
            Occupancy=round(float(next_denorm_state[5]), 1),
        ),
        power_watts=round(power, 2),
        reward=round(total_reward, 4),
        is_comfort=is_comfort,
        comfort_band={"min": 23.0, "max": 27.0, "target": 25.0},
        action_taken=ActionParams(
            source=decoded["source"],
            mode=decoded["mode"],
            fan_speed=decoded["fan_speed"],
            target_temp=decoded["target_temp"],
        ),
        backend_used=req.backend,
    )

@app.post("/simulate/trajectory", response_model=List[TrajectoryStepLog], summary="Multi-Step Trajectory Simulation")
def simulate_trajectory(req: TrajectorySimulateRequest):
    """
    Run multi-step simulation trajectory (e.g. 24-step day cycle)
    comparing autonomous DQN control against environmental disturbances.
    """
    sim = manager.get_simulator(req.backend)

    if req.initial_state:
        curr_state = np.array([
            req.initial_state.T_in,
            req.initial_state.H_in,
            req.initial_state.P_last,
            req.initial_state.T_out,
            req.initial_state.H_out,
            req.initial_state.Occupancy,
        ], dtype=np.float64)
    else:
        curr_state = np.array([28.5, 60.0, 0.0, 31.0, 65.0, 4.0], dtype=np.float64)

    logs = []
    sim.reset(curr_state)

    for step_i in range(req.steps):
        hour_of_day = (8 + step_i) % 24  # Starts at 08:00 AM

        if req.outdoor_temp_pattern == "diurnal":
            rad = ((hour_of_day - 14) / 24.0) * 2 * np.pi
            t_out = 30.0 + 4.5 * np.cos(rad)
            h_out = 65.0 - 10.0 * np.cos(rad)
        elif req.outdoor_temp_pattern == "heatwave":
            t_out = 36.0 + 2.0 * np.sin(step_i * 0.2)
            h_out = 70.0
        else:
            t_out = curr_state[3]
            h_out = curr_state[4]

        if req.occupancy_pattern == "office":
            occupancy = 8.0 if 9 <= hour_of_day <= 18 else 0.0
        else:
            occupancy = curr_state[5]

        curr_state[3] = t_out
        curr_state[4] = h_out
        curr_state[5] = occupancy

        norm_s = sim.normalize_state(curr_state)
        if req.control_mode == "dqn" and manager.dqn_agent is not None:
            action_idx = manager.dqn_agent.select_action(norm_s, training=False)
        elif req.control_mode == "manual" and req.manual_action is not None:
            action_idx = encode_action_params(
                req.manual_action.source,
                req.manual_action.mode,
                req.manual_action.fan_speed,
                req.manual_action.target_temp,
            )
        else:
            action_idx = encode_action_params(1, 1, 3, 24.0)

        next_norm_s, power, _, _ = sim.step(norm_s, action_idx)
        next_denorm_s = sim.denormalize_state(next_norm_s)
        t_in = float(next_denorm_s[0])

        total_reward, r_comfort, r_energy = calculate_total_reward(
            temperature=t_in,
            power=power,
            target_temp=25.0,
            tolerance=2.0,
        )
        is_comfort = (23.0 <= t_in <= 27.0)

        decoded = decode_action_index(action_idx)
        logs.append(TrajectoryStepLog(
            step=step_i + 1,
            time_label=f"{hour_of_day:02d}:00",
            T_in=round(t_in, 2),
            H_in=round(float(next_denorm_s[1]), 2),
            P_last=round(power, 2),
            T_out=round(t_out, 2),
            H_out=round(h_out, 2),
            Occupancy=round(occupancy, 1),
            power_watts=round(power, 2),
            reward=round(total_reward, 4),
            is_comfort=is_comfort,
            action=ActionParams(
                source=decoded["source"],
                mode=decoded["mode"],
                fan_speed=decoded["fan_speed"],
                target_temp=decoded["target_temp"],
            ),
        ))

        curr_state = next_denorm_s.copy()

    return logs

def process_dataframe_simulation(
    df: pd.DataFrame,
    filename: str,
    backend: str = "pinn",
    control_mode: str = "dqn",
    manual_temp: float = 24.0,
    manual_fan: int = 3,
    manual_mode: int = 1,
) -> BatchSimulationResponse:
    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded dataset contains no data rows.")

    col_map = {}
    for c in df.columns:
        clean_c = str(c).strip().lower().replace(" ", "_")
        if clean_c in ["t_in", "tin", "indoor_temp", "indoor_temperature", "temp_in", "temperature_in"]:
            col_map[c] = "T_in"
        elif clean_c in ["h_in", "hin", "indoor_humidity", "humidity_in"]:
            col_map[c] = "H_in"
        elif clean_c in ["p_last", "plast", "power", "power_last", "power_w", "power_watts", "p_prev"]:
            col_map[c] = "P_last"
        elif clean_c in ["t_out", "tout", "outdoor_temp", "outdoor_temperature", "temp_out", "temperature_out"]:
            col_map[c] = "T_out"
        elif clean_c in ["h_out", "hout", "outdoor_humidity", "humidity_out"]:
            col_map[c] = "H_out"
        elif clean_c in ["occupancy", "occ", "people", "occupants", "occupancy_count"]:
            col_map[c] = "Occupancy"
        elif clean_c in ["time", "timestamp", "hour", "step", "time_label"]:
            col_map[c] = "time_label"
        elif clean_c in ["source", "ac_source"]:
            col_map[c] = "Source"
        elif clean_c in ["mode", "ac_mode"]:
            col_map[c] = "Mode"
        elif clean_c in ["fan", "fan_speed"]:
            col_map[c] = "Fan"
        elif clean_c in ["temp", "target_temp", "setpoint"]:
            col_map[c] = "Temp"
    df = df.rename(columns=col_map)

    first_t_in = float(df["T_in"].iloc[0]) if "T_in" in df.columns and pd.notna(df["T_in"].iloc[0]) else 28.5
    first_h_in = float(df["H_in"].iloc[0]) if "H_in" in df.columns and pd.notna(df["H_in"].iloc[0]) else 60.0
    first_p_last = float(df["P_last"].iloc[0]) if "P_last" in df.columns and pd.notna(df["P_last"].iloc[0]) else 0.0

    first_t_out = float(df["T_out"].iloc[0]) if "T_out" in df.columns and pd.notna(df["T_out"].iloc[0]) else 31.0
    first_h_out = float(df["H_out"].iloc[0]) if "H_out" in df.columns and pd.notna(df["H_out"].iloc[0]) else 65.0
    first_occ = float(df["Occupancy"].iloc[0]) if "Occupancy" in df.columns and pd.notna(df["Occupancy"].iloc[0]) else 4.0

    curr_state = np.array([first_t_in, first_h_in, first_p_last, first_t_out, first_h_out, first_occ], dtype=np.float64)

    sim = manager.get_simulator(backend)
    sim.reset(curr_state)

    max_steps = min(len(df), 500)
    logs: List[TrajectoryStepLog] = []

    has_action_cols = all(k in df.columns for k in ["Source", "Mode", "Fan", "Temp"])

    for step_i in range(max_steps):
        row = df.iloc[step_i]

        t_out = float(row["T_out"]) if "T_out" in df.columns and pd.notna(row["T_out"]) else curr_state[3]
        h_out = float(row["H_out"]) if "H_out" in df.columns and pd.notna(row["H_out"]) else curr_state[4]
        occ = float(row["Occupancy"]) if "Occupancy" in df.columns and pd.notna(row["Occupancy"]) else curr_state[5]

        curr_state[3] = t_out
        curr_state[4] = h_out
        curr_state[5] = occ

        norm_s = sim.normalize_state(curr_state)

        if control_mode == "dqn" and manager.dqn_agent is not None:
            action_idx = manager.dqn_agent.select_action(norm_s, training=False)
        elif control_mode != "manual" and has_action_cols and pd.notna(row["Source"]):
            action_idx = encode_action_params(
                int(row["Source"]),
                int(row["Mode"]),
                int(row["Fan"]),
                float(row["Temp"]),
            )
        elif control_mode == "manual":
            action_idx = encode_action_params(1, manual_mode, manual_fan, manual_temp)
        else:
            action_idx = encode_action_params(1, 1, 3, 24.0)

        next_norm_s, power, _, _ = sim.step(norm_s, action_idx)
        next_denorm_s = sim.denormalize_state(next_norm_s)
        t_in = float(next_denorm_s[0])
        h_in = float(next_denorm_s[1])

        total_reward, _, _ = calculate_total_reward(
            temperature=t_in,
            power=power,
            target_temp=25.0,
            tolerance=2.0,
        )
        is_comfort = (23.0 <= t_in <= 27.0)

        if "time_label" in df.columns and pd.notna(row["time_label"]):
            time_label = str(row["time_label"])
        else:
            time_label = f"Step {step_i + 1}"

        decoded = decode_action_index(action_idx)
        logs.append(TrajectoryStepLog(
            step=step_i + 1,
            time_label=time_label,
            T_in=round(t_in, 2),
            H_in=round(h_in, 2),
            P_last=round(power, 2),
            T_out=round(t_out, 2),
            H_out=round(h_out, 2),
            Occupancy=round(occ, 1),
            power_watts=round(power, 2),
            reward=round(total_reward, 4),
            is_comfort=is_comfort,
            action=ActionParams(
                source=decoded["source"],
                mode=decoded["mode"],
                fan_speed=decoded["fan_speed"],
                target_temp=decoded["target_temp"],
            ),
        ))

        curr_state = next_denorm_s.copy()

    total_steps = len(logs)
    comfort_count = sum(1 for log in logs if log.is_comfort)
    comfort_pct = round((comfort_count / total_steps) * 100.0, 1) if total_steps > 0 else 0.0
    mean_tin = round(float(np.mean([log.T_in for log in logs])), 2) if total_steps > 0 else 0.0
    mean_power = round(float(np.mean([log.power_watts for log in logs])), 1) if total_steps > 0 else 0.0
    total_kwh = round(float(np.sum([log.power_watts for log in logs]) * (60.0 / 3600.0) / 1000.0), 3)
    mean_rew = round(float(np.mean([log.reward for log in logs])), 3) if total_steps > 0 else 0.0

    summary = BatchSimulationSummary(
        filename=filename,
        total_steps=total_steps,
        backend_used=backend,
        control_mode=control_mode,
        comfort_adherence_pct=comfort_pct,
        mean_indoor_temp=mean_tin,
        mean_power_watts=mean_power,
        total_energy_kwh=total_kwh,
        mean_reward=mean_rew,
    )
    return BatchSimulationResponse(summary=summary, trajectory=logs)

@app.post("/simulate/upload", response_model=BatchSimulationResponse, summary="Upload CSV/Excel Dataset and Run Simulation")
async def simulate_uploaded_file(
    file: UploadFile = File(...),
    backend: str = Form("pinn"),
    control_mode: str = Form("dqn"),
    manual_temp: float = Form(24.0),
    manual_fan: int = Form(3),
    manual_mode: int = Form(1),
):
    """
    Ingest uploaded Excel (.xlsx, .xls) or CSV (.csv) dataset,
    execute digital twin simulation trajectory, and return full telemetry logs & metrics.
    """
    filename = file.filename or "uploaded_dataset"
    contents = await file.read()

    try:
        if filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            try:
                df = pd.read_csv(io.BytesIO(contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), sep=None, engine="python")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded dataset: {str(e)}")

    return process_dataframe_simulation(
        df=df,
        filename=filename,
        backend=backend,
        control_mode=control_mode,
        manual_temp=manual_temp,
        manual_fan=manual_fan,
        manual_mode=manual_mode,
    )

@app.get("/simulate/sample-dataset", response_model=BatchSimulationResponse, summary="Run Simulation on Built-in Sample Dataset")
def simulate_sample_dataset(
    backend: str = Query("pinn", description="'pinn' or 'rc'"),
    control_mode: str = Query("dqn", description="'dqn' or 'manual'"),
):
    sample_csv_path = PROJECT_ROOT / "data" / "processed" / "sample.csv"
    if not sample_csv_path.exists():
        raise HTTPException(status_code=404, detail="Sample dataset not found.")
    df = pd.read_csv(sample_csv_path).head(48)
    return process_dataframe_simulation(
        df=df,
        filename="dataset.csv (48 steps)",
        backend=backend,
        control_mode=control_mode,
    )

@app.get("/simulate/template-csv", summary="Download Sample CSV Template")
def download_template_csv():
    """Generates and streams a sample CSV template with realistic environmental conditions."""
    csv_content = (
        "time_label,T_out,H_out,Occupancy,T_in,H_in\n"
        "08:00,28.5,68.0,2,28.0,62.0\n"
        "09:00,30.0,66.0,8,27.5,60.0\n"
        "10:00,31.5,64.0,8,26.8,58.0\n"
        "11:00,33.0,62.0,8,26.0,57.0\n"
        "12:00,34.0,60.0,8,25.5,56.0\n"
        "13:00,34.5,59.0,8,25.2,55.0\n"
        "14:00,35.0,58.0,8,25.0,55.0\n"
        "15:00,34.5,60.0,8,25.0,55.0\n"
        "16:00,33.8,61.0,8,25.1,55.0\n"
        "17:00,32.5,63.0,8,25.2,56.0\n"
        "18:00,31.0,65.0,4,25.4,57.0\n"
        "19:00,29.8,67.0,1,25.5,58.0\n"
        "20:00,28.5,69.0,0,25.8,59.0\n"
        "21:00,27.8,70.0,0,26.0,60.0\n"
        "22:00,27.2,71.0,0,26.2,60.0\n"
        "23:00,26.8,72.0,0,26.4,61.0\n"
        "00:00,26.5,73.0,0,26.5,61.0\n"
        "01:00,26.2,74.0,0,26.6,62.0\n"
        "02:00,26.0,75.0,0,26.7,62.0\n"
        "03:00,25.8,75.0,0,26.8,62.0\n"
        "04:00,25.5,76.0,0,26.8,62.0\n"
        "05:00,25.8,75.0,0,26.9,62.0\n"
        "06:00,26.5,73.0,0,27.0,62.0\n"
        "07:00,27.5,70.0,1,27.2,62.0\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="hvac_simulation_template.csv"'},
    )
class WindowInput(BaseModel):
    orientation: str = Field("North", description="Cardinal direction: North, South, East, West")
    area_m2: float = Field(6.0, ge=0.0)
    u_value: float = Field(2.4, ge=0.1)
    shgc: float = Field(0.40, ge=0.01, le=1.0)
    solar_irradiance_w_m2: float = Field(150.0, ge=0.0)

class LayerInput(BaseModel):
    name: str = "Common Brick Masonry"
    thickness_m: float = 0.12
    conductivity_k: float = 0.72

class EquipmentItemInput(BaseModel):
    name: str = "Computer Workstation"
    quantity: int = 10
    rated_power_w: float = 120.0
    utilization_factor: float = 0.75

class EngineeringZoneRequest(BaseModel):
    name: str = Field("Corporate Open Office Floor", description="Zone name")
    preset_type: str = Field("Open Office", description="Preset name from OfficeZonePreset")
    area_m2: float = Field(120.0, ge=5.0)
    height_m: float = Field(3.0, ge=2.0)
    target_temp_c: float = Field(24.0, ge=18.0, le=30.0)
    target_rh_pct: float = Field(50.0, ge=20.0, le=80.0)
    max_occupants: int = Field(12, ge=0)
    lpd_w_m2: float = Field(8.0, ge=0.0)
    ach: float = Field(0.25, ge=0.0)
    oa_person_l_s: float = Field(2.5, ge=0.0)
    oa_area_l_s_m2: float = Field(0.3, ge=0.0)
    wall_u_value: Optional[float] = None
    roof_u_value: Optional[float] = None
    wall_layers: Optional[List[LayerInput]] = None
    windows: Optional[List[WindowInput]] = None
    equipment_items: Optional[List[EquipmentItemInput]] = None
    cooling_cop: float = Field(3.4, ge=1.0)
    t_out_c: float = Field(33.0, description="Outdoor ambient design dry-bulb temperature in °C")
    rh_out_pct: float = Field(65.0, description="Outdoor ambient design relative humidity in %")
    hour_of_day: float = Field(14.0, ge=0.0, le=24.0)
    supply_temp_c: float = Field(14.0, ge=10.0, le=22.0)
    clothing_clo: float = Field(0.65, ge=0.2, le=2.0)
    met_rate: float = Field(1.15, ge=0.8, le=3.0)
    air_velocity_m_s: float = Field(0.15, ge=0.05, le=1.5)

class ControlComparisonRequest(BaseModel):
    zone: EngineeringZoneRequest
    steps: int = Field(24, ge=6, le=168)
    outdoor_temp_pattern: str = Field("diurnal", description="'diurnal', 'heatwave', or 'constant'")
    baseline_setpoint_c: float = Field(24.0, ge=18.0, le=30.0)

def _build_zone_from_request(req: EngineeringZoneRequest) -> OfficeZone:
    preset_enum = OfficeZonePreset.CUSTOM_OFFICE
    for p in OfficeZonePreset:
        if p.value.lower() == req.preset_type.lower():
            preset_enum = p
            break

    if req.wall_layers and len(req.wall_layers) > 0:
        layers = [MaterialLayer(l.name, l.thickness_m, l.conductivity_k) for l in req.wall_layers]
        wall_assembly = WallAssembly(name="Custom Specified Wall", layers=layers)
    else:
        wall_assembly = WallAssembly()
    if req.wall_u_value is not None and req.wall_u_value > 0:
        wall_assembly.u_value = round(float(req.wall_u_value), 4)

    if req.windows and len(req.windows) > 0:
        windows = [
            WindowFenestration(
                orientation=w.orientation,
                area_m2=w.area_m2,
                u_value=w.u_value,
                shgc=w.shgc,
                solar_irradiance_w_m2=w.solar_irradiance_w_m2,
            )
            for w in req.windows
        ]
    else:
        windows = None

    gross_wall = round(4.0 * (req.area_m2 ** 0.5) * req.height_m, 2)
    envelope = BuildingEnvelope(
        wall_assembly=wall_assembly,
        gross_wall_area_m2=gross_wall,
        roof_area_m2=req.area_m2 if req.preset_type != "Server / IT Room" else 0.0,
        floor_area_m2=req.area_m2,
        windows=windows,
    )
    if req.roof_u_value is not None and req.roof_u_value > 0:
        envelope.roof_assembly.u_value = round(float(req.roof_u_value), 4)

    occ = OccupancySchedule(max_occupants=req.max_occupants)
    light = LightingLoad(lpd_w_m2=req.lpd_w_m2)
    if req.equipment_items and len(req.equipment_items) > 0:
        eq_items = [
            OfficeEquipmentItem(item.name, item.quantity, item.rated_power_w, item.utilization_factor)
            for item in req.equipment_items
        ]
        equipment = OfficeEquipment(eq_items)
    else:
        equipment = OfficeEquipment()

    internal_loads = InternalLoadsSummary(occupancy=occ, lighting=light, equipment=equipment)
    ventilation = VentilationRequirement(req.oa_person_l_s, req.oa_area_l_s_m2)
    infiltration = InfiltrationACH(req.ach)

    return OfficeZone(
        name=req.name,
        preset_type=preset_enum,
        area_m2=req.area_m2,
        height_m=req.height_m,
        target_temp_c=req.target_temp_c,
        target_rh_pct=req.target_rh_pct,
        envelope=envelope,
        internal_loads=internal_loads,
        ventilation=ventilation,
        infiltration=infiltration,
        cooling_cop=req.cooling_cop,
    )

@app.get("/engineering/presets", summary="Get Office Zone Presets and Materials Library")
def get_engineering_presets():
    from src.engineering.building_geometry import get_default_zone_spec
    presets = []
    for p in OfficeZonePreset:
        presets.append({
            "preset_type": p.value,
            "defaults": get_default_zone_spec(p),
        })
    return {
        "presets": presets,
        "materials_library": MATERIAL_LIBRARY,
    }

@app.post("/engineering/calculate", summary="Execute Transparent Office HVAC Load and Comfort Calculations")
def calculate_engineering_metrics(req: EngineeringZoneRequest):
    zone = _build_zone_from_request(req)
    loads_data = calculate_office_loads(
        zone=zone,
        t_out_c=req.t_out_c,
        rh_out_pct=req.rh_out_pct,
        t_in_c=req.target_temp_c,
        rh_in_pct=req.target_rh_pct,
        hour_of_day=req.hour_of_day,
        supply_temp_c=req.supply_temp_c,
    )
    comfort_result = calculate_fanger_pmv_ppd(
        ta=req.target_temp_c,
        tr=req.target_temp_c,
        vel=req.air_velocity_m_s,
        rh=req.target_rh_pct,
        met=req.met_rate,
        clo=req.clothing_clo,
    )
    twin_params = derive_twin_parameters(zone, t_out_design_c=req.t_out_c, rh_out_design_pct=req.rh_out_pct)

    cool_comp = loads_data["cooling_loads"]["components"]
    cool_sum = loads_data["cooling_loads"]["summary"]
    air_coil = loads_data["airflow_and_coil"]
    heat_loads = loads_data.get("heating_loads", {})

    psychro_out = loads_data["psychrometrics"]["outdoor"]
    psychro_in = loads_data["psychrometrics"]["indoor"]

    supply_psychro = PsychrometricState(req.supply_temp_c, 90.0).to_dict()

    oa_ratio = min(1.0, max(0.05, loads_data.get("ventilation_flow", {}).get("oa_ratio", 0.15)))
    t_mix = round(oa_ratio * req.t_out_c + (1.0 - oa_ratio) * req.target_temp_c, 2)
    rh_mix = round(oa_ratio * req.rh_out_pct + (1.0 - oa_ratio) * req.target_rh_pct, 1)
    mixed_psychro = PsychrometricState(t_mix, rh_mix).to_dict()

    formatted_loads = {
        "zone_name": zone.name,
        "total_cooling_load_kw": cool_sum["total_cooling_kw"],
        "total_cooling_load_tr": cool_sum["total_cooling_tons"],
        "sensible_heat_ratio": cool_sum["sensible_heat_ratio_shr"],
        "sensible_cooling_w": {
            "conduction_wall_roof_w": cool_comp["envelope_conduction_w"],
            "solar_fenestration_w": cool_comp["solar_radiation_gain_w"],
            "occupants_sensible_w": cool_comp["people_sensible_w"],
            "lighting_w": cool_comp["lighting_w"],
            "equipment_w": cool_comp["equipment_plug_load_w"],
            "ventilation_sensible_w": cool_comp["ventilation_sensible_w"],
            "infiltration_sensible_w": cool_comp["infiltration_sensible_w"],
            "total_sensible_w": cool_sum["total_sensible_w"],
            "total_sensible_kw": round(cool_sum["total_sensible_w"] / 1000.0, 3),
        },
        "latent_cooling_w": {
            "occupants_latent_w": cool_comp["people_latent_w"],
            "ventilation_latent_w": cool_comp["ventilation_latent_w"],
            "infiltration_latent_w": cool_comp["infiltration_latent_w"],
            "total_latent_w": cool_sum["total_latent_w"],
            "total_latent_kw": round(cool_sum["total_latent_w"] / 1000.0, 3),
        },
        "heating_load_w": {
            "conduction_w": heat_loads.get("envelope_transmission_loss_w", 0.0),
            "ventilation_sensible_w": heat_loads.get("ventilation_heating_loss_w", 0.0),
            "infiltration_sensible_w": heat_loads.get("infiltration_heating_loss_w", 0.0),
            "total_heating_kw": heat_loads.get("net_heating_required_kw", 0.0),
        },
        "hvac_airflow_and_coil": {
            "supply_airflow_m3_h": air_coil["volume_flow_m3_h"],
            "supply_airflow_l_s": round(air_coil["volume_flow_m3_h"] / 3.6, 1),
            "air_mass_flow_kg_s": air_coil["mass_flow_kg_s"],
            "supply_air_delta_t_k": air_coil["delta_t_supply_c"],
            "coil_cooling_total_kw": cool_sum["total_cooling_kw"],
            "coil_sensible_kw": round(cool_sum["total_sensible_w"] / 1000.0, 3),
            "coil_latent_kw": round(cool_sum["total_latent_w"] / 1000.0, 3),
            "coil_shr": cool_sum["sensible_heat_ratio_shr"],
            "fan_power_w": air_coil["fan_power_w"],
            "design_static_pressure_pa": air_coil["static_pressure_pa"],
        },
        "psychrometrics": {
            "outdoor": psychro_out,
            "room": psychro_in,
            "supply_air": supply_psychro,
            "mixed_air": mixed_psychro,
        },
        "raw_loads": loads_data,
    }

    return {
        "zone_spec": zone.to_dict(),
        "loads_and_airflow": formatted_loads,
        "thermal_comfort": comfort_result.to_dict(),
        "calibrated_twin_parameters": twin_params.to_dict(),
    }

@app.post("/engineering/calibrate-twin", summary="Apply Office Engineering Parameters to Calibrate Digital Twin")
def calibrate_digital_twin(req: EngineeringZoneRequest):
    zone = _build_zone_from_request(req)
    twin_params = derive_twin_parameters(zone, t_out_design_c=req.t_out_c, rh_out_design_pct=req.rh_out_pct)

    if "rc" in manager.simulators and hasattr(manager.simulators["rc"], "_rc_model") and manager.simulators["rc"]._rc_model:
        manager.simulators["rc"]._rc_model.C_air = twin_params.c_air
        manager.simulators["rc"]._rc_model.R_wall = max(0.0001, twin_params.r_wall)
        manager.simulators["rc"]._rc_model.COP = twin_params.cop

    return {
        "status": "success",
        "message": f"Digital Twin successfully calibrated for office zone '{zone.name}'.",
        "parameters": twin_params.to_dict(),
    }

@app.post("/engineering/compare-control", summary="Side-by-Side Comparison: Autonomous DQN vs Rule-Based Baseline")
def compare_controllers(req: ControlComparisonRequest):
    zone = _build_zone_from_request(req.zone)
    sim = manager.get_simulator("pinn" if "pinn" in manager.simulators else "rc")

    init_state = np.array([28.0, 60.0, 0.0, 31.0, 65.0, float(req.zone.max_occupants * 0.5)], dtype=np.float64)

    dqn_logs = []
    baseline_logs = []

    sim.reset(init_state)
    s_curr = init_state.copy()
    for step_i in range(req.steps):
        hour_of_day = (8 + step_i) % 24
        if req.outdoor_temp_pattern == "diurnal":
            rad = ((hour_of_day - 14) / 24.0) * 2 * np.pi
            t_out = 30.0 + 4.5 * np.cos(rad)
            h_out = 65.0 - 10.0 * np.cos(rad)
        else:
            t_out = req.zone.t_out_c
            h_out = req.zone.rh_out_pct

        occ = float(req.zone.max_occupants) if 9 <= hour_of_day <= 18 else 0.0
        s_curr[3] = t_out
        s_curr[4] = h_out
        s_curr[5] = occ

        norm_s = sim.normalize_state(s_curr)
        if manager.dqn_agent:
            action_idx = manager.dqn_agent.select_action(norm_s, training=False)
        else:
            action_idx = encode_action_params(1, 1, 3, req.zone.target_temp_c)

        next_norm_s, power, _, _ = sim.step(norm_s, action_idx)
        next_s = sim.denormalize_state(next_norm_s)
        t_in = float(next_s[0])
        reward, _, _ = calculate_total_reward(t_in, power, target_temp=req.zone.target_temp_c)
        decoded = decode_action_index(action_idx)

        dqn_logs.append({
            "step": step_i + 1,
            "time_label": f"{hour_of_day:02d}:00",
            "T_in": round(t_in, 2),
            "power_w": round(power, 1),
            "reward": round(reward, 3),
            "is_comfort": 23.0 <= t_in <= 27.0,
            "action": decoded,
        })
        s_curr = next_s.copy()

    sim.reset(init_state)
    s_curr = init_state.copy()
    for step_i in range(req.steps):
        hour_of_day = (8 + step_i) % 24
        if req.outdoor_temp_pattern == "diurnal":
            rad = ((hour_of_day - 14) / 24.0) * 2 * np.pi
            t_out = 30.0 + 4.5 * np.cos(rad)
            h_out = 65.0 - 10.0 * np.cos(rad)
        else:
            t_out = req.zone.t_out_c
            h_out = req.zone.rh_out_pct

        occ = float(req.zone.max_occupants) if 9 <= hour_of_day <= 18 else 0.0
        s_curr[3] = t_out
        s_curr[4] = h_out
        s_curr[5] = occ

        t_in_current = s_curr[0]
        if t_in_current > req.baseline_setpoint_c + 0.5:
            base_action_idx = encode_action_params(1, 1, 4, req.baseline_setpoint_c)
        elif t_in_current < req.baseline_setpoint_c - 0.5:
            base_action_idx = encode_action_params(0, 1, 1, req.baseline_setpoint_c)
        else:
            base_action_idx = encode_action_params(1, 1, 1, req.baseline_setpoint_c)

        norm_s = sim.normalize_state(s_curr)
        next_norm_s, power, _, _ = sim.step(norm_s, base_action_idx)
        next_s = sim.denormalize_state(next_norm_s)
        t_in = float(next_s[0])
        reward, _, _ = calculate_total_reward(t_in, power, target_temp=req.baseline_setpoint_c)
        decoded = decode_action_index(base_action_idx)

        baseline_logs.append({
            "step": step_i + 1,
            "time_label": f"{hour_of_day:02d}:00",
            "T_in": round(t_in, 2),
            "power_w": round(power, 1),
            "reward": round(reward, 3),
            "is_comfort": 23.0 <= t_in <= 27.0,
            "action": decoded,
        })
        s_curr = next_s.copy()

    total_steps = len(dqn_logs)
    dqn_kwh = round(sum(l["power_w"] for l in dqn_logs) * (60.0 / 3600.0) / 1000.0, 3)
    base_kwh = round(sum(l["power_w"] for l in baseline_logs) * (60.0 / 3600.0) / 1000.0, 3)
    dqn_comfort_pct = round(sum(1 for l in dqn_logs if l["is_comfort"]) / total_steps * 100.0, 1)
    base_comfort_pct = round(sum(1 for l in baseline_logs if l["is_comfort"]) / total_steps * 100.0, 1)
    dqn_mean_t = round(float(np.mean([l["T_in"] for l in dqn_logs])), 2)
    base_mean_t = round(float(np.mean([l["T_in"] for l in baseline_logs])), 2)
    dqn_mean_rew = round(float(np.mean([l["reward"] for l in dqn_logs])), 3)
    base_mean_rew = round(float(np.mean([l["reward"] for l in baseline_logs])), 3)
    energy_diff_pct = round(((base_kwh - dqn_kwh) / max(0.001, base_kwh)) * 100.0, 1)

    return {
        "zone_name": zone.name,
        "steps_evaluated": total_steps,
        "summary": {
            "dqn_energy_kwh": dqn_kwh,
            "baseline_energy_kwh": base_kwh,
            "energy_savings_pct": energy_diff_pct,
            "dqn_comfort_compliance_pct": dqn_comfort_pct,
            "baseline_comfort_compliance_pct": base_comfort_pct,
            "dqn_mean_temp_c": dqn_mean_t,
            "baseline_mean_temp_c": base_mean_t,
            "dqn_mean_reward": dqn_mean_rew,
            "baseline_mean_reward": base_mean_rew,
        },
        "dqn_trajectory": dqn_logs,
        "baseline_trajectory": baseline_logs,
        "evaluation_note": "Comparative evaluation under identical thermal dynamics and environmental disturbances."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
