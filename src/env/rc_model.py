"""
Physics-based RC (Resistance-Capacitance) thermal model for HVAC dynamics.

Deterministic forward model using heat balance equations. No neural network.
State and action in physical units (°C, %, W, etc.).
"""
import numpy as np
from typing import Union

class RCModel:
    """
    Resistance-Capacitance thermal model for HVAC state transition.

    Uses the same heat balance as the PINN physics loss and data generator:
    dT_in/dt = (1/C_air) * [Q_ac(A) + Q_load + (T_out - T_in)/R_wall]

    State: [T_in, H_in, P_last, T_out, H_out, Occupancy] (physical units)
    Action: [Source, Mode, Fan, Temp] (Source 0/1, Mode 1-3, Fan 0-6, Temp 18-30)
    """

    def __init__(
        self,
        C_air: float = 1000.0,
        R_wall: float = 0.5,
        COP: float = 3.0,
        delta_t: float = 60.0,
    ):
        """
        Initialize RC model parameters.

        Args:
            C_air: Thermal capacity of room air (J/°C)
            R_wall: Thermal resistance of walls (°C/W)
            COP: Coefficient of performance for AC
            delta_t: Time step in seconds
        """
        self.C_air = C_air
        self.R_wall = R_wall
        self.COP = COP
        self.delta_t = delta_t

    def predict(
        self,
        state: np.ndarray,
        action: np.ndarray,
    ) -> np.ndarray:
        """
        Compute next state from current state and action (physical units).

        Args:
            state: [T_in, H_in, P_last, T_out, H_out, Occupancy]
            action: [Source, Mode, Fan, Temp]

        Returns:
            next_state: [T_in_next, H_in_next, P_next, T_out_next, H_out_next, Occupancy_next]
        """
        state = np.asarray(state, dtype=np.float64)
        action = np.asarray(action, dtype=np.float64)

        if state.ndim == 1:
            return self._step_single(state, action)
        return np.array([self._step_single(s, a) for s, a in zip(state, action)])

    def _step_single(self, state: np.ndarray, action: np.ndarray) -> np.ndarray:
        """Single transition (physical units)."""
        t_in, h_in, p_last, t_out, h_out, occupancy = state
        source, mode, fan, temp = action

        source = int(round(source))
        mode = int(round(mode))
        fan = int(round(np.clip(fan, 0, 6)))
        temp = float(np.clip(temp, 18, 30))

        Q_loss = (t_out - t_in) / self.R_wall

        Q_load = 50.0 + occupancy * 100.0

        if source == 0:
            P_ac = 0.0
            Q_ac = 0.0
        else:
            temp_diff = abs(t_in - temp)
            base_power = 1000.0

            if mode == 1:
                mode_factor = 1.0
            elif mode == 2:
                mode_factor = 1.2
            else:
                mode_factor = 1.1

            fan_factor = 1.0 + (fan / 6.0) * 0.3
            temp_factor = 1.0 + (temp_diff / 10.0) * 0.5

            P_ac = base_power * mode_factor * fan_factor * temp_factor
            P_ac = np.clip(P_ac, 0, 5000)

            if t_in > temp:
                Q_ac = -P_ac * self.COP
            elif t_in < temp:
                Q_ac = P_ac * self.COP * 0.8
            else:
                Q_ac = 0.0

        dT_dt = (Q_ac + Q_loss + Q_load) / self.C_air
        T_in_next = t_in + dT_dt * (self.delta_t / 3600.0)

        if source == 1 and mode == 1:
            H_in_next = h_in - 0.5 * (t_in - T_in_next) * 2.0
        else:
            H_in_next = h_in + 0.1 * (h_out - h_in) * 0.1
        H_in_next = np.clip(H_in_next, 0, 100)

        T_out_next = np.clip(t_out, 15, 40)
        H_out_next = np.clip(h_out, 30, 90)

        Occupancy_next = np.clip(occupancy, 0, 20)

        return np.array([
            T_in_next,
            H_in_next,
            P_ac,
            T_out_next,
            H_out_next,
            Occupancy_next,
        ], dtype=np.float64)
