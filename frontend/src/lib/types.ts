/**
 * TypeScript Interfaces for HVAC Digital Twin & RL Control
 */

export interface StateVector {
  T_in: number;        // Indoor Temperature (°C)
  H_in: number;        // Indoor Relative Humidity (%)
  P_last: number;      // Last Power (W)
  T_out: number;       // Outdoor Temperature (°C)
  H_out: number;       // Outdoor Relative Humidity (%)
  Occupancy: number;   // Number of occupants / presence
}

export interface ActionParams {
  source: number;      // 0: OFF, 1: ON
  mode: number;        // 1: Cool, 2: Heat, 3: Fan/Vent
  fan_speed: number;   // 0 - 6
  target_temp: number; // 18 - 30 °C
}

export interface ActionCandidate {
  action_index: number;
  source: number;
  mode: number;
  fan_speed: number;
  target_temp: number;
  q_value: number;
}

export interface ControlResponse {
  action_index: number;
  action_params: ActionParams;
  q_value: number;
  top_candidates: ActionCandidate[];
  explanation: string;
}

export interface SimulateStepRequest {
  state: StateVector;
  backend: 'pinn' | 'rc' | 'vanilla_nn';
  action_index?: number;
  action_params?: ActionParams;
  use_agent?: boolean;
}

export interface SimulateStepResponse {
  next_state: StateVector;
  power_watts: number;
  reward: number;
  is_comfort: boolean;
  comfort_band: {
    min: number;
    max: number;
    target: number;
  };
  action_taken: ActionParams;
  backend_used: string;
}

export interface TrajectoryStepLog {
  step: number;
  time_label: string;
  T_in: number;
  H_in: number;
  P_last: number;
  T_out: number;
  H_out: number;
  Occupancy: number;
  power_watts: number;
  reward: number;
  is_comfort: boolean;
  action: ActionParams;
}

export interface TrajectorySimulateRequest {
  initial_state?: StateVector;
  steps?: number;
  backend?: 'pinn' | 'rc';
  control_mode?: 'dqn' | 'manual' | 'fixed_setpoint';
  manual_action?: ActionParams;
  outdoor_temp_pattern?: 'diurnal' | 'heatwave' | 'constant';
  occupancy_pattern?: 'office' | 'constant' | 'empty';
}

export interface BenchmarkRecord {
  backend: string;
  reward_mean: number;
  reward_std: number;
  temp_mean: number;
  temp_std: number;
  power_mean: number;
  power_std: number;
  comfort_mean: number;
  comfort_std: number;
}

export interface HealthResponse {
  status: string;
  device: string;
  models_loaded: {
    pinn: boolean;
    dqn: boolean;
    rc: boolean;
  };
  available_backends: string[];
  pinn_checkpoint?: string;
  dqn_checkpoint?: string;
}

export interface BatchSimulationSummary {
  filename: string;
  total_steps: number;
  backend_used: string;
  control_mode: string;
  comfort_adherence_pct: number;
  mean_indoor_temp: number;
  mean_power_watts: number;
  total_energy_kwh: number;
  mean_reward: number;
}

export interface BatchSimulationResponse {
  summary: BatchSimulationSummary;
  trajectory: TrajectoryStepLog[];
}

export interface WindowFenestrationInput {
  orientation: 'North' | 'South' | 'East' | 'West' | string;
  area_m2: number;
  u_value: number;
  shgc: number;
  solar_irradiance_w_m2: number;
}

export interface WallLayerInput {
  name: string;
  thickness_m: number;
  conductivity_k: number;
}

export interface OfficeEquipmentInput {
  name: string;
  quantity: number;
  rated_power_w: number;
  utilization_factor: number;
}

export interface EngineeringZoneRequest {
  name: string;
  preset_type: string;
  area_m2: number;
  height_m: number;
  target_temp_c: number;
  target_rh_pct: number;
  max_occupants: number;
  lpd_w_m2: number;
  ach: number;
  oa_person_l_s: number;
  oa_area_l_s_m2: number;
  wall_u_value?: number;
  roof_u_value?: number;
  wall_layers?: WallLayerInput[];
  windows?: WindowFenestrationInput[];
  equipment_items?: OfficeEquipmentInput[];
  cooling_cop: number;
  t_out_c: number;
  rh_out_pct: number;
  hour_of_day: number;
  supply_temp_c: number;
  clothing_clo: number;
  met_rate: number;
  air_velocity_m_s: number;
}

