"""
Step 1: Train the PINN (Physics-Informed Neural Network) Simulator.

This script trains the PINN to predict next state given current state and action.
The PINN is constrained by thermal dynamics physics equations.
"""
import os
import argparse
import yaml
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
from tqdm import tqdm

from src.env.pinn_model import PINNModel
from src.env.physics_loss import thermal_physics_loss
from src.utils.data_loader import load_csv_data, create_dataloader, normalize_data

def train_pinn(
    data_path: str,
    config_path: str,
    model_save_path: str = 'models/pinn_model.pth',
    device: str = 'cpu',
    physics_lambda_override: float = None,
):
    """
    Train PINN model.
    
    Args:
        data_path: Path to CSV file with training data
        config_path: Path to PINN config YAML file
        model_save_path: Path to save trained model
        device: Device to train on ('cpu' or 'cuda')
    """
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    if physics_lambda_override is not None:
        config['physics_lambda_override'] = physics_lambda_override

    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    
    print(f"Loading data from {data_path}...")
    states, actions, next_states = load_csv_data(data_path)
    
    print(f"Loaded {len(states)} samples")
    print(f"State shape: {states.shape}, Action shape: {actions.shape}")
    
    print("Normalizing data...")
    states_norm, state_bounds = normalize_data(states)
    actions_norm, action_bounds = normalize_data(actions)
    next_states_norm, next_state_bounds = normalize_data(next_states)
    
    train_loader, val_loader = create_dataloader(
        states_norm, actions_norm, next_states_norm,
        batch_size=config['batch_size'],
        shuffle=True,
        train_split=config.get('train_split', 0.8)
    )
    
    state_dim = states.shape[1]
    action_dim = actions.shape[1]
    
    model = PINNModel(
        state_dim=state_dim,
        action_dim=action_dim,
        hidden_dims=config.get('hidden_dims', [128, 128, 64]),
        dropout=config.get('dropout', 0.1)
    ).to(device)
    
    print(f"Model initialized with {sum(p.numel() for p in model.parameters())} parameters")
    
    mse_loss = nn.MSELoss()
    physics_lambda = config.get('physics_lambda', 0.1)
    if 'physics_lambda_override' in config:
        physics_lambda = config['physics_lambda_override']
    
    optimizer = optim.Adam(
        model.parameters(),
        lr=config.get('learning_rate', 1e-3),
        weight_decay=config.get('weight_decay', 1e-5)
    )
    
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=10
    )
    
    num_epochs = config.get('num_epochs', 100)
    delta_t = config.get('delta_t', 60.0)  # Time step in seconds
    
    best_val_loss = float('inf')
    train_losses = []
    val_losses = []
    
    print("\nStarting training...")
    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        train_data_loss = 0.0
        train_physics_loss = 0.0
        
        for batch_states, batch_actions, batch_next_states in tqdm(
            train_loader, desc=f"Epoch {epoch+1}/{num_epochs}"
        ):
            batch_states = batch_states.to(device)
            batch_actions = batch_actions.to(device)
            batch_next_states = batch_next_states.to(device)
            
            next_states_pred = model(batch_states, batch_actions)
            
            loss_data = mse_loss(next_states_pred, batch_next_states)
            
            loss_physics = thermal_physics_loss(
                batch_states, batch_actions, next_states_pred,
                delta_t=delta_t, state_bounds=state_bounds
            )
            
            loss = loss_data + physics_lambda * loss_physics
            
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            
            train_loss += loss.item()
            train_data_loss += loss_data.item()
            train_physics_loss += loss_physics.item()
        
        model.eval()
        val_loss = 0.0
        val_data_loss = 0.0
        val_physics_loss = 0.0
        
        with torch.no_grad():
            for batch_states, batch_actions, batch_next_states in val_loader:
                batch_states = batch_states.to(device)
                batch_actions = batch_actions.to(device)
                batch_next_states = batch_next_states.to(device)
                
                next_states_pred = model(batch_states, batch_actions)
                
                loss_data = mse_loss(next_states_pred, batch_next_states)
                loss_physics = thermal_physics_loss(
                    batch_states, batch_actions, next_states_pred,
                    delta_t=delta_t, state_bounds=state_bounds
                )
                loss = loss_data + physics_lambda * loss_physics
                
                val_loss += loss.item()
                val_data_loss += loss_data.item()
                val_physics_loss += loss_physics.item()
        
        train_loss /= len(train_loader)
        train_data_loss /= len(train_loader)
        train_physics_loss /= len(train_loader)
        val_loss /= len(val_loader)
        val_data_loss /= len(val_loader)
        val_physics_loss /= len(val_loader)
        
        train_losses.append(train_loss)
        val_losses.append(val_loss)
        
        scheduler.step(val_loss)
        
        print(f"\nEpoch {epoch+1}/{num_epochs}:")
        print(f"  Train Loss: {train_loss:.6f} (Data: {train_data_loss:.6f}, Physics: {train_physics_loss:.6f})")
        print(f"  Val Loss: {val_loss:.6f} (Data: {val_data_loss:.6f}, Physics: {val_physics_loss:.6f})")
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'state_bounds': state_bounds,
                'action_bounds': action_bounds,
                'next_state_bounds': next_state_bounds,
                'state_dim': state_dim,
                'action_dim': action_dim,
                'config': config,
                'val_loss': val_loss
            }, model_save_path)
            print(f"  ✓ Saved best model (val_loss: {val_loss:.6f})")
    
    print(f"\nTraining completed! Best validation loss: {best_val_loss:.6f}")
    print(f"Model saved to {model_save_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train PINN model')
    parser.add_argument('--data', type=str, default='data/processed/train_data.csv',
                        help='Path to training data CSV')
    parser.add_argument('--config', type=str, default='configs/pinn_config.yaml',
                        help='Path to PINN config YAML')
    parser.add_argument('--model', type=str, default='models/pinn_model.pth',
                        help='Path to save trained model')
    parser.add_argument('--device', type=str, default='cuda' if torch.cuda.is_available() else 'cpu',
                        help='Device to train on')
    parser.add_argument('--physics_lambda', type=float, default=None,
                        help='Override physics loss weight (e.g. 0 for vanilla NN)')
    
    args = parser.parse_args()
    
    train_pinn(
        data_path=args.data,
        config_path=args.config,
        model_save_path=args.model,
        device=args.device,
        physics_lambda_override=args.physics_lambda,
    )

