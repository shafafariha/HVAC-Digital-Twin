"""
Gym-like Environment Wrapper for HVAC Simulator.

Supports three world-model backends:
- pinn: Physics-Informed Neural Network (trained with data + physics loss)
- vanilla_nn: Vanilla neural network (trained with data loss only)
- rc: Purely physics-based RC (Resistance-Capacitance) thermal model
"""

from typing import Tuple, Optional, Dict, Literal

import numpy as np

try:
    import torch
    HAS_TORCH = True
except ImportError:
    torch = None
    HAS_TORCH = False

from .pinn_model import PINNModel
from .rc_model import RCModel

BackendType = Literal["pinn", "vanilla_nn", "rc"]

def _default_state_bounds() -> Dict:
    """Default state bounds (named keys) for normalization."""
    return {
        "T_in": (-10.0, 40.0),
        "H_in": (0.0, 100.0),
        "P_last": (0.0, 5000.0),
        "T_out": (-10.0, 50.0),
        "H_out": (0.0, 100.0),
        "Occupancy": (0.0, 50.0),
    }

def _default_action_bounds(action_dim: int = 5) -> Dict:
    """
    Default action bounds:
    - Source [0,1]
    - Mode   [1,3]
    - Fan    [0,6]
    - Temp   [18,30]
    - TimeSinceAction_sec [0, 86400] (optional 5th dim)
    """
    min_vals = [0.0, 1.0, 0.0, 18.0]
    max_vals = [1.0, 3.0, 6.0, 30.0]
    if action_dim >= 5:
        min_vals.append(0.0)
        max_vals.append(86400.0)  # 1 day max for time-since-action in seconds
    return {
        "min": np.array(min_vals, dtype=np.float64),
        "max": np.array(max_vals, dtype=np.float64),
    }

