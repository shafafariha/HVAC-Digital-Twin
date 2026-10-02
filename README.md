# Deep-RL HVAC Control with PINN-Based Digital Twin

> A Physics-Informed Neural Network (PINN) digital twin for HVAC control, trained end-to-end with a Deep Q-Network (DQN) agent.

---

## Table of Contents

- [Overview](#overview)
- [Mathematical Framework](#mathematical-framework)
- [Repository Structure](#repository-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Model Architecture](#model-architecture)
- [Comparing Environment Backends](#comparing-environment-backends)
- [Key Features](#key-features)
- [Outputs](#outputs)
- [Notes](#notes)
- [License](#license)

---

## Overview

This project implements a two-stage training pipeline for intelligent HVAC control:

1. **World Model** — Train a PINN or vanilla NN to simulate HVAC thermodynamics as a digital twin.
2. **RL Agent** — Train a DQN agent inside one of three environment backends powered by the world model.

### Environment Backends

| Backend | Description |
|---|---|
| `pinn` | Physics-Informed Neural Network — trained with data loss + physics residual |
| `vanilla_nn` | Standard neural network — trained with data loss only, no physics constraint |
| `rc` | Purely analytical RC (Resistance-Capacitance) thermal model — no training required |

---

## Mathematical Framework

### State Space

$$S_t = [T_{in},\ H_{in},\ P_{last},\ T_{out},\ H_{out},\ \text{Occupancy}]$$

| Variable | Description |
|---|---|
| $T_{in}$, $H_{in}$ | Indoor temperature (°C) and relative humidity (%) |
| $P_{last}$ | Power consumption at the previous timestep |
| $T_{out}$, $H_{out}$ | Outdoor temperature and humidity (disturbance inputs) |
| $\text{Occupancy}$ | Number of occupants (or binary presence indicator) |

### Action Space

Discrete actions formed by flattening all combinations of four control variables:

| Variable | Options | Count |
|---|---|---|
| Source | {ON, OFF} | 2 |
| Mode | {1, 2, 3} | 3 |
| Fan Speed | {0, 1, 2, 3, 4, 5, 6} | 7 |
| Set Temperature | {18, 19, …, 30} °C | 13 |

**Total action space**: 2 × 3 × 7 × 13 = **546 discrete actions**

### Reward Function

$$R = w_1 \cdot R_{\text{comfort}} + w_2 \cdot R_{\text{energy}}$$

**Comfort reward** — penalizes deviation from the target comfort band $[23,\ 27]$°C:

$$R_{\text{comfort}} = \begin{cases} +1 & \text{if } 23 \le T_{in} \le 27 \\ -|T_{in} - 25| & \text{otherwise} \end{cases}$$

**Energy reward** — minimizes normalized power consumption:

$$R_{\text{energy}} = -P_{\text{norm}}, \quad P_{\text{norm}} \in [0, 1]$$

### PINN Physics Constraint

The PINN predicts $S_{t+1}$ from $(S_t, A_t)$ while satisfying the heat balance equation:

$$\frac{dT_{in}}{dt} = \frac{1}{C_{air}} \left[ Q_{ac}(A_t) + Q_{load} + H_{wall}(T_{out} - T_{in}) \right]$$

| Term | Description |
|---|---|
| $Q_{ac}$ | Cooling/heating capacity (action-dependent) |
| $Q_{load}$ | Internal heat gains (occupants, equipment) |
| $H_{wall}$ | Envelope heat transfer coefficient |

**Combined loss**:

$$\mathcal{L} = \mathcal{L}_{\text{MSE}} + \lambda \cdot \mathcal{L}_{\text{physics}}$$

---

## Repository Structure

```
PINN-RL/
│
├── data/
│   ├── raw/                      # Original CSV sensor logs
│   └── processed/                # Normalized tensors for training
│
├── src/
│   ├── env/
│   │   ├── __init__.py
│   │   ├── physics_loss.py       # Thermodynamic residual (PINN loss)
│   │   ├── rc_model.py           # Analytical RC thermal model
│   │   ├── simulator.py          # Gym-compatible env (pinn / vanilla_nn / rc)
│   │   └── pinn_model.py         # MLP/LSTM world model
│   │
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── dqn.py                # Deep Q-Network agent
│   │   └── replay_buffer.py      # Experience replay buffer
│   │
│   └── utils/
│       ├── __init__.py
│       ├── reward.py             # Comfort and energy reward calculations
│       └── data_loader.py        # CSV parsing and dataset utilities
│
├── configs/
│   ├── pinn_config.yaml          # PINN hyperparameters (physics_lambda > 0)
│   ├── vanilla_nn_config.yaml    # Vanilla NN config (physics_lambda = 0)
│   └── rl_config.yaml            # DQN hyperparameters
│
├── models/                       # Saved checkpoints (generated during training)
│
├── 1_train_pinn.py               # Stage 1: Train the world model
├── 2_train_rl.py                 # Stage 2: Train the DQN agent
├── compare_envs.sh               # Shell script for backend comparison
├── compare_envs.py               # Python comparison runner
├── requirements.txt
└── README.md
```

---

## Installation

1. Navigate to the project directory:
   ```bash
   cd "HVAC Control/PINN-RL"
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## Usage

### Step 1 — Prepare Your Dataset

Provide a CSV file with the following columns:

| Column Group | Columns |
|---|---|
| State ($S_t$) | `T_in`, `H_in`, `P_last`, `T_out`, `H_out`, `Occupancy` |
| Action ($A_t$) | `Source`, `Mode`, `Fan`, `Temp` |
| Next State ($S_{t+1}$) | `T_in_next`, `H_in_next`, `P_next`, `T_out_next`, `H_out_next`, `Occupancy_next` |

Place the file at `data/processed/train_data.csv` or pass a custom path via `--data`.

---

### Step 2 — Train the World Model

**PINN** (physics-informed):
```bash
python 1_train_pinn.py \
    --data    data/processed/train_data.csv \
    --config  configs/pinn_config.yaml \
    --model   models/pinn_model.pth \
    --device  cuda
```

**Vanilla NN** (data-only, no physics loss):
```bash
python 1_train_pinn.py \
    --config configs/vanilla_nn_config.yaml \
    --model  models/vanilla_model.pth
```

**Key configuration parameters** (`configs/pinn_config.yaml`):

| Parameter | Default | Description |
|---|---|---|
| `physics_lambda` | `0.1` | Physics loss weight (set to `0` for vanilla NN) |
| `num_epochs` | `100` | Number of training epochs |
| `learning_rate` | `0.001` | Optimizer learning rate |
| `delta_t` | `60.0` | Simulation timestep (seconds) |

---

### Step 3 — Train the RL Agent

**PINN backend** (default):
```bash
python 2_train_rl.py \
    --backend    pinn \
    --pinn_model models/pinn_model.pth \
    --config     configs/rl_config.yaml \
    --agent      models/dqn_agent.pth \
    --episodes   1000 \
    --max_steps  100
```

**Vanilla NN backend**:
```bash
python 2_train_rl.py \
    --backend    vanilla_nn \
    --pinn_model models/vanilla_model.pth \
    --config     configs/rl_config.yaml \
    --agent      models/dqn_agent.pth
```

**RC (analytical) backend** — no checkpoint required:
```bash
python 2_train_rl.py \
    --backend rc \
    --config  configs/rl_config.yaml \
    --agent   models/dqn_agent.pth
```

**Key configuration parameters** (`configs/rl_config.yaml`):

| Parameter | Default | Description |
|---|---|---|
| `w_comfort` | `0.7` | Comfort reward weight |
| `w_energy` | `0.3` | Energy reward weight |
| `target_temp` | `25.0` | Target indoor temperature (°C) |
| `tolerance` | `2.0` | Comfort band half-width (°C) |
| `gamma` | `0.99` | Discount factor |
| `epsilon` | `1.0` | Initial exploration rate |

---

## Configuration

| File | Purpose |
|---|---|
| `configs/pinn_config.yaml` | Model architecture, training hyperparameters, physics loss weight, timestep |
| `configs/vanilla_nn_config.yaml` | Same as above with `physics_lambda: 0` |
| `configs/rl_config.yaml` | DQN hyperparameters, reward weights, temperature targets, episode settings |

---

## Model Architecture

### World Model (PINN / Vanilla NN)

| Property | Value |
|---|---|
| Input | State (6D) + Action (4D) = 10D |
| Hidden layers | MLP `[128, 128, 64]` |
| Output | Next state (6D) |
| Loss | ℒ<sub>MSE</sub> + λ · ℒ<sub>physics</sub> |

$$\mathcal{L} = \mathcal{L}_{\text{MSE}} + \lambda \cdot \mathcal{L}_{\text{physics}}$$

### DQN Agent

| Property | Value |
|---|---|
| Input | State (6D) |
| Hidden layers | MLP `[128, 128, 64]` |
| Output | Q-values over 546 discrete actions |
| Features | Experience replay, target network, ε-greedy exploration |

---

## Comparing Environment Backends

Use the provided shell script to benchmark and compare all three backends:

```bash
# Compare using existing trained agents
./compare_envs.sh

# Train one agent per backend (short runs), then compare
./compare_envs.sh --train

# Also retrain the vanilla NN world model if missing, then train agents and compare
./compare_envs.sh --train-all
```

**Expected agent checkpoints**: `models/dqn_agent_pinn.pth`, `models/dqn_agent_vanilla_nn.pth`, `models/dqn_agent_rc.pth`.
If any are missing, `models/dqn_agent.pth` is used as a fallback for all backends.

**Environment variable overrides**: `EPISODES`, `MAX_STEPS`, `TEST_EPISODES`, `TEST_STEPS`, `DEVICE`, `MODELS_DIR`.

Results are printed to the console and optionally written to `models/env_comparison.csv`.

---

## Key Features

- **Physics-Informed Learning** — PINN is constrained by the room heat balance ODE, improving generalization beyond the training distribution.
- **Modular Architecture** — The world model and RL controller are fully decoupled; any backend can be swapped without modifying the agent.
- **Combinatorial Action Space** — Handles 546 discrete HVAC control combinations via a flat DQN output head.
- **Comfort–Energy Trade-off** — Weighted reward function balances thermal comfort and energy efficiency.
- **Stable DQN Training** — Experience replay buffer and periodic target-network updates reduce training variance.

---

## Outputs

| File | Description |
|---|---|
| `models/pinn_model.pth` | Trained PINN world model checkpoint |
| `models/dqn_agent.pth` | Trained DQN agent checkpoint |
| `models/training_curves.png` | Training loss and reward visualization |
| `models/env_comparison.csv` | Backend comparison metrics (optional) |

---

## Notes

- The world model is **frozen** during RL training (`.eval()` mode, no gradient updates).
- Action masking for invalid combinations (e.g., `Source=OFF` with `Mode≠0`) can be layered on top of the existing action space.
- Physical parameters ($C_{air}$, $R_{wall}$, COP) can be made learnable for system identification.
- All states are normalized to $[0, 1]$ before being passed to the neural network.

---

## License

See [LICENSE](LICENSE) for details.
