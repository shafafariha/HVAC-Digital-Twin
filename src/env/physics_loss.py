"""
Physics-Informed Loss for Thermal Dynamics.

Implements the heat balance equation to constrain the PINN predictions.
When state/next_state_pred are normalized [0,1], pass state_bounds so the
residual is computed in physical units (°C, W).
"""
from __future__ import annotations
from typing import Optional, Dict

try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    HAS_TORCH = False

if HAS_TORCH:
    def thermal_physics_loss(
        state: torch.Tensor,
        action: torch.Tensor,
        next_state_pred: torch.Tensor,
        delta_t: float = 60.0,
        state_bounds: Optional[Dict] = None,
    ) -> torch.Tensor:
        """
        Calculate physics-informed loss based on thermal dynamics.

        The physics equation (physical units):
        dT_in/dt = (1/C_air) * [Q_ac + Q_load + (T_out - T_in)/R_wall]

        If state and next_state_pred are normalized [0,1], pass state_bounds
        so that T_in, T_out, T_next_pred, P_ac are denormalized before applying
        the equation. Otherwise the residual is meaningless (mixing [0,1] with W, °C).

        Args:
            state: Current state [batch_size, state_dim] (normalized if state_bounds given)
            action: Action tensor (unused in current equation)
            next_state_pred: Predicted next state [batch_size, state_dim] (normalized if state_bounds given)
            delta_t: Time step in seconds (default: 60s)
            state_bounds: Optional {'min': tensor/array, 'max': tensor/array} for denormalization

        Returns:
            loss_physics: Scalar tensor (residual in °C when state_bounds provided)
        """
        if state_bounds is not None:
            min_ = state_bounds["min"]
            max_ = state_bounds["max"]
            if not isinstance(min_, torch.Tensor):
                min_ = torch.tensor(min_, dtype=state.dtype, device=state.device)
            if not isinstance(max_, torch.Tensor):
                max_ = torch.tensor(max_, dtype=state.dtype, device=state.device)
            T_in = state[:, 0] * (max_[0] - min_[0]) + min_[0]
            T_out = state[:, 3] * (max_[3] - min_[3]) + min_[3]
            T_next_pred = next_state_pred[:, 0] * (max_[0] - min_[0]) + min_[0]
            P_ac = next_state_pred[:, 2] * (max_[2] - min_[2]) + min_[2]
        else:
            T_in = state[:, 0]
            T_out = state[:, 3]
            T_next_pred = next_state_pred[:, 0]
            P_ac = next_state_pred[:, 2]

        C_air = 1000.0
        R_wall = 0.5
        COP = 3.0

        Q_ac = -1.0 * P_ac * COP
        Q_loss = (T_out - T_in) / R_wall
        Q_load = 100.0

        dT_dt = (Q_ac + Q_loss + Q_load) / C_air  # °C/s
        T_next_physics = T_in + dT_dt * delta_t   # delta_t in seconds

        loss_physics = torch.mean((T_next_pred - T_next_physics) ** 2)
        return loss_physics

    class PhysicsLoss(nn.Module):
        """
        Wrapper class for physics loss to use as a module.
        """
        def __init__(self, delta_t=60.0):
            super(PhysicsLoss, self).__init__()
            self.delta_t = delta_t
        
        def forward(self, state, action, next_state_pred):
            return thermal_physics_loss(state, action, next_state_pred, self.delta_t)
else:
    def thermal_physics_loss(*args, **kwargs):
        raise NotImplementedError("PyTorch is required for thermal_physics_loss.")

    class PhysicsLoss:
        """Fallback placeholder when PyTorch is not installed."""
        def __init__(self, *args, **kwargs):
            pass
