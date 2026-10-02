"""
Thermal Comfort Engineering Module (Fanger PMV / PPD).
Calculates Predicted Mean Vote (PMV) and Predicted Percentage of Dissatisfied (PPD)
with reference to ISO 7730 and ASHRAE Standard 55 principles.
"""

import math
from typing import Dict, Any

class ThermalComfortResult:
    """Container for thermal comfort evaluation metrics."""
    def __init__(
        self,
        pmv: float,
        ppd: float,
        comfort_category: str,
        operative_temp_c: float,
        air_temp_c: float,
        mrt_c: float,
        rh_pct: float,
        clothing_clo: float,
        met_rate: float,
    ):
        self.pmv = round(float(pmv), 2)
        self.ppd = round(float(ppd), 1)
        self.comfort_category = comfort_category
        self.operative_temp_c = round(float(operative_temp_c), 1)
        self.air_temp_c = round(float(air_temp_c), 1)
        self.mrt_c = round(float(mrt_c), 1)
        self.rh_pct = round(float(rh_pct), 1)
        self.clothing_clo = float(clothing_clo)
        self.met_rate = float(met_rate)

    def to_dict(self) -> Dict[str, Any]:
        if self.pmv > 2.0:
            sensation = "Hot"
        elif self.pmv > 1.0:
            sensation = "Warm"
        elif self.pmv > 0.5:
            sensation = "Slightly Warm"
        elif self.pmv >= -0.5:
            sensation = "Neutral (Comfortable)"
        elif self.pmv >= -1.0:
            sensation = "Slightly Cool"
        elif self.pmv >= -2.0:
            sensation = "Cool"
        else:
            sensation = "Cold"

        return {
            "pmv": self.pmv,
            "ppd_pct": self.ppd,
            "ppd_percent": self.ppd,
            "sensation": sensation,
            "comfort_category": self.comfort_category,
            "compliance_iso7730": self.comfort_category,
            "is_comfortable": abs(self.pmv) <= 0.7,
            "operative_temp_c": self.operative_temp_c,
            "air_temp_c": self.air_temp_c,
            "mean_radiant_temp_c": self.mrt_c,
            "relative_humidity_pct": self.rh_pct,
            "clothing_insulation_clo": self.clothing_clo,
            "metabolic_rate_met": self.met_rate,
            "standards_note": "Engineering thermal comfort estimate formulated under ISO 7730 / ASHRAE 55 principles; for design support and Digital Twin evaluation.",
        }

def calculate_fanger_pmv_ppd(
    ta: float,          # Air temperature (°C)
    tr: float = None,   # Mean radiant temperature (°C, defaults to ta)
    vel: float = 0.15,  # Relative air velocity (m/s)
    rh: float = 50.0,   # Relative humidity (%)
    met: float = 1.15,  # Metabolic rate (met) - 1.15 for seated office work
    clo: float = 0.65,  # Clothing insulation (clo) - 0.5 summer office, 1.0 winter
    wme: float = 0.0,   # External work (met, typically 0)
) -> ThermalComfortResult:
    """
    Standard Fanger PMV / PPD iterative solver.
    """
    if tr is None:
        tr = ta

    top = 0.5 * (ta + tr)

    m = met * 58.15  # W/m2
    w = wme * 58.15  # W/m2
    mw = m - w       # Internal heat production

    icl = 0.155 * clo  # m2*K/W
    if icl <= 0.078:
        fcl = 1.0 + 1.29 * icl
    else:
        fcl = 1.05 + 0.645 * icl

    fnps = math.exp(16.6536 - 4030.183 / (ta + 235.0))
    pa = rh * 10.0 * fnps

    tra = tr + 273.0
    taa = ta + 273.0
    tcla = taa + (35.5 - ta) / (3.5 * (6.45 * icl + 0.1))

    p1 = icl * fcl
    p2 = p1 * 3.96
    p3 = p1 * 100.0
    p4 = p1 * taa
    p5 = 308.7 - 0.028 * mw + p2 * ((tra / 100.0) ** 4)

    xn = tcla / 100.0
    xf = tcla / 50.0
    eps = 0.00015

    for _ in range(150):
        xf = (xf + xn) / 2.0
        hcf = 12.1 * math.sqrt(max(0.01, vel))
        hc = 2.38 * (abs(100.0 * xf - taa) ** 0.25)
        if hcf > hc:
            hc = hcf
        xn = (p5 + p4 * hc - p2 * (xf ** 4)) / (100.0 + p3 * hc)
        if abs(xn - xf) <= eps:
            break

    tcl = 100.0 * xn - 273.0

    hl1 = 3.05 * 0.001 * (5733.0 - 6.99 * mw - pa)
    hl2 = 0.42 * (mw - 58.15) if mw > 58.15 else 0.0
    hl3 = 1.7 * 0.00001 * m * (5867.0 - pa)
    hl4 = 0.0014 * m * (34.0 - ta)
    hl5 = 3.96 * fcl * ((xn ** 4) - ((tra / 100.0) ** 4))
    hl6 = fcl * hc * (tcl - ta)

    ts = 0.303 * math.exp(-0.036 * m) + 0.028
    pmv_val = ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6)
    pmv = max(-3.0, min(3.0, pmv_val))

    ppd = 100.0 - 95.0 * math.exp(-0.03353 * (pmv ** 4) - 0.2179 * (pmv ** 2))

    if abs(pmv) <= 0.2:
        category = "Category A (High Comfort, PPD < 6%)"
    elif abs(pmv) <= 0.5:
        category = "Category B (Standard Office, PPD < 10%)"
    elif abs(pmv) <= 0.7:
        category = "Category C (Moderate Comfort, PPD < 15%)"
    else:
        category = "Category IV / Out of Band (PPD > 15%)"

    return ThermalComfortResult(
        pmv=pmv,
        ppd=ppd,
        comfort_category=category,
        operative_temp_c=top,
        air_temp_c=ta,
        mrt_c=tr,
        rh_pct=rh,
        clothing_clo=clo,
        met_rate=met,
    )
