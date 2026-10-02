"""
Engineering Layer for Office Building HVAC Digital Twin.
Provides standards-referenced engineering calculations for:
- Building geometry & office zone presets
- Multi-layer envelope thermal resistance and fenestration
- Internal sensible & latent loads (occupancy, lighting, office equipment)
- Ventilation (ASHRAE 62.1) and infiltration (ACH)
- Psychrometric properties of moist air
- Transparent cooling & heating load estimation
- Supply airflow, coil SHR, and fan power
- Thermal comfort (Fanger PMV/PPD under ASHRAE 55 / ISO 7730 principles)
- Digital Twin calibration bridge (C_air, R_wall, Q_net)
"""

from .psychrometrics import (
    saturation_vapor_pressure,
    vapor_pressure,
    humidity_ratio,
    moist_air_enthalpy,
    dew_point_temperature,
    PsychrometricState,
)
from .envelope import (
    MaterialLayer,
    WallAssembly,
    WindowFenestration,
    BuildingEnvelope,
    MATERIAL_LIBRARY,
)
from .internal_loads import (
    OccupancySchedule,
    LightingLoad,
    OfficeEquipment,
    OfficeEquipmentItem,
    InternalLoadsSummary,
)
from .ventilation import (
    VentilationRequirement,
    InfiltrationACH,
)
from .building_geometry import (
    OfficeZonePreset,
    OfficeZone,
    OfficeBuildingProject,
)
from .load_calculation import (
    CoolingLoadBreakdown,
    HeatingLoadBreakdown,
    HVACAirflowAndCoil,
    calculate_office_loads,
)
from .thermal_comfort import (
    calculate_fanger_pmv_ppd,
    ThermalComfortResult,
)
from .twin_bridge import (
    CalibratedTwinParameters,
    derive_twin_parameters,
)

__all__ = [
    "saturation_vapor_pressure",
    "vapor_pressure",
    "humidity_ratio",
    "moist_air_enthalpy",
    "dew_point_temperature",
    "PsychrometricState",
    "MaterialLayer",
    "WallAssembly",
    "WindowFenestration",
    "BuildingEnvelope",
    "MATERIAL_LIBRARY",
    "OccupancySchedule",
    "LightingLoad",
    "OfficeEquipment",
    "OfficeEquipmentItem",
    "InternalLoadsSummary",
    "VentilationRequirement",
    "InfiltrationACH",
    "OfficeZonePreset",
    "OfficeZone",
    "OfficeBuildingProject",
    "CoolingLoadBreakdown",
    "HeatingLoadBreakdown",
    "HVACAirflowAndCoil",
    "calculate_office_loads",
    "calculate_fanger_pmv_ppd",
    "ThermalComfortResult",
    "CalibratedTwinParameters",
    "derive_twin_parameters",
]