export interface PsychrometricPoint {
  t_db_c: number;
  w_kg_kg: number;
  h_kj_kg: number;
  rh_pct: number;
  t_dp_c: number;
}

export interface SensibleCoolingBreakdown {
  conduction_wall_roof_w: number;
  solar_fenestration_w: number;
  occupants_sensible_w: number;
  lighting_w: number;
  equipment_w: number;
  ventilation_sensible_w: number;
  infiltration_sensible_w: number;
  total_sensible_w: number;
  total_sensible_kw: number;
}

export interface LatentCoolingBreakdown {
  occupants_latent_w: number;
  ventilation_latent_w: number;
  infiltration_latent_w: number;
  total_latent_w: number;
  total_latent_kw: number;
}

export interface HeatingLoadBreakdown {
  conduction_w: number;
  ventilation_sensible_w: number;
  infiltration_sensible_w: number;
  total_heating_kw: number;
}

export interface HVACAirflowAndCoil {
  supply_airflow_m3_h: number;
  supply_airflow_l_s: number;
  air_mass_flow_kg_s: number;
  supply_air_delta_t_k: number;
  coil_cooling_total_kw: number;
  coil_sensible_kw: number;
  coil_latent_kw: number;
  coil_shr: number;
  fan_power_w: number;
  design_static_pressure_pa: number;
}

export interface PsychrometricsSummary {
  outdoor: PsychrometricPoint;
  room: PsychrometricPoint;
  supply_air: PsychrometricPoint;
  mixed_air: PsychrometricPoint;
}

export interface ThermalComfortResult {
  pmv: number;
  ppd_pct: number;
  sensation: string;
  compliance_iso7730: string;
  is_comfortable: boolean;
}

export interface CalibratedTwinParameters {
  c_air: number;
  r_wall: number;
  cop: number;
  q_load: number;
  time_constant_hours: number;
  ua_total_w_k: number;
  thermal_mass_j_k: number;
  zone_volume_m3: number;
}

export interface EngineeringCalculationResponse {
  zone_spec: Record<string, any>;
  loads_and_airflow: {
    zone_name: string;
    sensible_cooling_w: SensibleCoolingBreakdown;
    latent_cooling_w: LatentCoolingBreakdown;
    total_cooling_load_kw: number;
    total_cooling_load_tr: number;
    sensible_heat_ratio: number;
    heating_load_w: HeatingLoadBreakdown;
    hvac_airflow_and_coil: HVACAirflowAndCoil;
    psychrometrics: PsychrometricsSummary;
  };
  thermal_comfort: ThermalComfortResult;
  calibrated_twin_parameters: CalibratedTwinParameters;
}

export interface ZonePresetItem {
  preset_type: string;
  defaults: {
    area_m2: number;
    height_m: number;
    max_occupants: number;
    lpd_w_m2: number;
    oa_person_l_s: number;
    oa_area_l_s_m2: number;
    ach: number;
    wall_u: number;
    roof_u: number;
    cooling_cop: number;
    default_equipment: OfficeEquipmentInput[];
  };
}

export interface EngineeringPresetsResponse {
  presets: ZonePresetItem[];
  materials_library: Record<string, { conductivity: number; density: number; specific_heat: number }>;
}

export interface ControlComparisonStepLog {
  step: number;
  time_label: string;
  T_in: number;
  power_w: number;
  reward: number;
  is_comfort: boolean;
  action: ActionParams;
}

export interface ControlComparisonSummary {
  dqn_energy_kwh: number;
  baseline_energy_kwh: number;
  energy_savings_pct: number;
  dqn_comfort_compliance_pct: number;
  baseline_comfort_compliance_pct: number;
  dqn_mean_temp_c: number;
  baseline_mean_temp_c: number;
  dqn_mean_reward: number;
  baseline_mean_reward: number;
}

export interface ControlComparisonResponse {
  zone_name: string;
  steps_evaluated: number;
  summary: ControlComparisonSummary;
  dqn_trajectory: ControlComparisonStepLog[];
  baseline_trajectory: ControlComparisonStepLog[];
  evaluation_note: string;
}

export interface ControlComparisonRequest {
  zone: EngineeringZoneRequest;
  steps?: number;
  outdoor_temp_pattern?: 'diurnal' | 'heatwave' | 'constant';
  baseline_setpoint_c?: number;
}

