"""
Generate synthetic HVAC dataset for training.

Creates a realistic dataset following thermal dynamics.
"""
import numpy as np
import pandas as pd
import os

def simulate_hvac_dynamics(t_in, h_in, p_last, t_out, h_out, occupancy, 
                           source, mode, fan, temp, delta_t=60.0):
    """
    Simulate HVAC state transition based on thermal dynamics.
    
    Args:
        t_in: Current indoor temperature
        h_in: Current indoor humidity
        p_last: Previous power consumption
        t_out: Outdoor temperature
        h_out: Outdoor humidity
        occupancy: Number of occupants
        source: AC source (0=OFF, 1=ON)
        mode: AC mode (1, 2, 3)
        fan: Fan speed (0-6)
        temp: Set temperature (18-30)
        delta_t: Time step in seconds
    
    Returns:
        next_state: [T_in_next, H_in_next, P_next, T_out_next, H_out_next, Occupancy_next]
    """
    C_air = 1000.0  # Thermal capacity (J/°C)
    R_wall = 0.5    # Thermal resistance (°C/W)
    COP = 3.0       # Coefficient of Performance
    
    Q_loss = (t_out - t_in) / R_wall
    
    Q_load = 50.0 + occupancy * 100.0  # Base load + per person
    
    if source == 0:  # OFF
        P_ac = 0.0
        Q_ac = 0.0
    else:  # ON
        temp_diff = abs(t_in - temp)
        base_power = 1000.0  # Base power (W)
        
        if mode == 1:  # Cooling
            mode_factor = 1.0
        elif mode == 2:  # Heating
            mode_factor = 1.2
        else:  # Auto
            mode_factor = 1.1
        
        fan_factor = 1.0 + (fan / 6.0) * 0.3
        
        temp_factor = 1.0 + (temp_diff / 10.0) * 0.5
        
        P_ac = base_power * mode_factor * fan_factor * temp_factor
        P_ac = np.clip(P_ac, 0, 5000)
        
        if t_in > temp:  # Need cooling
            Q_ac = -P_ac * COP
        elif t_in < temp:  # Need heating
            Q_ac = P_ac * COP * 0.8  # Heating less efficient
        else:
            Q_ac = 0.0
    
    dT_dt = (Q_ac + Q_loss + Q_load) / C_air
    T_in_next = t_in + dT_dt * (delta_t / 3600.0)  # Convert seconds to hours
    
    if source == 1 and mode == 1:  # Cooling mode reduces humidity
        H_in_next = h_in - 0.5 * (t_in - T_in_next) * 2.0
    else:
        H_in_next = h_in + 0.1 * (h_out - h_in) * 0.1  # Leakage from outside
    
    H_in_next = np.clip(H_in_next, 0, 100)
    
    T_out_next = t_out + np.random.normal(0, 0.1)
    H_out_next = h_out + np.random.normal(0, 0.5)
    T_out_next = np.clip(T_out_next, 15, 40)
    H_out_next = np.clip(H_out_next, 30, 90)
    
    Occupancy_next = occupancy + np.random.choice([-1, 0, 1], p=[0.1, 0.8, 0.1])
    Occupancy_next = np.clip(Occupancy_next, 0, 20)
    
    return np.array([
        T_in_next,
        H_in_next,
        P_ac,
        T_out_next,
        H_out_next,
        Occupancy_next
    ])

def generate_dataset(num_samples=5000, seed=42, delta_t=60.0):
    """
    Generate synthetic HVAC dataset.
    
    Args:
        num_samples: Number of samples to generate
        seed: Random seed
        delta_t: Time step in seconds (used for time_since_action)
    """
    np.random.seed(seed)
    
    data = []
    
    t_in = np.random.uniform(20, 30)
    h_in = np.random.uniform(40, 60)
    p_last = 0.0
    t_out = np.random.uniform(15, 35)
    h_out = np.random.uniform(50, 80)
    occupancy = np.random.randint(0, 10)
    
    time_since_action_sec = 0.0
    
    for i in range(num_samples):
        source = np.random.choice([0, 1])  # OFF or ON
        mode = np.random.choice([1, 2, 3])  # Cooling, Heating, Auto
        fan = np.random.randint(0, 7)  # 0-6
        temp = np.random.randint(18, 31)  # 18-30
        
        time_since_action_sec += delta_t
        
        next_state = simulate_hvac_dynamics(
            t_in, h_in, p_last, t_out, h_out, occupancy,
            source, mode, fan, temp, delta_t=delta_t
        )
        
        data.append({
            'T_in': t_in,
            'H_in': h_in,
            'P_last': p_last,
            'T_out': t_out,
            'H_out': h_out,
            'Occupancy': occupancy,
            
            'Source': source,
            'Mode': mode,
            'Fan': fan,
            'Temp': temp,
            'TimeSinceAction_sec': time_since_action_sec,
            
            'T_in_next': next_state[0],
            'H_in_next': next_state[1],
            'P_next': next_state[2],
            'T_out_next': next_state[3],
            'H_out_next': next_state[4],
            'Occupancy_next': next_state[5]
        })
        
        t_in = next_state[0]
        h_in = next_state[1]
        p_last = next_state[2]
        t_out = next_state[3]
        h_out = next_state[4]
        occupancy = int(next_state[5])
        
        if np.random.random() < 0.01:
            t_in = np.random.uniform(20, 30)
            h_in = np.random.uniform(40, 60)
            p_last = 0.0
            t_out = np.random.uniform(15, 35)
            h_out = np.random.uniform(50, 80)
            occupancy = np.random.randint(0, 10)
            time_since_action_sec = 0.0
    
    df = pd.DataFrame(data)
    
    return df

if __name__ == '__main__':
    print("Generating synthetic HVAC dataset...")
    
    df = generate_dataset(num_samples=5000, seed=42)
    
    os.makedirs('data/processed', exist_ok=True)
    
    output_path = 'data/processed/sample.csv'
    df.to_csv(output_path, index=False)
    
    print(f"Dataset generated successfully!")
    print(f"Shape: {df.shape}")
    print(f"\nColumn names:")
    print(df.columns.tolist())
    print(f"\nFirst few rows:")
    print(df.head())
    print(f"\nStatistics:")
    print(df.describe())
    print(f"\nSaved to: {output_path}")

