"""
Ventilation and Infiltration Airflow Module.
Formulated with reference to ASHRAE Standard 62.1 (Ventilation for Acceptable Indoor Air Quality)
and air changes per hour (ACH) infiltration methodology.
"""

from typing import Dict, Any
from .psychrometrics import (
    humidity_ratio,
    moist_air_enthalpy,
    moist_air_density,
)

CP_AIR = 1.006  # Specific heat capacity of dry air kJ/(kg*K) = 1006 J/(kg*K)
H_FG_WATER = 2501.0  # Latent heat of vaporization of water at 0°C (kJ/kg) = 2.501e6 J/kg

class VentilationRequirement:
    """
    ASHRAE 62.1 Ventilation Rate Procedure for Office Spaces.
    V_dot_OA = R_p * N + R_a * A_z
    """
    def __init__(
        self,
        rate_per_person_l_s: float = 2.5,  # L/s per person for office space (ASHRAE 62.1 Table 6.1)
        rate_per_area_l_s_m2: float = 0.3, # L/s per m2 of floor area
    ):
        self.r_p_l_s = max(0.0, float(rate_per_person_l_s))
        self.r_a_l_s_m2 = max(0.0, float(rate_per_area_l_s_m2))

    def calculate_oa_flow(self, occupant_count: float, zone_area_m2: float) -> Dict[str, float]:
        """
        Calculate required outdoor air volume flow rate.
        Returns flow rates in L/s, m3/s, and m3/h.
        """
        n = max(0.0, float(occupant_count))
        area = max(1.0, float(zone_area_m2))

        flow_people_l_s = self.r_p_l_s * n
        flow_area_l_s = self.r_a_l_s_m2 * area
        total_l_s = flow_people_l_s + flow_area_l_s

        v_dot_m3_s = total_l_s / 1000.0
        v_dot_m3_h = v_dot_m3_s * 3600.0

        return {
            "flow_people_l_s": round(flow_people_l_s, 2),
            "flow_area_l_s": round(flow_area_l_s, 2),
            "total_oa_l_s": round(total_l_s, 2),
            "total_oa_m3_s": round(v_dot_m3_s, 5),
            "total_oa_m3_h": round(v_dot_m3_h, 2),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rate_per_person_l_s": self.r_p_l_s,
            "rate_per_area_l_s_m2": self.r_a_l_s_m2,
        }

class InfiltrationACH:
    """
    Building envelope air leakage modeled via Air Changes per Hour (ACH).
    V_dot_inf = ACH * V_zone / 3600
    """
    def __init__(self, ach: float = 0.30):
        self.ach = max(0.0, min(3.0, float(ach)))

    def calculate_infiltration_flow(self, zone_volume_m3: float) -> Dict[str, float]:
        v_zone = max(1.0, float(zone_volume_m3))
        v_dot_m3_h = self.ach * v_zone
        v_dot_m3_s = v_dot_m3_h / 3600.0
        return {
            "ach": self.ach,
            "v_dot_inf_m3_s": round(v_dot_m3_s, 5),
            "v_dot_inf_m3_h": round(v_dot_m3_h, 2),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {"ach": self.ach}

def calculate_air_exchange_loads(
    v_dot_m3_s: float,
    t_in_c: float,
    rh_in_pct: float,
    t_out_c: float,
    rh_out_pct: float,
    p_atm: float = 101325.0,
) -> Dict[str, float]:
    """
    Calculate sensible and latent heat loads from outdoor air exchange
    (either mechanical outdoor air ventilation or envelope infiltration).
    """
    if v_dot_m3_s <= 0.0:
        return {
            "mass_flow_kg_s": 0.0,
            "q_sensible_w": 0.0,
            "q_latent_w": 0.0,
            "q_total_w": 0.0,
        }

    w_in = humidity_ratio(t_in_c, rh_in_pct, p_atm)
    w_out = humidity_ratio(t_out_c, rh_out_pct, p_atm)

    h_in = moist_air_enthalpy(t_in_c, w_in)   # kJ/kg
    h_out = moist_air_enthalpy(t_out_c, w_out) # kJ/kg

    rho = moist_air_density(t_out_c, w_out, p_atm) # kg/m3
    m_dot = v_dot_m3_s * rho # kg/s

    q_s_w = m_dot * (CP_AIR * 1000.0) * (t_out_c - t_in_c)

    q_l_w = m_dot * (H_FG_WATER * 1000.0) * (w_out - w_in)

    q_tot_w = m_dot * (h_out - h_in) * 1000.0

    return {
        "mass_flow_kg_s": round(m_dot, 4),
        "q_sensible_w": round(q_s_w, 2),
        "q_latent_w": round(q_l_w, 2),
        "q_total_w": round(q_tot_w, 2),
    }
