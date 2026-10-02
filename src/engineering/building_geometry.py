"""
Office Building Geometry and Office Zone Presets Module.
Specifically tailored for multi-zone and open-plan office layouts.
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from .envelope import BuildingEnvelope, WindowFenestration
from .internal_loads import (
    OccupancySchedule,
    LightingLoad,
    OfficeEquipment,
    OfficeEquipmentItem,
    InternalLoadsSummary,
)
from .ventilation import VentilationRequirement, InfiltrationACH

class OfficeZonePreset(str, Enum):
    OPEN_OFFICE = "Open Office"
    PRIVATE_OFFICE = "Private Office"
    CONFERENCE_ROOM = "Conference Room"
    MEETING_ROOM = "Meeting Room"
    SERVER_IT_ROOM = "Server / IT Room"
    RECEPTION_LOBBY = "Reception / Lobby"
    TRAINING_ROOM = "Training Room"
    BREAKROOM_PANTRY = "Break Room / Pantry"
    CORRIDOR = "Corridor"
    RESTROOM = "Restroom"
    STORAGE = "Storage Room"
    CUSTOM_OFFICE = "Custom Office Zone"

def get_default_zone_spec(preset: OfficeZonePreset, area_m2: float = 120.0, height_m: float = 3.0) -> Dict[str, Any]:
    """Returns typical engineering parameters for standard office zone types."""
    area = float(area_m2)
    h = float(height_m)
    vol = round(area * h, 2)

    specs = {
        OfficeZonePreset.OPEN_OFFICE: {
            "name": "Main Open Office Floor",
            "area_m2": area,
            "height_m": h,
            "volume_m3": vol,
            "target_temp_c": 24.0,
            "target_rh_pct": 50.0,
            "max_occupants": max(1, int(round(area / 10.0))), # 10 m2 per person
            "lpd_w_m2": 8.0,
            "ach": 0.25,
            "oa_person_l_s": 2.5,
            "oa_area_l_s_m2": 0.3,
            "equipment_items": [
                {"name": "Computer Workstations", "quantity": max(1, int(round(area / 10.0))), "power_w": 120.0, "f_use": 0.75},
                {"name": "Dual Monitors", "quantity": max(1, int(round(area / 10.0))), "power_w": 40.0, "f_use": 0.80},
                {"name": "Workgroup Printer", "quantity": 1, "power_w": 300.0, "f_use": 0.20},
            ],
            "hvac_system_type": "VRF System",
            "cooling_cop": 3.4,
        },
        OfficeZonePreset.PRIVATE_OFFICE: {
            "name": "Executive Private Office",
            "area_m2": min(area, 25.0),
            "height_m": h,
            "volume_m3": round(min(area, 25.0) * h, 2),
            "target_temp_c": 23.5,
            "target_rh_pct": 50.0,
            "max_occupants": 2,
            "lpd_w_m2": 7.5,
            "ach": 0.20,
            "oa_person_l_s": 2.5,
            "oa_area_l_s_m2": 0.3,
            "equipment_items": [
                {"name": "Executive PC / Laptop", "quantity": 1, "power_w": 110.0, "f_use": 0.70},
                {"name": "Large Display Monitor", "quantity": 2, "power_w": 45.0, "f_use": 0.70},
            ],
            "hvac_system_type": "Split AC / VRF",
            "cooling_cop": 3.2,
        },
        OfficeZonePreset.CONFERENCE_ROOM: {
            "name": "Executive Conference Room",
            "area_m2": 45.0,
            "height_m": h,
            "volume_m3": round(45.0 * h, 2),
            "target_temp_c": 23.0,
            "target_rh_pct": 50.0,
            "max_occupants": 16, # High peak density
            "lpd_w_m2": 9.0,
            "ach": 0.35,
            "oa_person_l_s": 3.0,
            "oa_area_l_s_m2": 0.3,
            "equipment_items": [
                {"name": "Teleconference AV System", "quantity": 1, "power_w": 350.0, "f_use": 0.85},
                {"name": "Laptops (Attendees)", "quantity": 12, "power_w": 50.0, "f_use": 0.60},
            ],
            "hvac_system_type": "AHU / VAV",
            "cooling_cop": 3.5,
        },
        OfficeZonePreset.SERVER_IT_ROOM: {
            "name": "Server & Data Equipment Room",
            "area_m2": 30.0,
            "height_m": h,
            "volume_m3": round(30.0 * h, 2),
            "target_temp_c": 21.0,
            "target_rh_pct": 45.0,
            "max_occupants": 1,
            "lpd_w_m2": 5.0,
            "ach": 0.10,
            "oa_person_l_s": 2.5,
            "oa_area_l_s_m2": 0.2,
            "equipment_items": [
                {"name": "Server Racks / Blades", "quantity": 3, "power_w": 2500.0, "f_use": 0.95},
                {"name": "UPS & Core Switches", "quantity": 2, "power_w": 400.0, "f_use": 0.90},
            ],
            "hvac_system_type": "Precision CRAC / Split",
            "cooling_cop": 3.0,
        },
    }

    if preset in specs:
        return specs[preset]

    return {
        "name": f"{preset.value}",
        "area_m2": area,
        "height_m": h,
        "volume_m3": vol,
        "target_temp_c": 24.0,
        "target_rh_pct": 50.0,
        "max_occupants": max(1, int(round(area / 12.0))),
        "lpd_w_m2": 8.0,
        "ach": 0.30,
        "oa_person_l_s": 2.5,
        "oa_area_l_s_m2": 0.3,
        "equipment_items": [
            {"name": "Standard Office Equipment", "quantity": max(1, int(round(area / 15.0))), "power_w": 100.0, "f_use": 0.70}
        ],
        "hvac_system_type": "VRF System",
        "cooling_cop": 3.2,
    }

class OfficeZone:
    """Configurable Office Building Zone."""
    def __init__(
        self,
        name: str = "Open Office Zone 1",
        preset_type: OfficeZonePreset = OfficeZonePreset.OPEN_OFFICE,
        area_m2: float = 120.0,
        height_m: float = 3.0,
        target_temp_c: float = 24.0,
        target_rh_pct: float = 50.0,
        envelope: Optional[BuildingEnvelope] = None,
        internal_loads: Optional[InternalLoadsSummary] = None,
        ventilation: Optional[VentilationRequirement] = None,
        infiltration: Optional[InfiltrationACH] = None,
        hvac_system_type: str = "VRF System",
        cooling_cop: float = 3.4,
    ):
        self.name = name
        self.preset_type = preset_type
        self.area_m2 = max(5.0, float(area_m2))
        self.height_m = max(2.0, float(height_m))
        self.volume_m3 = round(self.area_m2 * self.height_m, 2)
        
        self.target_temp_c = max(18.0, min(30.0, float(target_temp_c)))
        self.target_rh_pct = max(30.0, min(70.0, float(target_rh_pct)))
        
        gross_wall = round(4.0 * (self.area_m2 ** 0.5) * self.height_m, 2)
        self.envelope = envelope or BuildingEnvelope(
            gross_wall_area_m2=gross_wall,
            roof_area_m2=self.area_m2 if preset_type != OfficeZonePreset.SERVER_IT_ROOM else 0.0,
            floor_area_m2=self.area_m2,
        )
        
        self.internal_loads = internal_loads or InternalLoadsSummary()
        self.ventilation = ventilation or VentilationRequirement()
        self.infiltration = infiltration or InfiltrationACH()
        self.hvac_system_type = hvac_system_type
        self.cooling_cop = max(1.5, float(cooling_cop))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "preset_type": self.preset_type.value,
            "area_m2": self.area_m2,
            "height_m": self.height_m,
            "volume_m3": self.volume_m3,
            "target_temp_c": self.target_temp_c,
            "target_rh_pct": self.target_rh_pct,
            "hvac_system_type": self.hvac_system_type,
            "cooling_cop": self.cooling_cop,
            "envelope": self.envelope.to_dict(),
            "internal_loads": self.internal_loads.to_dict(),
            "ventilation": self.ventilation.to_dict(),
            "infiltration": self.infiltration.to_dict(),
        }

class OfficeBuildingProject:
    """Consolidated Office Building Project definition."""
    def __init__(
        self,
        project_name: str = "Corporate Headquarters Office Pilot",
        location: str = "Jakarta / Tropical Urban",
        number_of_floors: int = 1,
        building_length_m: float = 12.0,
        building_width_m: float = 10.0,
        floor_height_m: float = 3.0,
        simulation_timestep_s: float = 60.0,
        zones: Optional[List[OfficeZone]] = None,
    ):
        self.project_name = project_name
        self.location = location
        self.number_of_floors = max(1, int(number_of_floors))
        self.building_length_m = max(2.0, float(building_length_m))
        self.building_width_m = max(2.0, float(building_width_m))
        self.floor_height_m = max(2.0, float(floor_height_m))
        self.simulation_timestep_s = max(1.0, float(simulation_timestep_s))

        self.footprint_area_m2 = round(self.building_length_m * self.building_width_m, 2)
        self.total_floor_area_m2 = round(self.footprint_area_m2 * self.number_of_floors, 2)
        self.total_volume_m3 = round(self.total_floor_area_m2 * self.floor_height_m, 2)

        self.zones: List[OfficeZone] = zones or [
            OfficeZone(
                name="Primary Open Office Zone",
                preset_type=OfficeZonePreset.OPEN_OFFICE,
                area_m2=self.total_floor_area_m2,
                height_m=self.floor_height_m,
            )
        ]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_name": self.project_name,
            "location": self.location,
            "number_of_floors": self.number_of_floors,
            "building_length_m": self.building_length_m,
            "building_width_m": self.building_width_m,
            "floor_height_m": self.floor_height_m,
            "footprint_area_m2": self.footprint_area_m2,
            "total_floor_area_m2": self.total_floor_area_m2,
            "total_volume_m3": self.total_volume_m3,
            "simulation_timestep_s": self.simulation_timestep_s,
            "zones": [z.to_dict() for z in self.zones],
        }
