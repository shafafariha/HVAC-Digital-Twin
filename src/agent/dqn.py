"""
Deep Q-Network (DQN) Agent for HVAC Control.
"""
from __future__ import annotations
import numpy as np
from typing import Tuple, Optional

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    optim = None
    F = None
    HAS_TORCH = False

class NumPyDQNAgent:
    """Lightweight pure NumPy inference engine for DQNAgent (CPU-only, zero GPU/CUDA dependencies)."""
    def __init__(self, npz_path: str, action_dim: int = 546):
        weights = np.load(npz_path)
        self.W0 = weights['network.0.weight']
        self.b0 = weights['network.0.bias']
        self.W2 = weights['network.2.weight']
        self.b2 = weights['network.2.bias']
        self.W4 = weights['network.4.weight']
        self.b4 = weights['network.4.bias']
        self.W6 = weights['network.6.weight']
        self.b6 = weights['network.6.bias']
        self.action_dim = action_dim
        self.epsilon = 0.0
        self.gamma = 0.99

    def predict_q_values(self, state: np.ndarray) -> np.ndarray:
        if state.ndim == 1:
            state = state.reshape(1, -1)
        h1 = np.maximum(0, state @ self.W0.T + self.b0)
        h2 = np.maximum(0, h1 @ self.W2.T + self.b2)
        h3 = np.maximum(0, h2 @ self.W4.T + self.b4)
        q_vals = h3 @ self.W6.T + self.b6
        return q_vals.squeeze(0)

    def select_action(self, state: np.ndarray, training: bool = False, epsilon: float = 0.0) -> int:
        if training and np.random.random() < self.epsilon:
            return int(np.random.randint(0, self.action_dim))
        q_values = self.predict_q_values(state)
        return int(np.argmax(q_values))

    def load(self, path: str):
        pass

