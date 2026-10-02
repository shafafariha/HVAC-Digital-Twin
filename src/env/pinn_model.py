"""
Physics-Informed Neural Network (PINN) for HVAC Dynamics Prediction.

The PINN predicts the next state given current state and action.
"""
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    F = None
    HAS_TORCH = False

import numpy as np


class NumPyPINNModel:
    """Lightweight pure NumPy inference engine for PINNModel (CPU-only, zero GPU/CUDA dependencies)."""
    def __init__(self, npz_path: str):
        weights = np.load(npz_path)
        self.W0 = weights['network.0.weight']
        self.b0 = weights['network.0.bias']
        self.W3 = weights['network.3.weight']
        self.b3 = weights['network.3.bias']
        self.W6 = weights['network.6.weight']
        self.b6 = weights['network.6.bias']
        self.W9 = weights['network.9.weight']
        self.b9 = weights['network.9.bias']

    def __call__(self, state: np.ndarray, action: np.ndarray) -> np.ndarray:
        if state.ndim == 1:
            state = state.reshape(1, -1)
        if action.ndim == 1:
            action = action.reshape(1, -1)
        x = np.concatenate([state, action], axis=-1)
        h1 = np.maximum(0, x @ self.W0.T + self.b0)
        h2 = np.maximum(0, h1 @ self.W3.T + self.b3)
        h3 = np.maximum(0, h2 @ self.W6.T + self.b6)
        pred = (np.tanh(h3 @ self.W9.T + self.b9) + 1.0) / 2.0
        return pred

    def eval(self):
        return self

    def to(self, device):
        return self


if HAS_TORCH:
    class PINNModel(nn.Module):
        """
        Multi-Layer Perceptron (MLP) for state transition prediction.
        
        Input: [state, action] -> Output: next_state
        """
        def __init__(self, state_dim=6, action_dim=4, hidden_dims=[128, 128, 64], dropout=0.1):
            super(PINNModel, self).__init__()
            self.state_dim = state_dim
            self.action_dim = action_dim
            input_dim = state_dim + action_dim
            layers = []
            prev_dim = input_dim
            for hidden_dim in hidden_dims:
                layers.append(nn.Linear(prev_dim, hidden_dim))
                layers.append(nn.ReLU())
                layers.append(nn.Dropout(dropout))
                prev_dim = hidden_dim
            layers.append(nn.Linear(prev_dim, state_dim))
            layers.append(nn.Tanh())
            self.network = nn.Sequential(*layers)
            self._initialize_weights()

        def _initialize_weights(self):
            for m in self.modules():
                if isinstance(m, nn.Linear):
                    nn.init.xavier_uniform_(m.weight)
                    if m.bias is not None:
                        nn.init.constant_(m.bias, 0)

        def forward(self, state, action):
            x = torch.cat([state, action], dim=1)
            next_state_pred = self.network(x)
            next_state_pred = (next_state_pred + 1.0) / 2.0
            return next_state_pred

    class LSTMPINNModel(nn.Module):
        """LSTM-based PINN for temporal dynamics (optional alternative)."""
        def __init__(self, state_dim=6, action_dim=4, hidden_dim=128, num_layers=2, dropout=0.1):
            super(LSTMPINNModel, self).__init__()
            self.state_dim = state_dim
            self.action_dim = action_dim
            input_dim = state_dim + action_dim
            self.lstm = nn.LSTM(
                input_dim, hidden_dim, num_layers,
                batch_first=True, dropout=dropout if num_layers > 1 else 0
            )
            self.fc = nn.Linear(hidden_dim, state_dim)

        def forward(self, state, action, hidden=None):
            if state.dim() == 2:
                state = state.unsqueeze(1)
                action = action.unsqueeze(1)
            x = torch.cat([state, action], dim=2)
            lstm_out, hidden = self.lstm(x, hidden)
            next_state_pred = self.fc(lstm_out[:, -1, :])
            return next_state_pred, hidden
else:
    PINNModel = NumPyPINNModel
    LSTMPINNModel = None



