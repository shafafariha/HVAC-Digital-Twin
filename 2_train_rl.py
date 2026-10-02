

import os
import argparse
from pathlib import Path
import random
import sys

import yaml
import torch
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.env.pinn_model import PINNModel
from src.env.simulator import HVACSimulator, BackendType
from src.agent.dqn import DQNAgent
from src.utils.reward import calculate_total_reward

def train_rl(
    backend: BackendType,
    config_path: str,
    agent_save_path: str = "models/dqn_agent.pth",
    pinn_model_path: str | None = None,
    device: str = "cpu",
    num_episodes: int = 1000,
    max_steps_per_episode: int = 100,
    rc_delta_t: float = 60.0,
    curves_data_path: str | None = None,
    no_plot: bool = False,
    eval_every: int = 10,
    eval_episodes: int = 5,
    seed: int | None = None,
):
    """Train DQN agent using HVAC simulator."""

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    if seed is not None:
        print(f"Using random seed: {seed}")

        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)

        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)

    os.makedirs(
        os.path.dirname(agent_save_path) or ".",
        exist_ok=True
    )

    state_dim = 6
    action_dim = 4

    pinn_model = None
    state_bounds = None
    action_bounds = None

    if backend in ("pinn", "vanilla_nn"):

        if not pinn_model_path:
            raise ValueError(
                f"pinn_model_path is required when backend={backend!r}"
            )

        print(
            f"Loading {backend} model from "
            f"{pinn_model_path}..."
        )

        checkpoint = torch.load(
            pinn_model_path,
            map_location=device,
            weights_only=False,
        )

        state_dim = checkpoint["state_dim"]
        action_dim = checkpoint["action_dim"]

        state_bounds = checkpoint.get(
            "state_bounds",
            None
        )

        action_bounds = checkpoint.get(
            "action_bounds",
            None
        )

        pinn_model = PINNModel(
            state_dim=state_dim,
            action_dim=action_dim,
            hidden_dims=checkpoint["config"].get(
                "hidden_dims",
                [128, 128, 64],
            ),
        ).to(device)

        pinn_model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        pinn_model.eval()

        print(
            f"{backend} model loaded successfully"
        )

    simulator = HVACSimulator(
        backend=backend,
        pinn_model=pinn_model,
        state_dim=state_dim,
        action_dim=action_dim,
        device=device,
        normalize=True,
        state_bounds=state_bounds,
        action_bounds=action_bounds,
        rc_delta_t=rc_delta_t,
    )

    action_space_size = simulator.get_action_space_size()

    print(
        f"Backend: {backend}, "
        f"Action space size: {action_space_size}"
    )

    agent = DQNAgent(
        state_dim=state_dim,
        action_dim=action_space_size,
        device=device,

        lr=config.get(
            "learning_rate",
            1e-3
        ),

        gamma=config.get(
            "gamma",
            0.99
        ),

        epsilon=config.get(
            "epsilon",
            1.0
        ),

        epsilon_min=config.get(
            "epsilon_min",
            0.01
        ),

        epsilon_decay=config.get(
            "epsilon_decay",
            0.995
        ),

        batch_size=config.get(
            "batch_size",
            64
        ),

        buffer_size=config.get(
            "buffer_size",
            10000
        ),

        target_update_freq=config.get(
            "target_update_freq",
            100
        ),

        hidden_dims=config.get(
            "hidden_dims",
            [128, 128, 64]
        ),
    )

    print("DQN agent initialized")

    w_comfort = config.get(
        "w_comfort",
        0.7
    )

    w_energy = config.get(
        "w_energy",
        0.3
    )

    target_temp = config.get(
        "target_temp",
        25.0
    )

    tolerance = config.get(
        "tolerance",
        2.0
    )
    episode_rewards = []
    episode_lengths = []
    episode_comfort_rewards = []
    episode_energy_rewards = []
    episode_temperatures = []
    episode_powers = []
    eval_means = []
    eval_stds = []
    eval_comfort = []

    best_eval_mean = -float("inf")

    print("\nStarting RL training...")
    def evaluate_greedy_policy():

        if eval_episodes <= 0:
            return 0.0, 0.0, 0.0

        previous_epsilon = agent.epsilon

        agent.epsilon = 0.0

        returns = []
        comfort_ratios = []

        for _ in range(eval_episodes):

            state = simulator.reset()

            episode_reward = 0.0
            temperatures = []

            for step in range(max_steps_per_episode):

                action = agent.select_action(
                    state,
                    training=False
                )

                next_state, power, done, info = simulator.step(
                    state,
                    action
                )

                temperature = info.get(
                    "temperature",
                    next_state[0]
                )

                total_reward, _, _ = calculate_total_reward(
                    temperature=temperature,
                    power=power,
                    w_comfort=w_comfort,
                    w_energy=w_energy,
                    target_temp=target_temp,
                    tolerance=tolerance,
                )

                episode_reward += total_reward

                temperatures.append(
                    temperature
                )

                state = next_state

                if done:
                    break

            returns.append(
                episode_reward
            )

            temperatures_array = np.array(
                temperatures
            )

            if len(temperatures_array) > 0:

                in_range = (
                    (temperatures_array >= target_temp - tolerance)
                    &
                    (temperatures_array <= target_temp + tolerance)
                )

                comfort_ratios.append(
                    float(np.mean(in_range))
                )

        agent.epsilon = previous_epsilon

        if not returns:
            return 0.0, 0.0, 0.0

        mean_return = float(
            np.mean(returns)
        )

        std_return = float(
            np.std(returns)
        )

        mean_comfort = (
            float(np.mean(comfort_ratios))
            if comfort_ratios
            else 0.0
        )

        return (
            mean_return,
            std_return,
            mean_comfort,
        )
    for episode in range(num_episodes):

        state = simulator.reset()

        episode_reward = 0.0
        episode_comfort = 0.0
        episode_energy = 0.0

        episode_temp = []
        episode_power = []

        for step in range(max_steps_per_episode):
            action = agent.select_action(
                state,
                training=True
            )
            next_state, power, done, info = simulator.step(
                state,
                action
            )
            temperature = info.get(
                "temperature",
                next_state[0]
            )
            total_reward, comfort_reward, energy_reward = (
                calculate_total_reward(
                    temperature=temperature,
                    power=power,
                    w_comfort=w_comfort,
                    w_energy=w_energy,
                    target_temp=target_temp,
                    tolerance=tolerance,
                )
            )
            agent.store(
                state,
                action,
                total_reward,
                next_state,
                done
            )
            agent.update_policy()
            episode_reward += total_reward
            episode_comfort += comfort_reward
            episode_energy += energy_reward

            episode_temp.append(
                float(temperature)
            )

            episode_power.append(
                float(power)
            )

            state = next_state

            if done:
                break
        episode_rewards.append(
            episode_reward
        )

        episode_lengths.append(
            step + 1
        )

        episode_comfort_rewards.append(
            episode_comfort / (step + 1)
        )

        episode_energy_rewards.append(
            episode_energy / (step + 1)
        )

        episode_temperatures.append(
            float(np.mean(episode_temp))
            if episode_temp
            else 0.0
        )

        episode_powers.append(
            float(np.mean(episode_power))
            if episode_power
            else 0.0
        )
        if (episode + 1) % 10 == 0:

            window_rewards = episode_rewards[-10:]
            window_temps = episode_temperatures[-10:]
            window_powers = episode_powers[-10:]

            avg_reward = float(
                np.mean(window_rewards)
            )

            avg_temp = float(
                np.mean(window_temps)
            )

            avg_power = float(
                np.mean(window_powers)
            )

            std_reward = float(
                np.std(window_rewards)
            )

            std_temp = float(
                np.std(window_temps)
            )

            buffer_size = len(
                agent.replay_buffer
            )

            print(
                f"Episode {episode + 1}/{num_episodes}: "
                f"Reward={avg_reward:.2f}±{std_reward:.2f}, "
                f"Temp={avg_temp:.2f}°C±{std_temp:.2f}, "
                f"Power={avg_power:.2f}W, "
                f"Epsilon={agent.epsilon:.3f}, "
                f"Buffer={buffer_size}"
            )
        if (
            eval_every > 0
            and (episode + 1) % eval_every == 0
        ):

            mean_return, std_return, mean_comfort = (
                evaluate_greedy_policy()
            )

            eval_means.append(
                mean_return
            )

            eval_stds.append(
                std_return
            )

            eval_comfort.append(
                mean_comfort
            )

            print(
                f"  Eval (greedy) after episode "
                f"{episode + 1}: "
                f"Return={mean_return:.2f}±{std_return:.2f}, "
                f"Comfort={mean_comfort * 100:.1f}%"
            )
            if mean_return > best_eval_mean:

                best_eval_mean = mean_return

                agent.save(
                    agent_save_path
                )

                print(
                    f"  ✓ Saved new best agent to "
                    f"{agent_save_path} "
                    f"(eval return {mean_return:.2f})"
                )
    if best_eval_mean == -float("inf"):

        agent.save(
            agent_save_path
        )

        print(
            "\nTraining completed! "
            "(no evals run) "
            f"Agent saved to {agent_save_path}"
        )

    else:

        print(
            "\nTraining completed! "
            f"Best eval return: {best_eval_mean:.2f}"
        )
    if curves_data_path:

        os.makedirs(
            os.path.dirname(curves_data_path) or ".",
            exist_ok=True
        )

        np.savez(
            curves_data_path,

            episode_rewards=np.array(
                episode_rewards,
                dtype=np.float32
            ),

            episode_lengths=np.array(
                episode_lengths,
                dtype=np.int32
            ),

            episode_temperatures=np.array(
                episode_temperatures,
                dtype=np.float32
            ),

            episode_powers=np.array(
                episode_powers,
                dtype=np.float32
            ),

            eval_means=np.array(
                eval_means,
                dtype=np.float32
            ),

            eval_stds=np.array(
                eval_stds,
                dtype=np.float32
            ),

            eval_comfort=np.array(
                eval_comfort,
                dtype=np.float32
            ),

            eval_every=int(eval_every),
            eval_episodes=int(eval_episodes),
            backend=backend,
        )

        print(
            f"Curves data saved to "
            f"{curves_data_path}"
        )
    if not no_plot:

        plot_training_curves(
            rewards=episode_rewards,
            lengths=episode_lengths,
            temperatures=episode_temperatures,
            powers=episode_powers,
            eval_rewards=eval_means,
            eval_interval=(
                eval_every
                if eval_every > 0
                else None
            ),
            save_path="models/training_curves.png",
        )
    return {
        "episode_rewards": episode_rewards,
        "eval_means": eval_means,
        "eval_stds": eval_stds,
        "eval_comfort": eval_comfort,
        "best_eval_mean": best_eval_mean,
    }