class HVACSimulator:
    """
    Simulator that wraps a world model into a Gym-like environment.

    State Space: [T_in, H_in, P_last, T_out, H_out, Occupancy]
    Action Space: Discrete actions encoded as indices (546 total)

    Backends:
    - pinn: Trained PINN (data + physics loss)
    - vanilla_nn: Trained NN with data loss only (same architecture as PINN)
    - rc: Deterministic physics-based RC thermal model (no training)
    """

    def __init__(
        self,
        backend: BackendType = "pinn",
        pinn_model: Optional[PINNModel] = None,
        state_dim: int = 6,
        action_dim: int = 4,
        device: str = "cpu",
        normalize: bool = True,
        state_bounds: Optional[Dict] = None,
        action_bounds: Optional[Dict] = None,
        rc_delta_t: float = 60.0,
    ):
        """
        Initialize simulator.

        Args:
            backend: World model variant: "pinn", "vanilla_nn", or "rc"
            pinn_model: Trained PINN or vanilla NN (required for pinn and vanilla_nn; unused for rc)
            state_dim: Dimension of state vector
            action_dim: Dimension of action vector (raw params)
            device: Device to run on ('cpu' or 'cuda')
            normalize: Whether to normalize states for the agent
            state_bounds: Min/max bounds for state normalization (from checkpoint or default)
            action_bounds: Min/max for action normalization (from checkpoint; required for pinn/vanilla_nn)
            rc_delta_t: Time step in seconds for RC model (only when backend="rc")
        """
        if backend not in ("pinn", "vanilla_nn", "rc"):
            raise ValueError(f"backend must be 'pinn', 'vanilla_nn', or 'rc', got {backend!r}")

        self.backend = backend
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.device = device
        self.normalize = normalize
        self._nn_model: Optional[PINNModel] = None
        self._rc_model: Optional[RCModel] = None

        if state_bounds is None:
            self.state_bounds = _default_state_bounds()
        else:
            self.state_bounds = state_bounds

        if action_bounds is None:
            self.action_bounds = _default_action_bounds(action_dim)
        else:
            self.action_bounds = action_bounds

        self._delta_t = rc_delta_t
        self._time_since_action_sec = 0.0

        if backend in ("pinn", "vanilla_nn"):
            if pinn_model is None:
                raise ValueError(f"pinn_model is required when backend={backend!r}")
            self._nn_model = pinn_model.to(device) if hasattr(pinn_model, 'to') else pinn_model
            if hasattr(self._nn_model, 'eval'):
                self._nn_model.eval()
        else:
            self._rc_model = RCModel(delta_t=rc_delta_t)

    def reset(self, initial_state: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Reset the environment to an initial state.

        Args:
            initial_state: Optional initial state (physical units if given). If None, random.

        Returns:
            state: Initial state vector (normalized if normalize=True)
        """
        if initial_state is not None:
            state = np.asarray(initial_state, dtype=np.float64).copy()
        else:
            state = np.array(
                [
                    np.random.uniform(20.0, 30.0),
                    np.random.uniform(40.0, 60.0),
                    0.0,
                    np.random.uniform(15.0, 35.0),
                    np.random.uniform(40.0, 80.0),
                    float(np.random.randint(0, 10)),
                ],
                dtype=np.float64,
            )

        if self.normalize:
            state = self.normalize_state(state)

        self._time_since_action_sec = 0.0
        return state

    def decode_action(self, action_idx: int) -> np.ndarray:
        """
        Decode discrete action index to [Source, Mode, Fan, Temp].

        Total combinations: 2 * 3 * 7 * 13 = 546
        """
        temp_idx = action_idx % 13
        action_idx //= 13
        fan_idx = action_idx % 7
        action_idx //= 7
        mode_idx = action_idx % 3
        source_idx = action_idx // 3

        return np.array(
            [
                float(source_idx),
                float(mode_idx + 1),
                float(fan_idx),
                float(temp_idx + 18),
            ],
            dtype=np.float64,
        )

    def normalize_action(self, action: np.ndarray) -> np.ndarray:
        """Normalize action to [0, 1] using action_bounds (so NN sees same scale as at training)."""
        min_vals = self.action_bounds["min"]
        max_vals = self.action_bounds["max"]
        return ((action - min_vals) / (max_vals - min_vals + 1e-8)).astype(np.float64)

    def normalize_state(self, state: np.ndarray) -> np.ndarray:
        """Normalize state to [0, 1] range."""
        if not self.normalize:
            return state

        normalized = np.zeros_like(state, dtype=np.float64)
        if isinstance(self.state_bounds, dict) and "min" in self.state_bounds:
            min_vals = self.state_bounds["min"]
            max_vals = self.state_bounds["max"]
            for i in range(len(state)):
                normalized[i] = (state[i] - min_vals[i]) / (max_vals[i] - min_vals[i] + 1e-8)
        else:
            keys = ["T_in", "H_in", "P_last", "T_out", "H_out", "Occupancy"]
            for i, key in enumerate(keys):
                lo, hi = self.state_bounds[key]
                normalized[i] = (state[i] - lo) / (hi - lo + 1e-8)
        return normalized

    def denormalize_state(self, state: np.ndarray) -> np.ndarray:
        """Denormalize state from [0, 1] range."""
        if not self.normalize:
            return state

        denorm = np.zeros_like(state, dtype=np.float64)
        if isinstance(self.state_bounds, dict) and "min" in self.state_bounds:
            min_vals = self.state_bounds["min"]
            max_vals = self.state_bounds["max"]
            for i in range(len(state)):
                denorm[i] = state[i] * (max_vals[i] - min_vals[i]) + min_vals[i]
        else:
            keys = ["T_in", "H_in", "P_last", "T_out", "H_out", "Occupancy"]
            for i, key in enumerate(keys):
                lo, hi = self.state_bounds[key]
                denorm[i] = state[i] * (hi - lo) + lo
        return denorm

    def _clip_next_state(self, next_state: np.ndarray) -> np.ndarray:
        """Clip next state to valid bounds."""
        if isinstance(self.state_bounds, dict) and "min" in self.state_bounds:
            min_vals = self.state_bounds["min"]
            max_vals = self.state_bounds["max"]
            lb = [min_vals[0], min_vals[1], 0.0, min_vals[3], min_vals[4], 0.0]
            ub = [max_vals[0], max_vals[1], max_vals[2], max_vals[3], max_vals[4], max_vals[5]]
        else:
            keys = ["T_in", "H_in", "P_last", "T_out", "H_out", "Occupancy"]
            lb = [self.state_bounds[k][0] for k in keys]
            ub = [self.state_bounds[k][1] for k in keys]
            lb[2], lb[5] = 0.0, 0.0
        return np.clip(next_state, lb, ub).astype(np.float64)

    def step(self, state: np.ndarray, action_idx: int) -> Tuple[np.ndarray, float, bool, Dict]:
        """
        Execute one step in the environment.

        Args:
            state: Current state (normalized if normalize=True)
            action_idx: Discrete action index (0–545)

        Returns:
            next_state: Next state (normalized if normalize=True)
            power: Power consumption (W)
            done: Whether episode is done
            info: dict with 'power', 'action_params', 'temperature'
        """
        action_params = self.decode_action(action_idx)

        if self.backend == "rc":
            state_phys = self.denormalize_state(state)
            next_state_denorm = self._rc_model.predict(state_phys, action_params)
        else:
            self._time_since_action_sec += self._delta_t
            if self.action_dim >= 5:
                full_action = np.append(action_params, self._time_since_action_sec).astype(np.float64)
            else:
                full_action = action_params

            state_norm = state if self.normalize else state
            action_norm = self.normalize_action(full_action)

            if hasattr(self._nn_model, '__call__') and (not HAS_TORCH or not isinstance(self._nn_model, torch.nn.Module)):
                next_state_pred = self._nn_model(state_norm, action_norm).squeeze(0)
            else:
                state_t = torch.FloatTensor(state_norm).unsqueeze(0).to(self.device)
                action_t = torch.FloatTensor(action_norm).unsqueeze(0).to(self.device)
                with torch.no_grad():
                    next_state_pred = self._nn_model(state_t, action_t)
                    next_state_pred = next_state_pred.squeeze(0).cpu().numpy()
            next_state_denorm = self.denormalize_state(next_state_pred) if self.normalize else next_state_pred

        next_state_denorm = self._clip_next_state(next_state_denorm)
        power = float(next_state_denorm[2])

        next_state = self.normalize_state(next_state_denorm) if self.normalize else next_state_denorm
        done = False
        info = {
            "power": power,
            "action_params": action_params,
            "temperature": next_state_denorm[0],
        }
        return next_state, power, done, info

    def get_action_space_size(self) -> int:
        """Size of the discrete action space."""
        return 2 * 3 * 7 * 13  # 546

