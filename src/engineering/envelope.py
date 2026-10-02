"""
Building Envelope and Fenestration Thermal Module.
Calculates multi-layer thermal resistance (R-values), overall U-factors,
opaque conduction, and directional solar heat gains with reference to ASHRAE 90.1 / ISO 6946.
"""

from typing import List, Dict, Any, Optional

R_SI_VERTICAL = 0.13   # Internal surface resistance for vertical walls
R_SE_OUTSIDE = 0.04    # External surface resistance (moderate wind)
R_SI_HORIZONTAL_UP = 0.10   # Roof heat flow upward
R_SI_HORIZONTAL_DOWN = 0.17 # Floor heat flow downward

MATERIAL_LIBRARY: Dict[str, Dict[str, Any]] = {
    "concrete_dense": {"name": "Reinforced Concrete", "k": 1.75, "density": 2400.0, "category": "structure"},
    "brick_clay": {"name": "Common Brick Masonry", "k": 0.72, "density": 1800.0, "category": "masonry"},
    "mineral_wool": {"name": "Mineral Wool Insulation", "k": 0.038, "density": 50.0, "category": "insulation"},
    "expanded_polystyrene": {"name": "EPS Insulation", "k": 0.035, "density": 25.0, "category": "insulation"},
    "gypsum_board": {"name": "Gypsum Plasterboard", "k": 0.19, "density": 800.0, "category": "lining"},
    "cement_plaster": {"name": "Cement Sand Plaster", "k": 0.72, "density": 1800.0, "category": "plaster"},
    "aerated_autoclaved_concrete": {"name": "AAC Block", "k": 0.18, "density": 600.0, "category": "masonry"},
    "glass_fiber_batt": {"name": "Glass Fiber Batt", "k": 0.040, "density": 30.0, "category": "insulation"},
    "acoustic_ceiling_tile": {"name": "Acoustic Ceiling Tile", "k": 0.06, "density": 350.0, "category": "finish"},
    "air_gap_unventilated": {"name": "Unventilated Air Cavity (20-50mm)", "R": 0.18, "category": "cavity"},
}

class MaterialLayer:
    """Represents a single homogeneous physical material layer in an assembly."""
    def __init__(self, name: str, thickness_m: float, conductivity_k: float):
        if thickness_m <= 0:
            raise ValueError(f"Thickness for layer '{name}' must be positive.")
        if conductivity_k <= 0:
            raise ValueError(f"Thermal conductivity for layer '{name}' must be positive.")
        self.name = str(name)
        self.thickness_m = float(thickness_m)
        self.conductivity_k = float(conductivity_k)
        self.r_value = round(self.thickness_m / self.conductivity_k, 4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "thickness_m": self.thickness_m,
            "conductivity_k": self.conductivity_k,
            "r_value_m2k_w": self.r_value,
        }

class WallAssembly:
    """Multi-layer wall assembly with internal and external surface thermal films."""
    def __init__(
        self,
        name: str = "Standard Insulated Office Wall",
        layers: Optional[List[MaterialLayer]] = None,
        r_si: float = R_SI_VERTICAL,
        r_se: float = R_SE_OUTSIDE,
    ):
        self.name = name
        self.r_si = float(r_si)
        self.r_se = float(r_se)
        self.layers: List[MaterialLayer] = layers or [
            MaterialLayer("Cement Plaster (Exterior)", 0.02, 0.72),
            MaterialLayer("Common Brick Masonry", 0.12, 0.72),
            MaterialLayer("Mineral Wool Insulation", 0.05, 0.038),
            MaterialLayer("Gypsum Plasterboard (Interior)", 0.0125, 0.19),
        ]
        self._calculate_thermal_properties()

    def _calculate_thermal_properties(self):
        self.r_layers_sum = sum(layer.r_value for layer in self.layers)
        self.r_total = round(self.r_si + self.r_layers_sum + self.r_se, 4)
        self.u_value = round(1.0 / self.r_total, 4)

    def calculate_conduction_load(self, area_m2: float, delta_t_c: float) -> float:
        """Q_cond = U * A * delta_t (Watts)"""
        return round(self.u_value * float(area_m2) * float(delta_t_c), 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "layers": [layer.to_dict() for layer in self.layers],
            "r_si": self.r_si,
            "r_se": self.r_se,
            "r_layers_sum": round(self.r_layers_sum, 4),
            "r_total": self.r_total,
            "u_value": self.u_value,
        }

