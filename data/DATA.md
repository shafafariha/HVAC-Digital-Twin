# HVAC dataset

Short reference for the data used to train the PINN/RL pipeline.

## Folder layout

| Folder      | Purpose |
|------------|---------|
| `raw/`     | Original sensor or log files (place your CSVs here before processing). |
| `processed/` | Ready-to-use training data. Default path: `train_data.csv`. |

## Training CSV format

The pipeline expects **one CSV** with columns in this order (names must match):

### State (current, 6 columns)

| Column      | Description              | Unit / range   |
|------------|--------------------------|----------------|
| `T_in`     | Indoor temperature       | °C             |
| `H_in`     | Indoor humidity          | %              |
| `P_last`   | Previous power draw      | W              |
| `T_out`    | Outdoor temperature      | °C             |
| `H_out`    | Outdoor humidity         | %              |
| `Occupancy`| Number of occupants      | count          |

### Action (4 columns)

| Column   | Description   | Values                    |
|----------|----------------|---------------------------|
| `Source` | AC on/off      | 0 = OFF, 1 = ON           |
| `Mode`   | Operating mode | 1 = Cooling, 2 = Heating, 3 = Auto |
| `Fan`    | Fan speed      | 0–6                       |
| `Temp`   | Setpoint       | 18–30 (°C)                |

### Next state (6 columns)

| Column           | Description              |
|------------------|--------------------------|
| `T_in_next`      | Indoor temp at next step |
| `H_in_next`      | Indoor humidity next     |
| `P_next`         | Power at next step       |
| `T_out_next`     | Outdoor temp next        |
| `H_out_next`     | Outdoor humidity next    |
| `Occupancy_next` | Occupancy next           |

Each **row** is one transition: `(state, action) → next_state` at a fixed time step (e.g. 60 s).

## Example row

```text
T_in,H_in,P_last,T_out,H_out,Occupancy,Source,Mode,Fan,Temp,T_in_next,H_in_next,P_next,...
23.75,59.01,0.0,29.64,67.96,6,1,3,6,28,23.83,59.10,1734.2,...
```

## Generating sample data

To create synthetic data with the same columns and thermal dynamics:

```bash
python generate_sample_data.py
```

This writes `data/processed/train_data.csv` (default 5000 samples). You can edit the script to change `num_samples` or the dynamics.

## Usage in code

- **Path**: Use `data/processed/train_data.csv` or pass `--data <path>` to `1_train_pinn.py`.
- **Loading**: `src.utils.data_loader.load_csv_data(filepath)` returns `(states, actions, next_states)` as NumPy arrays; column names above are the defaults.
