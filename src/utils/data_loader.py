"""
Data loading utilities for training PINN.
"""
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from typing import Tuple, Optional, Dict
import os

class HVACDataset(Dataset):
    """
    Dataset for HVAC state transitions.
    """
    
    def __init__(self, states: np.ndarray, actions: np.ndarray, next_states: np.ndarray):
        """
        Initialize dataset.
        
        Args:
            states: Current states [N, state_dim]
            actions: Actions [N, action_dim]
            next_states: Next states [N, state_dim]
        """
        self.states = torch.FloatTensor(states)
        self.actions = torch.FloatTensor(actions)
        self.next_states = torch.FloatTensor(next_states)
    
    def __len__(self) -> int:
        return len(self.states)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        return self.states[idx], self.actions[idx], self.next_states[idx]

def load_csv_data(
    filepath: str,
    state_columns: Optional[list] = None,
    action_columns: Optional[list] = None,
    next_state_columns: Optional[list] = None
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Load HVAC data from CSV file.
    
    Expected CSV format:
    - Columns for state variables: T_in, H_in, P_last, T_out, H_out, Occupancy
    - Columns for action variables: Source, Mode, Fan, Temp, TimeSinceAction_sec
    - Columns for next state: T_in_next, H_in_next, P_next, T_out_next, H_out_next, Occupancy_next
    
    Args:
        filepath: Path to CSV file
        state_columns: List of column names for current state
        action_columns: List of column names for actions
        next_state_columns: List of column names for next state
    
    Returns:
        states, actions, next_states as numpy arrays
    """
    df = pd.read_csv(filepath)
    
    if state_columns is None:
        state_columns = ['T_in', 'H_in', 'P_last', 'T_out', 'H_out', 'Occupancy']
    
    if action_columns is None:
        action_columns = ['Source', 'Mode', 'Fan', 'Temp', 'TimeSinceAction_sec']
        if 'TimeSinceAction_sec' not in df.columns:
            action_columns = ['Source', 'Mode', 'Fan', 'Temp']
    
    if next_state_columns is None:
        next_state_columns = ['T_in_next', 'H_in_next', 'P_next', 'T_out_next', 'H_out_next', 'Occupancy_next']
    
    states = df[state_columns].values
    actions = df[action_columns].values
    next_states = df[next_state_columns].values
    
    states = np.nan_to_num(states, nan=0.0)
    actions = np.nan_to_num(actions, nan=0.0)
    next_states = np.nan_to_num(next_states, nan=0.0)
    
    return states, actions, next_states

def normalize_data(data: np.ndarray, bounds: Optional[Dict] = None) -> Tuple[np.ndarray, Dict]:
    """
    Normalize data to [0, 1] range.
    
    Args:
        data: Data array [N, features]
        bounds: Optional pre-computed bounds dict with 'min' and 'max' arrays
    
    Returns:
        normalized_data: Normalized data
        bounds: Dictionary with 'min' and 'max' arrays used for normalization
    """
    if bounds is None:
        data_min = np.min(data, axis=0)
        data_max = np.max(data, axis=0)
        data_max = np.where(data_max == data_min, data_max + 1e-6, data_max)
    else:
        data_min = bounds['min']
        data_max = bounds['max']
    
    normalized = (data - data_min) / (data_max - data_min)
    
    return normalized, {'min': data_min, 'max': data_max}

def denormalize_data(normalized_data: np.ndarray, bounds: Dict) -> np.ndarray:
    """
    Denormalize data from [0, 1] range.
    
    Args:
        normalized_data: Normalized data
        bounds: Dictionary with 'min' and 'max' arrays
    
    Returns:
        denormalized_data: Original scale data
    """
    data_min = bounds['min']
    data_max = bounds['max']
    
    denormalized = normalized_data * (data_max - data_min) + data_min
    
    return denormalized

def create_dataloader(
    states: np.ndarray,
    actions: np.ndarray,
    next_states: np.ndarray,
    batch_size: int = 64,
    shuffle: bool = True,
    train_split: float = 0.8
) -> Tuple[DataLoader, DataLoader]:
    """
    Create train and validation dataloaders.
    
    Args:
        states: Current states
        actions: Actions
        next_states: Next states
        batch_size: Batch size
        shuffle: Whether to shuffle data
        train_split: Fraction of data for training
    
    Returns:
        train_loader, val_loader
    """
    n_train = int(len(states) * train_split)
    
    train_states = states[:n_train]
    train_actions = actions[:n_train]
    train_next_states = next_states[:n_train]
    
    val_states = states[n_train:]
    val_actions = actions[n_train:]
    val_next_states = next_states[n_train:]
    
    train_dataset = HVACDataset(train_states, train_actions, train_next_states)
    val_dataset = HVACDataset(val_states, val_actions, val_next_states)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=shuffle)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    return train_loader, val_loader