def plot_training_curves(
    rewards,
    lengths,
    temperatures,
    powers,
    eval_rewards=None,
    eval_interval=None,
    save_path="training_curves.png",
):
    """Plot training and evaluation curves."""

    fig, axes = plt.subplots(
        2,
        2,
        figsize=(12, 10)
    )

    window = 50

    def moving_average(
        data,
        window_,
    ):
        return np.convolve(
            data,
            np.ones(window_) / window_,
            mode="valid"
        )

    episodes = np.arange(
        len(rewards)
    )
    axes[0, 0].plot(
        episodes,
        rewards,
        alpha=0.3,
        label="Train (explore)"
    )

    if len(rewards) > window:

        axes[0, 0].plot(
            episodes[window - 1:],
            moving_average(
                rewards,
                window
            ),
            linewidth=2,
        )

    if (
        eval_rewards is not None
        and len(eval_rewards) > 0
        and eval_interval
    ):

        eval_x = (
            np.arange(
                len(eval_rewards)
            )
            * eval_interval
            + (eval_interval - 1)
        )

        axes[0, 0].plot(
            eval_x,
            eval_rewards,
            "o-",
            label="Eval (greedy)"
        )

    axes[0, 0].set_xlabel(
        "Episode"
    )

    axes[0, 0].set_ylabel(
        "Total Reward"
    )

    axes[0, 0].set_title(
        "Episode Rewards"
    )

    axes[0, 0].legend()
    axes[0, 0].grid(True)
    axes[0, 1].plot(
        episodes,
        lengths,
        alpha=0.3
    )

    if len(lengths) > window:

        axes[0, 1].plot(
            episodes[window - 1:],
            moving_average(
                lengths,
                window
            ),
            linewidth=2,
        )

    axes[0, 1].set_xlabel(
        "Episode"
    )

    axes[0, 1].set_ylabel(
        "Steps"
    )

    axes[0, 1].set_title(
        "Episode Lengths"
    )

    axes[0, 1].grid(True)
    axes[1, 0].plot(
        episodes,
        temperatures,
        alpha=0.3
    )

    if len(temperatures) > window:

        axes[1, 0].plot(
            episodes[window - 1:],
            moving_average(
                temperatures,
                window
            ),
            linewidth=2,
        )

    axes[1, 0].axhline(
        y=25,
        linestyle="--",
        label="Target (25°C)"
    )

    axes[1, 0].axhline(
        y=23,
        linestyle="--",
        alpha=0.5
    )

    axes[1, 0].axhline(
        y=27,
        linestyle="--",
        alpha=0.5
    )

    axes[1, 0].set_xlabel(
        "Episode"
    )

    axes[1, 0].set_ylabel(
        "Temperature (°C)"
    )

    axes[1, 0].set_title(
        "Average Indoor Temperature"
    )

    axes[1, 0].legend()
    axes[1, 0].grid(True)
    axes[1, 1].plot(
        episodes,
        powers,
        alpha=0.3
    )

    if len(powers) > window:

        axes[1, 1].plot(
            episodes[window - 1:],
            moving_average(
                powers,
                window
            ),
            linewidth=2,
        )

    axes[1, 1].set_xlabel(
        "Episode"
    )

    axes[1, 1].set_ylabel(
        "Power (W)"
    )

    axes[1, 1].set_title(
        "Average Power Consumption"
    )

    axes[1, 1].grid(True)

    plt.tight_layout()

    plt.savefig(
        save_path,
        dpi=150
    )

    plt.close()

    print(
        f"Training curves saved to "
        f"{save_path}"
    )

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Train DQN agent using HVAC simulator"
    )

    parser.add_argument(
        "--backend",
        type=str,
        default="pinn",
        choices=[
            "pinn",
            "vanilla_nn",
            "rc"
        ],
        help="Environment backend",
    )

    parser.add_argument(
        "--pinn_model",
        type=str,
        default="models/pinn_model.pth",
        help="Path to NN checkpoint",
    )

    parser.add_argument(
        "--config",
        type=str,
        default="configs/rl_config.yaml",
        help="Path to RL config YAML",
    )

    parser.add_argument(
        "--agent",
        type=str,
        default="models/dqn_agent.pth",
        help="Path to save trained agent",
    )

    parser.add_argument(
        "--device",
        type=str,
        default=(
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        ),
        help="Device to train on",
    )

    parser.add_argument(
        "--episodes",
        type=int,
        default=1000,
        help="Number of training episodes",
    )

    parser.add_argument(
        "--max_steps",
        type=int,
        default=100,
        help="Maximum steps per episode",
    )

    parser.add_argument(
        "--rc_delta_t",
        type=float,
        default=60.0,
        help="Time step for RC model",
    )

    parser.add_argument(
        "--curves_data",
        type=str,
        default=None,
        help="Save episode curves to .npz",
    )

    parser.add_argument(
        "--no_plot",
        action="store_true",
        help="Do not save training_curves.png",
    )

    parser.add_argument(
        "--eval_every",
        type=int,
        default=10,
        help="Evaluate greedy policy every N episodes",
    )

    parser.add_argument(
        "--eval_episodes",
        type=int,
        default=5,
        help="Number of greedy evaluation episodes",
    )

    parser.add_argument(
        "--seeds",
        type=int,
        default=1,
        help="Number of random seeds",
    )

    parser.add_argument(
        "--base_seed",
        type=int,
        default=0,
        help="Base random seed",
    )

    args = parser.parse_args()
    if args.seeds <= 1:

        train_rl(
            backend=args.backend,
            config_path=args.config,
            agent_save_path=args.agent,

            pinn_model_path=(
                args.pinn_model
                if args.backend
                in ("pinn", "vanilla_nn")
                else None
            ),

            device=args.device,

            num_episodes=args.episodes,

            max_steps_per_episode=args.max_steps,

            rc_delta_t=args.rc_delta_t,

            curves_data_path=args.curves_data,

            no_plot=args.no_plot,

            eval_every=args.eval_every,

            eval_episodes=args.eval_episodes,

            seed=args.base_seed,
        )
    else:

        best_eval_across_seeds = []

        for i in range(args.seeds):

            run_seed = args.base_seed + i

            print(
                f"\n==== Training seed "
                f"{run_seed} "
                f"({i + 1}/{args.seeds}) ===="
            )

            summary = train_rl(
                backend=args.backend,
                config_path=args.config,
                agent_save_path=args.agent,

                pinn_model_path=(
                    args.pinn_model
                    if args.backend
                    in ("pinn", "vanilla_nn")
                    else None
                ),

                device=args.device,

                num_episodes=args.episodes,

                max_steps_per_episode=args.max_steps,

                rc_delta_t=args.rc_delta_t,

                curves_data_path=None,

                no_plot=True,

                eval_every=args.eval_every,

                eval_episodes=args.eval_episodes,

                seed=run_seed,
            )

            if (
                summary is not None
                and summary.get(
                    "best_eval_mean",
                    None
                ) not in (
                    None,
                    -float("inf")
                )
            ):

                best_eval_across_seeds.append(
                    float(
                        summary["best_eval_mean"]
                    )
                )

        if best_eval_across_seeds:

            arr = np.array(
                best_eval_across_seeds,
                dtype=float
            )

            mean_perf = float(
                arr.mean()
            )

            std_perf = float(
                arr.std()
            )

            print(
                "\nMulti-seed summary over "
                f"{len(best_eval_across_seeds)} seeds:"
            )

            print(
                "  Best eval return "
                f"(mean ± std): "
                f"{mean_perf:.2f} ± "
                f"{std_perf:.2f}"
            )

        else:

            print(
                "\nMulti-seed run completed, "
                "but no evaluation statistics "
                "were collected."
            )
