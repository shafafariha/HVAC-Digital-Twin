"""
Reward calculation for HVAC control.

Implements comfort and energy rewards as specified.
"""
import numpy as np
from typing import Tuple

def calculate_comfort_reward(temperature: float, target_temp: float = 25.0, 
                            tolerance: float = 2.0) -> float:
    """
    Calculate comfort reward based on temperature.
    
    Goal: Keep T_in in [target_temp - tolerance, target_temp + tolerance]
    
    Args:
        temperature: Indoor temperature (°C)
        target_temp: Target temperature (default: 25°C)
        tolerance: Temperature tolerance (default: 2°C)
    
    Returns:
        reward: Comfort reward value
    """
    lower_bound = target_temp - tolerance  # 23°C
    upper_bound = target_temp + tolerance  # 27°C
    
    if lower_bound <= temperature <= upper_bound:
        return 1.0
    else:
        distance = abs(temperature - target_temp)
        return -distance

def calculate_energy_reward(power: float, max_power: float = 5000.0) -> float:
    """
    Calculate energy reward (negative, to minimize usage).
    
    Args:
        power: Power consumption (W)
        max_power: Maximum expected power (for normalization)
    
    Returns:
        reward: Energy reward (negative value)
    """
    power_norm = np.clip(power / max_power, 0.0, 1.0)
    
    return -power_norm

def calculate_total_reward(
    temperature: float,
    power: float,
    w_comfort: float = 0.7,
    w_energy: float = 0.3,
    target_temp: float = 25.0,
    tolerance: float = 2.0,
    max_power: float = 5000.0
) -> Tuple[float, float, float]:
    """
    Calculate total reward combining comfort and energy.
    
    R_total = w_comfort * R_comfort + w_energy * R_energy
    
    Args:
        temperature: Indoor temperature (°C)
        power: Power consumption (W)
        w_comfort: Weight for comfort reward (default: 0.7)
        w_energy: Weight for energy reward (default: 0.3)
        target_temp: Target temperature (default: 25°C)
        tolerance: Temperature tolerance (default: 2°C)
        max_power: Maximum expected power (default: 5000W)
    
    Returns:
        total_reward: Combined reward
        comfort_reward: Comfort component
        energy_reward: Energy component
    """
    comfort_reward = calculate_comfort_reward(temperature, target_temp, tolerance)
    energy_reward = calculate_energy_reward(power, max_power)
    
    total_reward = w_comfort * comfort_reward + w_energy * energy_reward
    
    return total_reward, comfort_reward, energy_reward

