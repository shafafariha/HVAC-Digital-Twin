"""
Psychrometric Calculation Module for Moist Air Thermodynamics.
Formulated with reference to ASHRAE Handbook - Fundamentals (SI Units).
"""

import math
from typing import Dict, Any

def saturation_vapor_pressure(temp_c: float) -> float:
    """
    Calculate saturation vapor pressure over liquid water (Pa) using Tetens/Magnus formula.
    Valid for temperatures from -20°C to +50°C.
    """
    t = float(temp_c)
    p_ws = 610.78 * math.exp((17.27 * t) / (t + 237.3))
    return p_ws

def vapor_pressure(temp_c: float, rh_percent: float) -> float:
    """
    Calculate partial water vapor pressure (Pa).
    Pv = (RH / 100) * Pws(T)
    """
    phi = max(0.0, min(100.0, float(rh_percent))) / 100.0
    p_ws = saturation_vapor_pressure(temp_c)
    return phi * p_ws

def humidity_ratio(temp_c: float, rh_percent: float, p_atm: float = 101325.0) -> float:
    """
    Calculate humidity ratio omega (kg water vapor / kg dry air).
    omega = 0.62198 * Pv / (P_atm - Pv)
    """
    pv = vapor_pressure(temp_c, rh_percent)
    if pv >= p_atm:
        pv = p_atm * 0.999
    omega = 0.62198 * pv / (p_atm - pv)
    return max(0.0, omega)

def moist_air_enthalpy(temp_c: float, omega: float) -> float:
    """
    Calculate specific moist air enthalpy (kJ/kg dry air).
    h = 1.006 * T + omega * (2501.0 + 1.86 * T)
    """
    t = float(temp_c)
    w = max(0.0, float(omega))
    h = 1.006 * t + w * (2501.0 + 1.86 * t)
    return h

def dew_point_temperature(temp_c: float, rh_percent: float) -> float:
    """
    Calculate dew-point temperature (°C) via Magnus-Tetens approximation.
    """
    phi = max(0.01, min(1.0, float(rh_percent) / 100.0))
    t = float(temp_c)
    a = 17.27
    b = 237.3
    alpha = ((a * t) / (b + t)) + math.log(phi)
    t_dp = (b * alpha) / (a - alpha)
    return round(t_dp, 2)

def moist_air_density(temp_c: float, omega: float, p_atm: float = 101325.0) -> float:
    """
    Calculate moist air density rho (kg/m3) via ideal gas law.
    R_da = 287.058 J/(kg*K)
    """
    t_k = float(temp_c) + 273.15
    w = max(0.0, float(omega))
    r_da = 287.058
    rho_da = p_atm / (r_da * t_k * (1.0 + 1.6078 * w))
    rho_moist = rho_da * (1.0 + w)
    return max(0.9, min(1.4, rho_moist))

class PsychrometricState:
    """
    Container representing the complete thermodynamic state of moist air.
    """
    def __init__(self, temp_c: float, rh_percent: float, p_atm: float = 101325.0):
        self.dry_bulb_temp = round(float(temp_c), 2)
        self.rel_humidity = round(float(max(0.0, min(100.0, rh_percent))), 2)
        self.p_atm = float(p_atm)
        
        self.vapor_pressure = round(vapor_pressure(self.dry_bulb_temp, self.rel_humidity), 2)
        self.humidity_ratio = round(humidity_ratio(self.dry_bulb_temp, self.rel_humidity, self.p_atm), 5)
        self.enthalpy = round(moist_air_enthalpy(self.dry_bulb_temp, self.humidity_ratio), 2)
        self.dew_point = round(dew_point_temperature(self.dry_bulb_temp, self.rel_humidity), 2)
        self.density = round(moist_air_density(self.dry_bulb_temp, self.humidity_ratio, self.p_atm), 3)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dry_bulb_temp": self.dry_bulb_temp,
            "rel_humidity": self.rel_humidity,
            "vapor_pressure_pa": self.vapor_pressure,
            "humidity_ratio_kg_kg": self.humidity_ratio,
            "enthalpy_kj_kg": self.enthalpy,
            "dew_point_c": self.dew_point,
            "density_kg_m3": self.density,
        }
