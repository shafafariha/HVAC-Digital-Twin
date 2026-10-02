"""
Engineering Load Calculation, Psychrometric State Mapping, Airflow, and Coil Module.
Performs transparent cooling and heating load estimations, required supply airflow,
coil Sensible Heat Ratio (SHR), and fan power calculations.
"""

from typing import Dict, Any, Optional
from .psychrometrics import (
    PsychrometricState,
    humidity_ratio,
    moist_air_enthalpy,
    moist_air_density,
)
from .building_geometry import OfficeZone
from .ventilation import calculate_air_exchange_loads, CP_AIR

class CoolingLoadBreakdown:
    """Detailed engineering cooling load breakdown (Watts)."""
    def __init__(
        self,
        q_envelope_transmission: float,
        q_solar_gain: float,
        q_people_sensible: float,
        q_people_latent: float,
        q_lighting: float,
        q_equipment: float,
        q_ventilation_sensible: float,
        q_ventilation_latent: float,
        q_infiltration_sensible: float,
        q_infiltration_latent: float,
    ):
        self.q_envelope_transmission = round(float(q_envelope_transmission), 2)
        self.q_solar_gain = round(float(q_solar_gain), 2)
        self.q_people_sensible = round(float(q_people_sensible), 2)
        self.q_people_latent = round(float(q_people_latent), 2)
        self.q_lighting = round(float(q_lighting), 2)
        self.q_equipment = round(float(q_equipment), 2)
        self.q_ventilation_sensible = round(float(q_ventilation_sensible), 2)
        self.q_ventilation_latent = round(float(q_ventilation_latent), 2)
        self.q_infiltration_sensible = round(float(q_infiltration_sensible), 2)
        self.q_infiltration_latent = round(float(q_infiltration_latent), 2)

        self.total_sensible_w = round(
            max(0.0, self.q_envelope_transmission)
            + self.q_solar_gain
            + self.q_people_sensible
            + self.q_lighting
            + self.q_equipment
            + max(0.0, self.q_ventilation_sensible)
            + max(0.0, self.q_infiltration_sensible),
            2
        )

        self.total_latent_w = round(
            self.q_people_latent
            + max(0.0, self.q_ventilation_latent)
            + max(0.0, self.q_infiltration_latent),
            2
        )

        self.total_cooling_w = round(self.total_sensible_w + self.total_latent_w, 2)
        self.total_cooling_kw = round(self.total_cooling_w / 1000.0, 3)
        self.total_cooling_tons = round(self.total_cooling_kw / 3.51685, 2) # 1 TR = 3.51685 kW

        self.shr = round(self.total_sensible_w / self.total_cooling_w, 3) if self.total_cooling_w > 0 else 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "components": {
                "envelope_conduction_w": self.q_envelope_transmission,
                "solar_radiation_gain_w": self.q_solar_gain,
                "people_sensible_w": self.q_people_sensible,
                "people_latent_w": self.q_people_latent,
                "lighting_w": self.q_lighting,
                "equipment_plug_load_w": self.q_equipment,
                "ventilation_sensible_w": self.q_ventilation_sensible,
                "ventilation_latent_w": self.q_ventilation_latent,
                "infiltration_sensible_w": self.q_infiltration_sensible,
                "infiltration_latent_w": self.q_infiltration_latent,
            },
            "summary": {
                "total_sensible_w": self.total_sensible_w,
                "total_latent_w": self.total_latent_w,
                "total_cooling_w": self.total_cooling_w,
                "total_cooling_kw": self.total_cooling_kw,
                "total_cooling_tons": self.total_cooling_tons,
                "sensible_heat_ratio_shr": self.shr,
            },
            "methodology_note": "Simplified steady-state engineering load estimation for engineering support and Digital Twin initialization; not a certified peak calculation."
        }

class HeatingLoadBreakdown:
    """Simplified heating load estimation (Watts)."""
    def __init__(
        self,
        q_envelope_loss: float,
        q_ventilation_loss: float,
        q_infiltration_loss: float,
        q_internal_credits: float = 0.0,
    ):
        self.q_envelope_loss = round(max(0.0, float(q_envelope_loss)), 2)
        self.q_ventilation_loss = round(max(0.0, float(q_ventilation_loss)), 2)
        self.q_infiltration_loss = round(max(0.0, float(q_infiltration_loss)), 2)
        self.q_internal_credits = round(float(q_internal_credits), 2)

        gross_loss = self.q_envelope_loss + self.q_ventilation_loss + self.q_infiltration_loss
        self.net_heating_w = round(max(0.0, gross_loss - self.q_internal_credits), 2)
        self.net_heating_kw = round(self.net_heating_w / 1000.0, 3)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "envelope_transmission_loss_w": self.q_envelope_loss,
            "ventilation_heating_loss_w": self.q_ventilation_loss,
            "infiltration_heating_loss_w": self.q_infiltration_loss,
            "internal_heat_credits_w": self.q_internal_credits,
            "net_heating_required_w": self.net_heating_w,
            "net_heating_required_kw": self.net_heating_kw,
        }

