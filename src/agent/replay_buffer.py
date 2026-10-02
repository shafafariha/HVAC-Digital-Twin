"""
Experience Replay Buffer for DQN training.
"""
import numpy as np
from collections import deque
from typing import Tuple, Optional


class ReplayBuffer:
    """
    Circular buffer for storing and sampling experiences.
    """
    
    def __init__(self, capacity: int = 10000):
        """
        Initialize replay buffer.
        
        Args:
            capacity: Maximum number of experiences to store
        """
        self.buffer = deque(maxlen=capacity)
        self.capacity = capacity
    
    def push(self, state: np.ndarray, action: int, reward: float, 
             next_state: np.ndarray, done: bool):
        """
        Add experience to buffer.
        
        Args:
            state: Current state
            action: Action taken
            reward: Reward received
            next_state: Next state
            done: Whether episode terminated
        """
        self.buffer.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray, 
                                                np.ndarray, np.ndarray]:
        """
        Sample a batch of experiences.
        
        Args:
            batch_size: Number of experiences to sample
        
        Returns:
            states, actions, rewards, next_states, dones
        """
        indices = np.random.choice(len(self.buffer), batch_size, replace=False)
        
        states = np.array([self.buffer[i][0] for i in indices])
        actions = np.array([self.buffer[i][1] for i in indices])
        rewards = np.array([self.buffer[i][2] for i in indices])
        next_states = np.array([self.buffer[i][3] for i in indices])
        dones = np.array([self.buffer[i][4] for i in indices])
        
        return states, actions, rewards, next_states, dones
    
    def __len__(self) -> int:
        """Return current size of buffer."""
        return len(self.buffer)


