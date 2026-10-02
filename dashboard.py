import streamlit as st
import pandas as pd
import numpy as np
import torch
from pathlib import Path

from src.env.simulator import HVACSimulator
from src.env.pinn_model import PINNModel
from src.agent.dqn import DQNAgent

st.set_page_config(
    page_title="HVAC Digital Twin",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
        .stApp {
            background-color: #ffffff;
        }

        [data-testid="stHeader"] {
            background-color: #ffffff;
        }

        [data-testid="stSidebar"] {
            background-color: #ffffff;
            border-right: 1px solid #e5e7eb;
        }

        .block-container {
            padding-top: 2rem;
            padding-bottom: 2rem;
            max-width: 1500px;
        }

        h1 {
            font-weight: 600;
            letter-spacing: -0.5px;
        }

        h2, h3 {
            font-weight: 500;
        }

        [data-testid="stMetric"] {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
        }

        .info-box {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px;
            background-color: #ffffff;
            margin-bottom: 12px;
        }

        .small-text {
            color: #6b7280;
            font-size: 0.85rem;
        }
    </style>
    """,
    unsafe_allow_html=True,
)

ROOT = Path(__file__).resolve().parent

MODELS_DIR = ROOT / "models"

PINN_PATH = MODELS_DIR / "pinn_model.pth"
DQN_PATH = MODELS_DIR / "dqn_agent.pth"

VANILLA_PATHS = [
    MODELS_DIR / "vanilla_nn_model.pth",
    MODELS_DIR / "vanilla_model.pth",
    MODELS_DIR / "nn_model.pth",
]

def find_vanilla_model():
    for path in VANILLA_PATHS:
        if path.exists():
            return path
    return None

@st.cache_resource
def load_pinn_model():

    if not PINN_PATH.exists():
        raise FileNotFoundError(
            f"PINN model was not found:\n{PINN_PATH}"
        )

    checkpoint = torch.load(
        PINN_PATH,
        map_location="cpu",
        weights_only=False,
    )

    state_dim = checkpoint.get("state_dim", 6)
    action_dim = checkpoint.get("action_dim", 4)

    config = checkpoint.get("config", {})

    hidden_dims = config.get(
        "hidden_dims",
        [128, 128, 64]
    )

    model = PINNModel(
        state_dim=state_dim,
        action_dim=action_dim,
        hidden_dims=hidden_dims,
    )

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.eval()

    return {
        "model": model,
        "state_dim": state_dim,
        "action_dim": action_dim,
        "state_bounds": checkpoint.get("state_bounds"),
        "action_bounds": checkpoint.get("action_bounds"),
        "config": config,
    }

@st.cache_resource
def load_vanilla_model():

    path = find_vanilla_model()

    if path is None:
        return None

    checkpoint = torch.load(
        path,
        map_location="cpu",
        weights_only=False,
    )

    state_dim = checkpoint.get("state_dim", 6)
    action_dim = checkpoint.get("action_dim", 4)

    config = checkpoint.get("config", {})

    hidden_dims = config.get(
        "hidden_dims",
        [128, 128, 64]
    )

    model = PINNModel(
        state_dim=state_dim,
        action_dim=action_dim,
        hidden_dims=hidden_dims,
    )

    state_dict = checkpoint.get(
        "model_state_dict"
    )

    if state_dict is None:
        state_dict = checkpoint.get(
            "state_dict"
        )

    if state_dict is None:
        return None

    model.load_state_dict(
        state_dict
    )

    model.eval()

    return {
        "model": model,
        "state_dim": state_dim,
        "action_dim": action_dim,
        "state_bounds": checkpoint.get("state_bounds"),
        "action_bounds": checkpoint.get("action_bounds"),
        "config": config,
        "path": path,
    }

@st.cache_resource
def load_dqn():

    if not DQN_PATH.exists():
        raise FileNotFoundError(
            f"DQN model was not found:\n{DQN_PATH}"
        )

    checkpoint = torch.load(
        DQN_PATH,
        map_location="cpu",
        weights_only=False,
    )

    q_network_state = checkpoint["q_network"]

    weight_shapes = []

    for key, value in q_network_state.items():

        if (
            key.endswith(".weight")
            and hasattr(value, "shape")
            and len(value.shape) == 2
        ):
            weight_shapes.append(
                (key, value.shape)
            )

    weight_shapes.sort(
        key=lambda x: x[0]
    )

    if len(weight_shapes) >= 2:

        hidden_dims = [
            int(shape[0])
            for _, shape in weight_shapes[:-1]
        ]

        action_dim = int(
            weight_shapes[-1][1][0]
        )

    else:

        hidden_dims = [128, 128, 64]
        action_dim = 546

    agent = DQNAgent(
        state_dim=6,
        action_dim=action_dim,
        hidden_dims=hidden_dims,
        device="cpu",
    )

    agent.q_network.load_state_dict(
        checkpoint["q_network"]
    )

    agent.target_network.load_state_dict(
        checkpoint["target_network"]
    )

    agent.epsilon = checkpoint.get(
        "epsilon",
        0.0
    )

    agent.q_network.eval()
    agent.target_network.eval()

    return agent

def create_environment(backend):

    pinn_info = load_pinn_model()

    if backend == "PINN":

        return HVACSimulator(
            backend="pinn",
            pinn_model=pinn_info["model"],
            state_dim=pinn_info["state_dim"],
            action_dim=pinn_info["action_dim"],
            device="cpu",
            normalize=True,
            state_bounds=pinn_info["state_bounds"],
            action_bounds=pinn_info["action_bounds"],
            rc_delta_t=60.0,
        )

    if backend == "RC":

        return HVACSimulator(
            backend="rc",
            pinn_model=None,
            state_dim=6,
            action_dim=4,
            device="cpu",
            normalize=True,
            state_bounds=pinn_info["state_bounds"],
            action_bounds=pinn_info["action_bounds"],
            rc_delta_t=60.0,
        )

    if backend == "Vanilla NN":

        vanilla_info = load_vanilla_model()

        if vanilla_info is None:

            raise FileNotFoundError(
                "Vanilla NN checkpoint was not found."
            )

        return HVACSimulator(
            backend="vanilla_nn",
            pinn_model=vanilla_info["model"],
            state_dim=vanilla_info["state_dim"],
            action_dim=vanilla_info["action_dim"],
            device="cpu",
            normalize=True,
            state_bounds=vanilla_info["state_bounds"],
            action_bounds=vanilla_info["action_bounds"],
            rc_delta_t=60.0,
        )

    raise ValueError(
        f"Unknown backend: {backend}"
    )

def encode_action(
    source,
    mode,
    fan,
    temperature,
):

    source_idx = int(source)

    mode_idx = int(mode) - 1

    fan_idx = int(fan)

    temp_idx = int(temperature) - 18

    action_idx = (
        (
            (
                source_idx * 3
            )
            + mode_idx
        )
        * 7
        + fan_idx
    ) * 13 + temp_idx

    return int(action_idx)

def decode_action(
    environment,
    action_index,
):

    values = environment.decode_action(
        int(action_index)
    )

    return {
        "Source": int(values[0]),
        "Mode": int(values[1]),
        "Fan": int(values[2]),
        "Temperature": int(values[3]),
    }

def comfort_status(
    temperature,
    humidity,
):

    temperature_ok = (
        22.0 <= temperature <= 26.0
    )

    humidity_ok = (
        40.0 <= humidity <= 60.0
    )

    if temperature_ok and humidity_ok:
        return "Comfortable"

    if temperature > 26:
        return "Too warm"

    if temperature < 22:
        return "Too cool"

    if humidity > 60:
        return "Humidity high"

    if humidity < 40:
        return "Humidity low"

    return "Outside comfort band"

def build_initial_state(
    indoor_temperature,
    indoor_humidity,
    outdoor_temperature,
    outdoor_humidity,
    occupancy,
):

    return np.array(
        [
            float(indoor_temperature),
            float(indoor_humidity),
            0.0,
            float(outdoor_temperature),
            float(outdoor_humidity),
            float(occupancy),
        ],
        dtype=np.float64,
    )

def reset_simulation(
    backend,
    initial_state,
):

    environment = create_environment(
        backend
    )

    state = environment.reset(
        initial_state=initial_state
    )

    history = [
        {
            "Step": 0,
            "Time (min)": 0,
            "Indoor Temperature (C)": float(
                initial_state[0]
            ),
            "Indoor Humidity (%)": float(
                initial_state[1]
            ),
            "Outdoor Temperature (C)": float(
                initial_state[3]
            ),
            "Outdoor Humidity (%)": float(
                initial_state[4]
            ),
            "Occupancy": float(
                initial_state[5]
            ),
            "Power (W)": 0.0,
            "Energy (Wh)": 0.0,
            "Comfort": comfort_status(
                initial_state[0],
                initial_state[1],
            ),
            "Action Index": None,
            "Source": None,
            "Mode": None,
            "Fan": None,
            "Set Temperature (C)": None,
        }
    ]

    return (
        environment,
        state,
        history,
    )

def execute_step(
    environment,
    state,
    action_index,
    history,
):

    (
        next_state,
        power,
        done,
        info,
    ) = environment.step(
        state,
        int(action_index),
    )

    physical_state = (
        environment.denormalize_state(
            next_state
        )
    )

    action = decode_action(
        environment,
        action_index,
    )

    previous_energy = float(
        history[-1]["Energy (Wh)"]
    )

    energy = (
        previous_energy
        + float(power) * 60.0 / 3600.0
    )

    row = {
        "Step": len(history),
        "Time (min)": len(history),
        "Indoor Temperature (C)": float(
            physical_state[0]
        ),
        "Indoor Humidity (%)": float(
            physical_state[1]
        ),
        "Outdoor Temperature (C)": float(
            physical_state[3]
        ),
        "Outdoor Humidity (%)": float(
            physical_state[4]
        ),
        "Occupancy": float(
            physical_state[5]
        ),
        "Power (W)": float(power),
        "Energy (Wh)": float(energy),
        "Comfort": comfort_status(
            physical_state[0],
            physical_state[1],
        ),
        "Action Index": int(
            action_index
        ),
        "Source": (
            "ON"
            if action["Source"] == 1
            else "OFF"
        ),
        "Mode": action["Mode"],
        "Fan": action["Fan"],
        "Set Temperature (C)": action[
            "Temperature"
        ],
    }

    history.append(row)

    return (
        next_state,
        history,
        done,
        info,
    )

def get_top_actions(
    agent,
    state,
    environment,
    top_k=10,
):

    state_tensor = torch.FloatTensor(
        state
    ).unsqueeze(0)

    with torch.no_grad():

        q_values = (
            agent.q_network(
                state_tensor
            )
            .squeeze(0)
            .cpu()
            .numpy()
        )

    indices = np.argsort(
        q_values
    )[::-1][:top_k]

    rows = []

    for rank, index in enumerate(
        indices,
        start=1,
    ):

        action = decode_action(
            environment,
            int(index),
        )

        rows.append(
            {
                "Rank": rank,
                "Action Index": int(index),
                "Source": (
                    "ON"
                    if action["Source"] == 1
                    else "OFF"
                ),
                "Mode": action["Mode"],
                "Fan": action["Fan"],
                "Set Temperature (C)": action[
                    "Temperature"
                ],
                "Q Value": float(
                    q_values[index]
                ),
            }
        )

    return pd.DataFrame(rows)

if "environment" not in st.session_state:
    st.session_state.environment = None

if "state" not in st.session_state:
    st.session_state.state = None

if "history" not in st.session_state:
    st.session_state.history = []

if "backend" not in st.session_state:
    st.session_state.backend = "PINN"

if "last_action" not in st.session_state:
    st.session_state.last_action = None

with st.sidebar:

    st.header("Simulation Settings")

    vanilla_available = (
        find_vanilla_model()
        is not None
    )

    available_backends = [
        "PINN",
        "RC",
    ]

    if vanilla_available:
        available_backends.append(
            "Vanilla NN"
        )

    selected_backend = st.selectbox(
        "World Model",
        available_backends,
        index=(
            available_backends.index(
                st.session_state.backend
            )
            if st.session_state.backend
            in available_backends
            else 0
        ),
    )

    if (
        selected_backend
        != st.session_state.backend
    ):

        st.session_state.backend = (
            selected_backend
        )

        st.session_state.environment = None
        st.session_state.state = None
        st.session_state.history = []
        st.session_state.last_action = None

    st.divider()

    st.subheader("Initial Conditions")

    indoor_temperature = st.number_input(
        "Indoor Temperature (C)",
        min_value=18.0,
        max_value=35.0,
        value=26.0,
        step=0.5,
    )

    indoor_humidity = st.number_input(
        "Indoor Humidity (%)",
        min_value=20.0,
        max_value=90.0,
        value=55.0,
        step=1.0,
    )

    outdoor_temperature = st.number_input(
        "Outdoor Temperature (C)",
        min_value=10.0,
        max_value=45.0,
        value=32.0,
        step=0.5,
    )

    outdoor_humidity = st.number_input(
        "Outdoor Humidity (%)",
        min_value=20.0,
        max_value=100.0,
        value=70.0,
        step=1.0,
    )

    occupancy = st.number_input(
        "Occupancy",
        min_value=0,
        max_value=50,
        value=5,
        step=1,
    )

    st.divider()

    st.subheader("Controller")

    controller = st.radio(
        "Control Mode",
        [
            "DQN",
            "Manual",
        ],
    )

    if controller == "Manual":

        manual_source = st.selectbox(
            "Source",
            [0, 1],
            format_func=lambda x:
                "OFF"
                if x == 0
                else "ON",
        )

        manual_mode = st.selectbox(
            "Mode",
            [1, 2, 3],
        )

        manual_fan = st.slider(
            "Fan",
            0,
            6,
            3,
        )

        manual_temperature = st.slider(
            "Set Temperature (C)",
            18,
            30,
            24,
        )

    st.divider()

    st.subheader("Simulation")

    steps = st.slider(
        "Steps per Run",
        min_value=1,
        max_value=100,
        value=20,
    )

    reset_button = st.button(
        "Reset Simulation",
        use_container_width=True,
    )

    run_button = st.button(
        "Run Simulation",
        use_container_width=True,
        type="primary",
    )

initial_state = build_initial_state(
    indoor_temperature,
    indoor_humidity,
    outdoor_temperature,
    outdoor_humidity,
    occupancy,
)

if (
    reset_button
    or st.session_state.environment
    is None
    or st.session_state.state is None
    or len(st.session_state.history) == 0
):

    try:

        (
            st.session_state.environment,
            st.session_state.state,
            st.session_state.history,
        ) = reset_simulation(
            st.session_state.backend,
            initial_state,
        )

        st.session_state.last_action = None

    except Exception as error:

        st.error(
            "Unable to initialize the simulation."
        )

        st.exception(error)

        st.stop()

if run_button:

    try:

        if controller == "DQN":

            agent = load_dqn()

        for _ in range(steps):

            if controller == "DQN":

                action_index = (
                    agent.select_action(
                        st.session_state.state,
                        training=False,
                    )
                )

            else:

                action_index = encode_action(
                    manual_source,
                    manual_mode,
                    manual_fan,
                    manual_temperature,
                )

            (
                st.session_state.state,
                st.session_state.history,
                done,
                info,
            ) = execute_step(
                st.session_state.environment,
                st.session_state.state,
                action_index,
                st.session_state.history,
            )

            st.session_state.last_action = (
                action_index
            )

            if done:
                break

    except Exception as error:

        st.error(
            "Simulation failed."
        )

        st.exception(error)

st.title(
    "HVAC AI Digital Twin and Intelligent Control"
)

st.write(
    "Interactive simulation using a world model and "
    "reinforcement-learning controller."
)

st.caption(
    f"World Model: {st.session_state.backend} | "
    f"Controller: {controller} | "
    f"Timestep: 60 seconds"
)

st.divider()

tab_simulation, tab_ai, tab_comparison, tab_training = st.tabs(
    [
        "Simulation",
        "AI Control",
        "Model Comparison",
        "Training Results",
    ]
)

with tab_simulation:

    history_df = pd.DataFrame(
        st.session_state.history
    )

    latest = history_df.iloc[-1]

    st.subheader(
        "Current System State"
    )

    col1, col2, col3 = st.columns(3)

    col1.metric(
        "Indoor Temperature",
        f"{latest['Indoor Temperature (C)']:.2f} C",
    )

    col2.metric(
        "Indoor Humidity",
        f"{latest['Indoor Humidity (%)']:.1f} %",
    )

    col3.metric(
        "Outdoor Temperature",
        f"{latest['Outdoor Temperature (C)']:.2f} C",
    )

    col4, col5, col6 = st.columns(3)

    col4.metric(
        "Occupancy",
        f"{latest['Occupancy']:.0f}",
    )

    col5.metric(
        "HVAC Power",
        f"{latest['Power (W)']:.2f} W",
    )

    col6.metric(
        "Energy",
        f"{latest['Energy (Wh)']:.2f} Wh",
    )

    st.write(
        f"Comfort Status: **{latest['Comfort']}**"
    )

    st.divider()

    st.subheader(
        "Indoor Temperature"
    )

    temperature_df = history_df[
        [
            "Time (min)",
            "Indoor Temperature (C)",
            "Set Temperature (C)",
        ]
    ].copy()

    temperature_df = (
        temperature_df
        .set_index("Time (min)")
    )

    st.line_chart(
        temperature_df,
        height=350,
    )

    st.subheader(
        "Indoor Humidity"
    )

    humidity_df = history_df[
        [
            "Time (min)",
            "Indoor Humidity (%)",
            "Outdoor Humidity (%)",
        ]
    ].copy()

    humidity_df = (
        humidity_df
        .set_index("Time (min)")
    )

    st.line_chart(
        humidity_df,
        height=300,
    )

    st.subheader(
        "HVAC Power Consumption"
    )

    power_df = history_df[
        [
            "Time (min)",
            "Power (W)",
        ]
    ].copy()

    power_df = (
        power_df
        .set_index("Time (min)")
    )

    st.line_chart(
        power_df,
        height=300,
    )

    st.subheader(
        "Simulation History"
    )

    display_columns = [
        "Step",
        "Time (min)",
        "Indoor Temperature (C)",
        "Indoor Humidity (%)",
        "Power (W)",
        "Energy (Wh)",
        "Comfort",
        "Action Index",
        "Source",
        "Mode",
        "Fan",
        "Set Temperature (C)",
    ]

    st.dataframe(
        history_df[
            display_columns
        ],
        use_container_width=True,
        hide_index=True,
    )

with tab_ai:

    st.subheader(
        "DQN HVAC Controller"
    )

    try:

        agent = load_dqn()

        current_state = (
            st.session_state.state
        )

        if (
            st.session_state.last_action
            is not None
        ):

            selected_action = decode_action(
                st.session_state.environment,
                st.session_state.last_action,
            )

            st.subheader(
                "Current AI Action"
            )

            a1, a2, a3, a4, a5 = st.columns(5)

            a1.metric(
                "Action Index",
                str(
                    st.session_state.last_action
                ),
            )

            a2.metric(
                "Source",
                (
                    "ON"
                    if selected_action["Source"]
                    == 1
                    else "OFF"
                ),
            )

            a3.metric(
                "Mode",
                str(
                    selected_action["Mode"]
                ),
            )

            a4.metric(
                "Fan",
                str(
                    selected_action["Fan"]
                ),
            )

            a5.metric(
                "Set Temperature",
                f"{selected_action['Temperature']} C",
            )

        st.subheader(
            "Top DQN Actions"
        )

        top_actions = get_top_actions(
            agent,
            current_state,
            st.session_state.environment,
            top_k=10,
        )

        st.dataframe(
            top_actions,
            use_container_width=True,
            hide_index=True,
        )

        st.subheader(
            "Current State Vector"
        )

        state_df = pd.DataFrame(
            {
                "Variable": [
                    "Indoor Temperature",
                    "Indoor Humidity",
                    "Previous Power",
                    "Outdoor Temperature",
                    "Outdoor Humidity",
                    "Occupancy",
                ],
                "Normalized Value": [
                    float(value)
                    for value in current_state
                ],
            }
        )

        st.dataframe(
            state_df,
            use_container_width=True,
            hide_index=True,
        )

        st.subheader(
            "Action Space"
        )

        st.write(
            "Source: 2 options | "
            "Mode: 3 options | "
            "Fan: 7 options | "
            "Temperature: 13 options"
        )

        st.write(
            "Total discrete actions: "
            "**546**"
        )

    except Exception as error:

        st.error(
            "Unable to load the DQN controller."
        )

        st.exception(error)

with tab_comparison:

    st.subheader(
        "World Model Comparison"
    )

    st.write(
        "The available world models can be evaluated "
        "under the same control-action sequence."
    )

    vanilla_path = find_vanilla_model()

    availability_df = pd.DataFrame(
        {
            "World Model": [
                "PINN",
                "RC",
                "Vanilla NN",
            ],
            "Model Type": [
                "Physics-informed neural network",
                "Physics-based thermal model",
                "Standard neural network",
            ],
            "Status": [
                (
                    "Available"
                    if PINN_PATH.exists()
                    else "Missing"
                ),
                "Available",
                (
                    "Available"
                    if vanilla_path
                    else "Not available"
                ),
            ],
        }
    )

    st.dataframe(
        availability_df,
        use_container_width=True,
        hide_index=True,
    )

    comparison_steps = st.slider(
        "Comparison Steps",
        min_value=5,
        max_value=100,
        value=30,
    )

    comparison_button = st.button(
        "Run Model Comparison"
    )

    if comparison_button:

        try:

            agent = load_dqn()

            comparison_models = [
                "PINN",
                "RC",
            ]

            if vanilla_path is not None:
                comparison_models.append(
                    "Vanilla NN"
                )

            result_frames = []

            for backend_name in comparison_models:

                environment = create_environment(
                    backend_name
                )

                state = environment.reset(
                    initial_state=initial_state
                )

                rows = []

                for step_number in range(
                    1,
                    comparison_steps + 1,
                ):

                    action_index = (
                        agent.select_action(
                            state,
                            training=False,
                        )
                    )

                    (
                        state,
                        power,
                        done,
                        info,
                    ) = environment.step(
                        state,
                        int(action_index),
                    )

                    physical_state = (
                        environment.denormalize_state(
                            state
                        )
                    )

                    rows.append(
                        {
                            "Step": step_number,
                            "World Model": backend_name,
                            "Indoor Temperature (C)": float(
                                physical_state[0]
                            ),
                            "Indoor Humidity (%)": float(
                                physical_state[1]
                            ),
                            "Power (W)": float(
                                power
                            ),
                        }
                    )

                    if done:
                        break

                result_frames.append(
                    pd.DataFrame(rows)
                )

            comparison_df = pd.concat(
                result_frames,
                ignore_index=True,
            )

            st.session_state.comparison_df = (
                comparison_df
            )

        except Exception as error:

            st.error(
                "Model comparison failed."
            )

            st.exception(error)

    if "comparison_df" in st.session_state:

        comparison_df = (
            st.session_state.comparison_df
        )

        st.subheader(
            "Indoor Temperature"
        )

        temperature_comparison = (
            comparison_df.pivot(
                index="Step",
                columns="World Model",
                values="Indoor Temperature (C)",
            )
        )

        st.line_chart(
            temperature_comparison,
            height=350,
        )

        st.subheader(
            "Indoor Humidity"
        )

        humidity_comparison = (
            comparison_df.pivot(
                index="Step",
                columns="World Model",
                values="Indoor Humidity (%)",
            )
        )

        st.line_chart(
            humidity_comparison,
            height=300,
        )

        st.subheader(
            "Power"
        )

        power_comparison = (
            comparison_df.pivot(
                index="Step",
                columns="World Model",
                values="Power (W)",
            )
        )

        st.line_chart(
            power_comparison,
            height=300,
        )

        st.subheader(
            "Comparison Data"
        )

        st.dataframe(
            comparison_df,
            use_container_width=True,
            hide_index=True,
        )

with tab_training:

    st.subheader(
        "Training and Evaluation Results"
    )

    training_curve_path = (
        MODELS_DIR
        / "training_curves.png"
    )

    test_result_path = (
        MODELS_DIR
        / "test_results.png"
    )

    environment_comparison_path = (
        MODELS_DIR
        / "env_comparison.png"
    )

    environment_comparison_csv = (
        MODELS_DIR
        / "env_comparison.csv"
    )

    if training_curve_path.exists():

        st.markdown(
            "### Training Curves"
        )

        st.image(
            str(training_curve_path),
            use_container_width=True,
        )

    if test_result_path.exists():

        st.markdown(
            "### DQN Test Results"
        )

        st.image(
            str(test_result_path),
            use_container_width=True,
        )

    if environment_comparison_path.exists():

        st.markdown(
            "### Environment Comparison"
        )

        st.image(
            str(environment_comparison_path),
            use_container_width=True,
        )

    if environment_comparison_csv.exists():

        st.markdown(
            "### Environment Comparison Data"
        )

        try:

            comparison_results = (
                pd.read_csv(
                    environment_comparison_csv
                )
            )

            st.dataframe(
                comparison_results,
                use_container_width=True,
                hide_index=True,
            )

        except Exception as error:

            st.error(
                "Unable to read environment comparison CSV."
            )

            st.exception(error)

    st.markdown(
        "### Model Files"
    )

    vanilla_file = find_vanilla_model()

    model_status = pd.DataFrame(
        {
            "Model": [
                "PINN",
                "DQN",
                "Vanilla NN",
            ],
            "File": [
                "models/pinn_model.pth",
                "models/dqn_agent.pth",
                (
                    str(
                        vanilla_file.relative_to(
                            ROOT
                        )
                    )
                    if vanilla_file
                    else "Not available"
                ),
            ],
            "Status": [
                (
                    "Available"
                    if PINN_PATH.exists()
                    else "Missing"
                ),
                (
                    "Available"
                    if DQN_PATH.exists()
                    else "Missing"
                ),
                (
                    "Available"
                    if vanilla_file
                    else "Not available"
                ),
            ],
        }
    )

    st.dataframe(
        model_status,
        use_container_width=True,
        hide_index=True,
    )

st.divider()

st.caption(
    "HVAC AI Digital Twin | "
    "PINN / RC world models | "
    "DQN intelligent controller"
)