class HVACAirflowAndCoil:
    """Required supply airflow, coil capacities, and fan power."""
    def __init__(
        self,
        sensible_load_w: float,
        room_temp_c: float,
        supply_temp_c: float = 14.0, # Typical cold air supply temperature
        air_density_kg_m3: float = 1.20,
        fan_delta_p_pa: float = 250.0, # External/internal static pressure in Pascals
        fan_efficiency: float = 0.65,
        motor_efficiency: float = 0.85,
    ):
        self.sensible_load_w = max(0.0, float(sensible_load_w))
        self.room_temp_c = float(room_temp_c)
        self.supply_temp_c = min(self.room_temp_c - 2.0, float(supply_temp_c))
        self.air_density = max(0.9, float(air_density_kg_m3))
        self.delta_p_pa = max(20.0, float(fan_delta_p_pa))
        self.fan_efficiency = max(0.1, min(0.95, float(fan_efficiency)))
        self.motor_efficiency = max(0.1, min(0.98, float(motor_efficiency)))

        delta_t_supply = max(2.0, self.room_temp_c - self.supply_temp_c)
        self.mass_flow_kg_s = round(self.sensible_load_w / (CP_AIR * 1000.0 * delta_t_supply), 4)
        
        self.volume_flow_m3_s = round(self.mass_flow_kg_s / self.air_density, 5)
        self.volume_flow_m3_h = round(self.volume_flow_m3_s * 3600.0, 1)
        self.volume_flow_cfm = round(self.volume_flow_m3_h * 0.588577, 1)

        combined_efficiency = self.fan_efficiency * self.motor_efficiency
        self.fan_power_w = round((self.volume_flow_m3_s * self.delta_p_pa) / combined_efficiency, 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_temp_c": self.room_temp_c,
            "supply_temp_c": self.supply_temp_c,
            "delta_t_supply_c": round(self.room_temp_c - self.supply_temp_c, 1),
            "mass_flow_kg_s": self.mass_flow_kg_s,
            "volume_flow_m3_s": self.volume_flow_m3_s,
            "volume_flow_m3_h": self.volume_flow_m3_h,
            "volume_flow_cfm": self.volume_flow_cfm,
            "static_pressure_pa": self.delta_p_pa,
            "fan_efficiency": self.fan_efficiency,
            "motor_efficiency": self.motor_efficiency,
            "fan_power_w": self.fan_power_w,
        }

def calculate_office_loads(
    zone: OfficeZone,
    t_out_c: float = 32.0,
    rh_out_pct: float = 65.0,
    t_in_c: Optional[float] = None,
    rh_in_pct: Optional[float] = None,
    occupant_count: Optional[float] = None,
    hour_of_day: float = 14.0,
    supply_temp_c: float = 14.0,
) -> Dict[str, Any]:
    """
    Consolidated engineering calculation pipeline for an office zone.
    Produces traceable cooling load, heating load, psychrometric states, airflow, and fan power.
    """
    t_room = float(t_in_c if t_in_c is not None else zone.target_temp_c)
    rh_room = float(rh_in_pct if rh_in_pct is not None else zone.target_rh_pct)

    room_psychro = PsychrometricState(t_room, rh_room)
    outdoor_psychro = PsychrometricState(t_out_c, rh_out_pct)

    env_loads = zone.envelope.calculate_envelope_loads(t_room, t_out_c)

    internal_loads = zone.internal_loads.calculate_internal_loads(
        zone_area_m2=zone.area_m2,
        occupant_count=occupant_count,
        hour_of_day=hour_of_day,
    )

    oa_flow = zone.ventilation.calculate_oa_flow(
        occupant_count=internal_loads["occupant_count"],
        zone_area_m2=zone.area_m2,
    )
    vent_loads = calculate_air_exchange_loads(
        v_dot_m3_s=oa_flow["total_oa_m3_s"],
        t_in_c=t_room,
        rh_in_pct=rh_room,
        t_out_c=t_out_c,
        rh_out_pct=rh_out_pct,
    )

    inf_flow = zone.infiltration.calculate_infiltration_flow(zone.volume_m3)
    inf_loads = calculate_air_exchange_loads(
        v_dot_m3_s=inf_flow["v_dot_inf_m3_s"],
        t_in_c=t_room,
        rh_in_pct=rh_room,
        t_out_c=t_out_c,
        rh_out_pct=rh_out_pct,
    )

    cooling_breakdown = CoolingLoadBreakdown(
        q_envelope_transmission=env_loads["q_envelope_transmission_w"],
        q_solar_gain=env_loads["q_solar_gain_w"],
        q_people_sensible=internal_loads["q_people_sensible_w"],
        q_people_latent=internal_loads["q_people_latent_w"],
        q_lighting=internal_loads["q_lighting_w"],
        q_equipment=internal_loads["q_equipment_w"],
        q_ventilation_sensible=vent_loads["q_sensible_w"],
        q_ventilation_latent=vent_loads["q_latent_w"],
        q_infiltration_sensible=inf_loads["q_sensible_w"],
        q_infiltration_latent=inf_loads["q_latent_w"],
    )

    q_env_loss = max(0.0, -env_loads["q_envelope_transmission_w"])
    q_vent_loss = max(0.0, -vent_loads["q_sensible_w"])
    q_inf_loss = max(0.0, -inf_loads["q_sensible_w"])
    q_credits = internal_loads["q_internal_sensible_w"]
    heating_breakdown = HeatingLoadBreakdown(
        q_envelope_loss=q_env_loss,
        q_ventilation_loss=q_vent_loss,
        q_infiltration_loss=q_inf_loss,
        q_internal_credits=q_credits,
    )

    airflow_and_coil = HVACAirflowAndCoil(
        sensible_load_w=cooling_breakdown.total_sensible_w,
        room_temp_c=t_room,
        supply_temp_c=supply_temp_c,
        air_density_kg_m3=room_psychro.density,
    )

    return {
        "zone_name": zone.name,
        "zone_area_m2": zone.area_m2,
        "zone_volume_m3": zone.volume_m3,
        "psychrometrics": {
            "indoor": room_psychro.to_dict(),
            "outdoor": outdoor_psychro.to_dict(),
        },
        "cooling_loads": cooling_breakdown.to_dict(),
        "heating_loads": heating_breakdown.to_dict(),
        "airflow_and_coil": airflow_and_coil.to_dict(),
        "ventilation_flow": oa_flow,
        "infiltration_flow": inf_flow,
    }
