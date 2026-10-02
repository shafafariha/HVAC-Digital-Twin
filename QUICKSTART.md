# Quick Start Guide

## Running the Web Application (Digital Twin & AI Dashboard)

### 1. Start FastAPI Backend (Port 8000)
Run in project root (`PINN-RL-master`):
```bash
# Using project virtualenv
..\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```
Swagger API docs will be accessible at: `http://localhost:8000/docs`

### 2. Start Next.js Frontend (Port 3000)
Run in a second terminal inside `frontend/`:
```bash
cd frontend
npm run dev
```
Open your browser at: `http://localhost:3000`

---

## Prerequisites (Model Training)

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Prepare your data CSV file with columns:
   - State: `T_in`, `H_in`, `P_last`, `T_out`, `H_out`, `Occupancy`
   - Action: `Source`, `Mode`, `Fan`, `Temp`
   - Next State: `T_in_next`, `H_in_next`, `P_next`, `T_out_next`, `H_out_next`, `Occupancy_next`

## Training Pipeline

### Step 1: Train PINN
```bash
python 1_train_pinn.py \
    --data data/processed/train_data.csv \
    --config configs/pinn_config.yaml \
    --model models/pinn_model.pth
```

### Step 2: Train RL Agent
```bash
python 2_train_rl.py \
    --pinn_model models/pinn_model.pth \
    --config configs/rl_config.yaml \
    --agent models/dqn_agent.pth \
    --episodes 1000
```

### Step 3: Test Agent
```bash
python 3_test_agent.py \
    --pinn_model models/pinn_model.pth \
    --agent models/dqn_agent.pth \
    --episodes 5
```

## Expected Outputs

- `models/pinn_model.pth`: Trained PINN simulator
- `models/dqn_agent.pth`: Trained DQN agent  
- `models/training_curves.png`: Training metrics
- `models/test_results.png`: Test episode results

## Key Configuration Parameters

### PINN (`configs/pinn_config.yaml`)
- `physics_lambda`: Weight for physics constraint (higher = more physics enforcement)
- `num_epochs`: Training epochs
- `delta_t`: Time step in seconds

### RL (`configs/rl_config.yaml`)
- `w_comfort`: Weight for comfort reward (default: 0.7)
- `w_energy`: Weight for energy reward (default: 0.3)
- `target_temp`: Target temperature (default: 25.0°C)
- `tolerance`: Temperature tolerance (default: ±2.0°C)

## Troubleshooting
1. **Out of memory**: Reduce `batch_size` in config files
2. **Poor PINN predictions**: Increase `physics_lambda` or train for more epochs
3. **Agent not learning**: Check reward function, adjust `w_comfort` and `w_energy`
4. **Temperature not in range**: Verify target_temp and tolerance settings