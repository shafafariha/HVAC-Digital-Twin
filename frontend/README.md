# HVAC Digital Twin — Next.js Frontend

Professional real-time monitoring and control dashboard for the HVAC Deep-RL & Physics-Informed Neural Network (PINN) Digital Twin.

## Prerequisites

- **Node.js**: v18.17+ or v20+ LTS ([Download Node.js](https://nodejs.org/) or install via `winget install OpenJS.NodeJS.LTS`).
- **FastAPI Backend**: Running on `http://127.0.0.1:8000`.

## Quick Start

### 1. Start the FastAPI Backend
From the root of `PINN-RL-master`:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```
API Documentation will be accessible at: `http://127.0.0.1:8000/docs`

### 2. Install Frontend Dependencies & Start Next.js
From this directory (`PINN-RL-master/frontend`):
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Live Digital Twin Telemetry**: Real-time indoor temperature ($T_{in}$), relative humidity ($H_{in}$), electrical power draw ($P$), outdoor weather disturbance ($T_{out}, H_{out}$), and building occupancy.
- **Dual Control Strategies**:
  - **DQN Autonomous AI**: Evaluates 546 discrete action combinations and predicts the optimal control policy with estimated Q-values and Explainable AI (XAI) breakdown.
  - **Manual Engineer Dispatch**: Full manual control over AC power unit, operating mode (Cool/Heat/Fan), fan speed levels (0–6), and temperature setpoint ($18–30^\circ\text{C}$).
- **Digital Twin World Model Switcher**: Seamlessly switch between the **PINN Digital Twin** (Physics-Informed Neural Network) and the analytical **RC Model**.
- **Interactive Disturbance Injection**: Live sliders for outdoor temperature and occupant load.
- **Thermal Envelope & Power Dynamics**: Responsive SVG time-series charts visualizing temperature trajectory within the comfort envelope ($23–27^\circ\text{C}$) and electrical load over time.
- **Multi-Model Benchmarks**: Visualizes empirical comparison data between PINN, Baseline Vanilla NN, and RC models from `models/env_comparison.csv`.
