"""
Digital Twin Calibration Bridge.
Connects engineering office building definitions to the physics-based RC model,
the PINN simulator, and the DQN Reinforcement Learning agent.
"""

from typing import Dict, Any
import numpy as np
from .building_geometry import OfficeZone
from .load_calculation import calculate_office_loads

class CalibratedTwinParameters:
    """Parameters derived from building physics to calibrate the Digital Twin simulator."""
    def __init__(
        self,
        c_air_thermal_capacitance: float,
        r_wall_thermal_resistance: float,
        cop_cooling: float,
        base_internal_load_w: float,
        target_temp_c: float,
        target_rh_pct: float,
        supply_airflow_m3_h: float,
        fan_power_w: float,
        peak_cooling_kw: float,
    ):
        self.c_air = round(float(c_air_thermal_capacitance), 2)
        self.r_wall = round(float(r_wall_thermal_resistance), 4)
        self.cop = round(float(cop_cooling), 2)
        self.base_internal_load_w = round(float(base_internal_load_w), 2)
        self.target_temp_c = round(float(target_temp_c), 1)
        self.target_rh_pct = round(float(target_rh_pct), 1)
        self.supply_airflow_m3_h = round(float(supply_airflow_m3_h), 1)
        self.fan_power_w = round(float(fan_power_w), 1)
        self.peak_cooling_kw = round(float(peak_cooling_kw), 3)

    def to_dict(self) -> Dict[str, Any]:
        tau_hours = round((self.r_wall * self.c_air) / 3600.0, 2)
        ua_val = round(1.0 / max(0.00001, self.r_wall), 2)
        volume_est = round(self.c_air / (1.20 * 1006.0), 1)

        return {
            "c_air": self.c_air,
            "r_wall": self.r_wall,
            "cop": self.cop,
            "q_load": self.base_internal_load_w,
            "time_constant_hours": tau_hours,
            "ua_total_w_k": ua_val,
            "zone_volume_m3": volume_est,
            "thermal_mass_j_k": self.c_air,
            "c_air_capacitance_j_k": self.c_air,
            "r_wall_resistance_k_w": self.r_wall,
            "cop_cooling": self.cop,
            "base_internal_load_w": self.base_internal_load_w,
            "target_temp_c": self.target_temp_c,
            "target_rh_pct": self.target_rh_pct,
            "supply_airflow_m3_h": self.supply_airflow_m3_h,
            "fan_power_w": self.fan_power_w,
            "peak_cooling_kw": self.peak_cooling_kw,
        }

def derive_twin_parameters(
    zone: OfficeZone,
    t_out_design_c: float = 33.0,
    rh_out_design_pct: float = 65.0,
) -> CalibratedTwinParameters:
    """
    Derives equivalent physics parameters (C_air, R_wall, Q_load) from the
    detailed office zone configuration and design weather conditions.
    """
    loads_data = calculate_office_loads(
        zone=zone,
        t_out_c=t_out_design_c,
        rh_out_pct=rh_out_design_pct,
    )

    total_ua = zone.envelope.calculate_total_ua()
    r_wall = 1.0 / max(0.1, total_ua)

    rho_cp_air = 1207.2 # J/(m3*K)
    pure_air_c = rho_cp_air * zone.volume_m3
    furnishing_multiplier = 4.0
    c_air_total = pure_air_c * furnishing_multiplier

    scaled_c_air = max(500.0, min(10000.0, (zone.volume_m3 / 360.0) * 1200.0))

    q_internal_sensible = loads_data["cooling_loads"]["components"]["lighting_w"] + \
                           loads_data["cooling_loads"]["components"]["equipment_plug_load_w"]

    return CalibratedTwinParameters(
        c_air_thermal_capacitance=scaled_c_air,
        r_wall_thermal_resistance=r_wall,
        cop_cooling=zone.cooling_cop,
        base_internal_load_w=q_internal_sensible,
        target_temp_c=zone.target_temp_c,
        target_rh_pct=zone.target_rh_pct,
        supply_airflow_m3_h=loads_data["airflow_and_coil"]["volume_flow_m3_h"],
        fan_power_w=loads_data["airflow_and_coil"]["fan_power_w"],
        peak_cooling_kw=loads_data["cooling_loads"]["summary"]["total_cooling_kw"],
    )
