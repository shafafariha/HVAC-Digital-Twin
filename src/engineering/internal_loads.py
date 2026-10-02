"""
Internal Heat Gains Module for Office Buildings.
Calculates time-dependent occupancy loads (sensible & latent),
lighting power density (LPD), and office plug-load equipment inventories.
"""

from typing import List, Dict, Any, Optional

class OccupancySchedule:
    """
    Time-dependent office occupancy model.
    Accounts for sensible and latent metabolic heat rates per ASHRAE Fundamentals.
    """
    def __init__(
        self,
        max_occupants: int = 12,
        activity_type: str = "Seated Office Work",
        sensible_w_person: float = 75.0,
        latent_w_person: float = 55.0,
        schedule_type: str = "standard_office", # "standard_office", "continuous", "empty"
    ):
        self.max_occupants = max(0, int(max_occupants))
        self.activity_type = activity_type
        self.sensible_w_person = max(30.0, float(sensible_w_person))
        self.latent_w_person = max(20.0, float(latent_w_person))
        self.schedule_type = schedule_type

    def get_occupant_count(self, hour_of_day: float) -> float:
        """Calculate dynamic occupant count N(t) based on schedule."""
        h = hour_of_day % 24.0
        if self.schedule_type == "continuous":
            return float(self.max_occupants)
        elif self.schedule_type == "empty":
            return 0.0
        
        if 8.0 <= h < 9.0:
            return round(self.max_occupants * 0.5, 1)
        elif 9.0 <= h < 12.0:
            return float(self.max_occupants)
        elif 12.0 <= h < 13.0:
            return round(self.max_occupants * 0.4, 1)
        elif 13.0 <= h < 17.0:
            return float(self.max_occupants)
        elif 17.0 <= h < 18.0:
            return round(self.max_occupants * 0.4, 1)
        elif 18.0 <= h < 20.0:
            return round(self.max_occupants * 0.1, 1)
        else:
            return 0.0

    def calculate_people_loads(self, occupant_count: Optional[float] = None, hour_of_day: float = 14.0) -> Dict[str, float]:
        """
        Q_people,sensible = N * q_s
        Q_people,latent = N * q_l
        """
        n = float(occupant_count) if occupant_count is not None else self.get_occupant_count(hour_of_day)
        q_sensible = round(n * self.sensible_w_person, 2)
        q_latent = round(n * self.latent_w_person, 2)
        q_total = round(q_sensible + q_latent, 2)
        return {
            "occupant_count": n,
            "q_people_sensible_w": q_sensible,
            "q_people_latent_w": q_latent,
            "q_people_total_w": q_total,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "max_occupants": self.max_occupants,
            "activity_type": self.activity_type,
            "sensible_w_person": self.sensible_w_person,
            "latent_w_person": self.latent_w_person,
            "schedule_type": self.schedule_type,
        }

class LightingLoad:
    """Lighting load calculated via Lighting Power Density (LPD, W/m2) and schedule."""
    def __init__(
        self,
        lpd_w_m2: float = 8.5,  # ASHRAE 90.1 standard office LED baseline
        f_use: float = 0.90,     # Space utilization fraction during occupancy
    ):
        self.lpd_w_m2 = max(0.0, float(lpd_w_m2))
        self.f_use = max(0.0, min(1.0, float(f_use)))

    def calculate_lighting_load(self, zone_area_m2: float, is_occupied: bool = True) -> float:
        """Q_lighting = Area * LPD * F_use (Watts, sensible heat)."""
        factor = self.f_use if is_occupied else 0.05
        return round(float(zone_area_m2) * self.lpd_w_m2 * factor, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lpd_w_m2": self.lpd_w_m2,
            "f_use": self.f_use,
        }

class OfficeEquipmentItem:
    """Single category of office plug-load appliance."""
    def __init__(self, name: str, quantity: int, rated_power_w: float, utilization_factor: float = 0.75):
        self.name = str(name)
        self.quantity = max(0, int(quantity))
        self.rated_power_w = max(0.0, float(rated_power_w))
        self.utilization_factor = max(0.0, min(1.0, float(utilization_factor)))

    @property
    def heat_gain_w(self) -> float:
        return round(self.quantity * self.rated_power_w * self.utilization_factor, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "quantity": self.quantity,
            "rated_power_w": self.rated_power_w,
            "utilization_factor": self.utilization_factor,
            "heat_gain_w": self.heat_gain_w,
        }

class OfficeEquipment:
    """Office equipment plug-load inventory."""
    def __init__(self, items: Optional[List[OfficeEquipmentItem]] = None):
        self.items: List[OfficeEquipmentItem] = items or [
            OfficeEquipmentItem("Desktop Workstations / Laptops", quantity=12, rated_power_w=120.0, utilization_factor=0.70),
            OfficeEquipmentItem("LED Monitors", quantity=16, rated_power_w=35.0, utilization_factor=0.80),
            OfficeEquipmentItem("Network Laser Multifunction Printer", quantity=1, rated_power_w=350.0, utilization_factor=0.25),
            OfficeEquipmentItem("Local Network Switch / Router", quantity=1, rated_power_w=80.0, utilization_factor=0.90),
        ]

    def calculate_equipment_load(self) -> float:
        """Q_equipment = sum(N * P * f_use) (Watts, sensible heat)."""
        return round(sum(item.heat_gain_w for item in self.items), 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": [item.to_dict() for item in self.items],
            "total_equipment_w": self.calculate_equipment_load(),
        }

class InternalLoadsSummary:
    """Consolidator for total sensible and latent internal heat loads."""
    def __init__(
        self,
        occupancy: Optional[OccupancySchedule] = None,
        lighting: Optional[LightingLoad] = None,
        equipment: Optional[OfficeEquipment] = None,
    ):
        self.occupancy = occupancy or OccupancySchedule()
        self.lighting = lighting or LightingLoad()
        self.equipment = equipment or OfficeEquipment()

    def calculate_internal_loads(
        self,
        zone_area_m2: float,
        occupant_count: Optional[float] = None,
        hour_of_day: float = 14.0,
    ) -> Dict[str, float]:
        people = self.occupancy.calculate_people_loads(occupant_count, hour_of_day)
        is_occ = people["occupant_count"] > 0.1
        q_light = self.lighting.calculate_lighting_load(zone_area_m2, is_occupied=is_occ)
        q_equip = self.equipment.calculate_equipment_load()

        q_sensible = round(people["q_people_sensible_w"] + q_light + q_equip, 2)
        q_latent = round(people["q_people_latent_w"], 2)
        q_total = round(q_sensible + q_latent, 2)

        return {
            "occupant_count": people["occupant_count"],
            "q_people_sensible_w": people["q_people_sensible_w"],
            "q_people_latent_w": people["q_people_latent_w"],
            "q_lighting_w": q_light,
            "q_equipment_w": q_equip,
            "q_internal_sensible_w": q_sensible,
            "q_internal_latent_w": q_latent,
            "q_internal_total_w": q_total,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "occupancy": self.occupancy.to_dict(),
            "lighting": self.lighting.to_dict(),
            "equipment": self.equipment.to_dict(),
        }