class WindowFenestration:
    """Glazing fenestration defined per cardinal orientation."""
    def __init__(
        self,
        orientation: str, # "North", "South", "East", "West"
        area_m2: float,
        u_value: float = 2.4, # W/(m2*K), typical double glazed
        shgc: float = 0.40,   # Solar Heat Gain Coefficient
        solar_irradiance_w_m2: float = 250.0, # Incident peak irradiance W/m2
    ):
        self.orientation = orientation
        self.area_m2 = max(0.0, float(area_m2))
        self.u_value = max(0.5, float(u_value))
        self.shgc = max(0.05, min(0.95, float(shgc)))
        self.solar_irradiance_w_m2 = max(0.0, float(solar_irradiance_w_m2))

    def calculate_solar_heat_gain(self) -> float:
        """Q_solar = A_glass * SHGC * I_solar (Watts)"""
        return round(self.area_m2 * self.shgc * self.solar_irradiance_w_m2, 2)

    def calculate_conduction(self, delta_t_c: float) -> float:
        """Q_glass_cond = U * A * delta_t (Watts)"""
        return round(self.u_value * self.area_m2 * float(delta_t_c), 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "orientation": self.orientation,
            "area_m2": self.area_m2,
            "u_value": self.u_value,
            "shgc": self.shgc,
            "solar_irradiance_w_m2": self.solar_irradiance_w_m2,
            "solar_gain_watts": self.calculate_solar_heat_gain(),
        }

class BuildingEnvelope:
    """Consolidated office building envelope (walls, roof, floor, windows)."""
    def __init__(
        self,
        wall_assembly: Optional[WallAssembly] = None,
        gross_wall_area_m2: float = 180.0,
        roof_assembly: Optional[WallAssembly] = None,
        roof_area_m2: float = 120.0,
        floor_u_value: float = 0.65,
        floor_area_m2: float = 120.0,
        windows: Optional[List[WindowFenestration]] = None,
    ):
        self.wall_assembly = wall_assembly or WallAssembly()
        self.gross_wall_area_m2 = max(10.0, float(gross_wall_area_m2))
        
        self.roof_assembly = roof_assembly or WallAssembly(
            name="Insulated Flat Office Roof",
            layers=[
                MaterialLayer("Concrete Slab Roof", 0.15, 1.75),
                MaterialLayer("EPS Roof Insulation", 0.08, 0.035),
                MaterialLayer("Waterproofing & Gravel Finish", 0.02, 0.50),
            ],
            r_si=R_SI_HORIZONTAL_UP,
            r_se=R_SE_OUTSIDE,
        )
        self.roof_area_m2 = max(0.0, float(roof_area_m2))
        self.floor_u_value = max(0.1, float(floor_u_value))
        self.floor_area_m2 = max(0.0, float(floor_area_m2))

        self.windows: List[WindowFenestration] = windows or [
            WindowFenestration("North", area_m2=6.0, u_value=2.4, shgc=0.45, solar_irradiance_w_m2=120.0),
            WindowFenestration("South", area_m2=6.0, u_value=2.4, shgc=0.40, solar_irradiance_w_m2=350.0),
            WindowFenestration("East", area_m2=6.0, u_value=2.4, shgc=0.40, solar_irradiance_w_m2=400.0),
            WindowFenestration("West", area_m2=6.0, u_value=2.4, shgc=0.40, solar_irradiance_w_m2=420.0),
        ]

    @property
    def total_window_area_m2(self) -> float:
        return sum(w.area_m2 for w in self.windows)

    @property
    def net_wall_area_m2(self) -> float:
        net = self.gross_wall_area_m2 - self.total_window_area_m2
        return max(1.0, net)

    def calculate_total_ua(self) -> float:
        """Calculate overall UA product (W/K) for envelope heat transfer."""
        ua_wall = self.wall_assembly.u_value * self.net_wall_area_m2
        ua_roof = self.roof_assembly.u_value * self.roof_area_m2
        ua_windows = sum(w.u_value * w.area_m2 for w in self.windows)
        return round(ua_wall + ua_roof + ua_windows, 2)

    def calculate_envelope_loads(self, t_in: float, t_out: float) -> Dict[str, float]:
        """
        Calculate simplified conductive envelope transmission and solar radiation gains.
        Distinguished as simplified engineering estimates.
        """
        delta_t = float(t_out - t_in)
        q_wall = self.wall_assembly.calculate_conduction_load(self.net_wall_area_m2, delta_t)
        q_roof = self.roof_assembly.calculate_conduction_load(self.roof_area_m2, delta_t)
        q_glazing_cond = sum(w.calculate_conduction(delta_t) for w in self.windows)
        q_solar = sum(w.calculate_solar_heat_gain() for w in self.windows)

        q_envelope_transmission = round(q_wall + q_roof + q_glazing_cond, 2)
        q_envelope_total = round(q_envelope_transmission + q_solar, 2)

        return {
            "q_wall_conduction_w": q_wall,
            "q_roof_conduction_w": q_roof,
            "q_glazing_conduction_w": round(q_glazing_cond, 2),
            "q_solar_gain_w": round(q_solar, 2),
            "q_envelope_transmission_w": q_envelope_transmission,
            "q_envelope_total_w": q_envelope_total,
            "total_ua_w_k": self.calculate_total_ua(),
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "wall_assembly": self.wall_assembly.to_dict(),
            "roof_assembly": self.roof_assembly.to_dict(),
            "gross_wall_area_m2": self.gross_wall_area_m2,
            "net_wall_area_m2": round(self.net_wall_area_m2, 2),
            "roof_area_m2": self.roof_area_m2,
            "total_window_area_m2": round(self.total_window_area_m2, 2),
            "windows": [w.to_dict() for w in self.windows],
            "total_ua_w_k": self.calculate_total_ua(),
        }