if HAS_TORCH:
    class QNetwork(nn.Module):
        """
        Q-Network that maps (state, action) -> Q-value.
        """
        
        def __init__(self, state_dim: int, action_dim: int, hidden_dims: list = [128, 128, 64]):
            """
            Initialize Q-network.
            
            Args:
                state_dim: Dimension of state vector
                action_dim: Number of discrete actions
                hidden_dims: List of hidden layer dimensions
            """
            super(QNetwork, self).__init__()
            
            layers = []
            prev_dim = state_dim
            
            for hidden_dim in hidden_dims:
                layers.append(nn.Linear(prev_dim, hidden_dim))
                layers.append(nn.ReLU())
                prev_dim = hidden_dim
            
            layers.append(nn.Linear(prev_dim, action_dim))
            
            self.network = nn.Sequential(*layers)
            
            self._initialize_weights()
        
        def _initialize_weights(self):
            """Initialize network weights."""
            for m in self.modules():
                if isinstance(m, nn.Linear):
                    nn.init.xavier_uniform_(m.weight)
                    if m.bias is not None:
                        nn.init.constant_(m.bias, 0)
        
        def forward(self, state: torch.Tensor) -> torch.Tensor:
            """
            Forward pass: compute Q-values for all actions.
            
            Args:
                state: State tensor [batch_size, state_dim]
            
            Returns:
                q_values: Q-values for all actions [batch_size, action_dim]
            """
            return self.network(state)

    class DQNAgent:
        """
        DQN Agent with experience replay and target network.
        """
        
        def __init__(
            self,
            state_dim: int,
            action_dim: int,
            device: str = 'cpu',
            lr: float = 1e-3,
            gamma: float = 0.99,
            epsilon: float = 1.0,
            epsilon_min: float = 0.01,
            epsilon_decay: float = 0.995,
            batch_size: int = 64,
            buffer_size: int = 10000,
            target_update_freq: int = 100,
            hidden_dims: list = [128, 128, 64]
        ):
            """
            Initialize DQN agent.
            
            Args:
                state_dim: Dimension of state vector
                action_dim: Number of discrete actions
                device: Device to run on ('cpu' or 'cuda')
                lr: Learning rate
                gamma: Discount factor
                epsilon: Initial exploration rate
                epsilon_min: Minimum exploration rate
                epsilon_decay: Epsilon decay rate per step
                batch_size: Batch size for training
                buffer_size: Size of replay buffer
                target_update_freq: Frequency of target network updates
                hidden_dims: Hidden layer dimensions for Q-network
            """
            from .replay_buffer import ReplayBuffer
            self.state_dim = state_dim
            self.action_dim = action_dim
            self.device = device
            self.gamma = gamma
            self.epsilon = epsilon
            self.epsilon_min = epsilon_min
            self.epsilon_decay = epsilon_decay
            self.batch_size = batch_size
            self.target_update_freq = target_update_freq
            self.update_counter = 0
            
            self.q_network = QNetwork(state_dim, action_dim, hidden_dims).to(device)
            self.target_network = QNetwork(state_dim, action_dim, hidden_dims).to(device)
            self.target_network.load_state_dict(self.q_network.state_dict())
            self.target_network.eval()
            
            self.optimizer = optim.Adam(self.q_network.parameters(), lr=lr)
            
            self.replay_buffer = ReplayBuffer(buffer_size)
        
        def predict_q_values(self, state: np.ndarray) -> np.ndarray:
            """Compute Q-values for all actions from state numpy array."""
            if state.ndim == 1:
                state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            else:
                state_t = torch.FloatTensor(state).to(self.device)
            with torch.no_grad():
                q_vals = self.q_network(state_t).squeeze(0).cpu().numpy()
            return q_vals

        def select_action(self, state: np.ndarray, training: bool = True) -> int:
            """
            Select action using epsilon-greedy policy.
            
            Args:
                state: Current state vector
                training: Whether in training mode (uses epsilon-greedy)
            
            Returns:
                action: Selected action index
            """
            if training and np.random.random() < self.epsilon:
                return np.random.randint(0, self.action_dim)
            
            with torch.no_grad():
                state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
                q_values = self.q_network(state_tensor)
                action = q_values.argmax().item()
            
            return action
        
        def store(self, state: np.ndarray, action: int, reward: float, 
                  next_state: np.ndarray, done: bool):
            """
            Store experience in replay buffer.
            
            Args:
                state: Current state
                action: Action taken
                reward: Reward received
                next_state: Next state
                done: Whether episode terminated
            """
            self.replay_buffer.push(state, action, reward, next_state, done)
        
        def update_policy(self) -> Optional[float]:
            """
            Update Q-network using a batch from replay buffer.
            
            Returns:
                loss: Training loss (None if buffer too small)
            """
            if len(self.replay_buffer) < self.batch_size:
                return None
            
            states, actions, rewards, next_states, dones = self.replay_buffer.sample(self.batch_size)
            
            states = torch.FloatTensor(states).to(self.device)
            actions = torch.LongTensor(actions).to(self.device)
            rewards = torch.FloatTensor(rewards).to(self.device)
            next_states = torch.FloatTensor(next_states).to(self.device)
            dones = torch.BoolTensor(dones).to(self.device)
            
            q_values = self.q_network(states)
            q_value = q_values.gather(1, actions.unsqueeze(1)).squeeze(1)
            
            with torch.no_grad():
                next_q_values = self.target_network(next_states)
                next_q_value = next_q_values.max(1)[0]
                target_q_value = rewards + (self.gamma * next_q_value * ~dones)
            
            loss = F.mse_loss(q_value, target_q_value)
            
            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.q_network.parameters(), 1.0)
            self.optimizer.step()
            
            if self.epsilon > self.epsilon_min:
                self.epsilon *= self.epsilon_decay
            
            self.update_counter += 1
            if self.update_counter % self.target_update_freq == 0:
                self.target_network.load_state_dict(self.q_network.state_dict())
            
            return loss.item()
        
        def save(self, filepath: str):
            """Save agent state."""
            torch.save({
                'q_network': self.q_network.state_dict(),
                'target_network': self.target_network.state_dict(),
                'optimizer': self.optimizer.state_dict(),
                'epsilon': self.epsilon
            }, filepath)
        
        def load(self, filepath: str):
            """Load agent state."""
            checkpoint = torch.load(filepath, map_location=self.device)
            self.q_network.load_state_dict(checkpoint['q_network'])
            self.target_network.load_state_dict(checkpoint['target_network'])
            self.optimizer.load_state_dict(checkpoint['optimizer'])
            self.epsilon = checkpoint.get('epsilon', self.epsilon_min)
else:
    class QNetwork:
        """Fallback placeholder when PyTorch is not installed."""
        def __init__(self, *args, **kwargs):
            pass

    DQNAgent = NumPyDQNAgent
