"""
Compare the three environment variants (pinn, vanilla_nn, rc).

Runs test episodes in each backend with its corresponding agent and prints
a comparison table (reward, temperature, power, comfort %).
Can plot test comparison and/or combined training curves with all 3 variants per plot.
"""
import argparse
import sys
from pathlib import Path

# Add project root for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from src.env.pinn_model import PINNModel
from src.env.simulator import HVACSimulator, BackendType
from src.agent.dqn import DQNAgent
from src.utils.reward import calculate_total_reward


def run_test_episodes(backend, agent_path, pinn_model_path, device, num_episodes, max_steps, rc_delta_t=60.0):
    """Run test episodes for one backend; return list of episode dicts."""
    import torch

    state_dim = 6
    action_dim = 4
    pinn_model = None
    state_bounds = None
    action_bounds = None

    if backend in ("pinn", "vanilla_nn"):
        if not pinn_model_path or not Path(pinn_model_path).exists():
            return None
        checkpoint = torch.load(pinn_model_path, map_location=device)
        state_dim = checkpoint["state_dim"]
        action_dim = checkpoint["action_dim"]
        state_bounds = checkpoint.get("state_bounds", None)
        action_bounds = checkpoint.get("action_bounds", None)
        pinn_model = PINNModel(
            state_dim=state_dim,
            action_dim=action_dim,
            hidden_dims=checkpoint["config"].get("hidden_dims", [128, 128, 64]),
        ).to(device)
        pinn_model.load_state_dict(checkpoint["model_state_dict"])
        pinn_model.eval()

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

    if not Path(agent_path).exists():
        return None

    agent = DQNAgent(state_dim=state_dim, action_dim=action_space_size, device=device)
    agent.load(agent_path)
    agent.epsilon = 0.0

    episodes = []
    for _ in range(num_episodes):
        state = simulator.reset()
        episode_rewards = []
        episode_temperatures = []
        episode_powers = []
        total_reward = 0.0
        for _ in range(max_steps):
            action = agent.select_action(state, training=False)
            next_state, power, done, info = simulator.step(state, action)
            temperature = info.get("temperature", next_state[0])
            reward, _, _ = calculate_total_reward(
                temperature=temperature, power=power,
                w_comfort=0.7, w_energy=0.3, target_temp=25.0, tolerance=2.0,
            )
            episode_rewards.append(reward)
            episode_temperatures.append(float(temperature))
            episode_powers.append(float(power))
            total_reward += reward
            state = next_state
            if done:
                break
        temps = np.array(episode_temperatures)
        comfort_pct = 100.0 * np.mean((temps >= 23) & (temps <= 27))
        episodes.append({
            "total_reward": total_reward,
            "avg_temp": np.mean(episode_temperatures),
            "avg_power": np.mean(episode_powers),
            "comfort_pct": comfort_pct,
        })
    return episodes


def main():
    parser = argparse.ArgumentParser(description="Compare pinn, vanilla_nn, and rc env variants")
    parser.add_argument("--agents_dir", type=str, default="models",
                        help="Directory containing dqn_agent_<backend>.pth files")
    parser.add_argument("--pinn_model", type=str, default="models/pinn_model.pth")
    parser.add_argument("--vanilla_model", type=str, default="models/vanilla_model.pth")
    parser.add_argument("--episodes", type=int, default=5)
    parser.add_argument("--max_steps", type=int, default=100)
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--rc_delta_t", type=float, default=60.0)
    parser.add_argument("--csv", type=str, default=None, help="Save comparison table to CSV")
    parser.add_argument("--plot_test", type=str, default=None,
                        help="Save test comparison plot (all 3 variants per subplot)")
    parser.add_argument("--plot_training", type=str, default=None,
                        help="Save combined training curves (all 3 variants); uses curves_<backend>.npz in agents_dir")
    args = parser.parse_args()

    agents_dir = Path(args.agents_dir)
    default_agent = agents_dir / "dqn_agent.pth"
    backends = [
        ("pinn", args.pinn_model, agents_dir / "dqn_agent_pinn.pth"),
        ("vanilla_nn", args.vanilla_model, agents_dir / "dqn_agent_vanilla_nn.pth"),
        ("rc", None, agents_dir / "dqn_agent_rc.pth"),
    ]
    # Fallback: use single dqn_agent.pth if per-backend agent missing
    for i, (_, _, ap) in enumerate(backends):
        if not ap.exists() and default_agent.exists():
            backends[i] = (backends[i][0], backends[i][1], default_agent)

    results = {}
    for name, pinn_path, agent_path in backends:
        pinn_path_str = str(pinn_path) if pinn_path else None
        episodes = run_test_episodes(
            name, str(agent_path), pinn_path_str, args.device,
            args.episodes, args.max_steps, args.rc_delta_t,
        )
        if episodes is None:
            results[name] = None
            continue
        rewards = [e["total_reward"] for e in episodes]
        temps = [e["avg_temp"] for e in episodes]
        powers = [e["avg_power"] for e in episodes]
        comforts = [e["comfort_pct"] for e in episodes]
        results[name] = {
            "reward_mean": np.mean(rewards), "reward_std": np.std(rewards),
            "temp_mean": np.mean(temps), "temp_std": np.std(temps),
            "power_mean": np.mean(powers), "power_std": np.std(powers),
            "comfort_mean": np.mean(comforts), "comfort_std": np.std(comforts),
            "episode_rewards": rewards, "episode_temps": temps,
            "episode_powers": powers, "episode_comforts": comforts,
        }

    # Print table
    w_backend = 12
    w_col = 18
    sep = " | "
    print("\n" + "=" * (w_backend + 4 * (w_col + 3)))
    print("  Environment variants comparison")
    print("=" * (w_backend + 4 * (w_col + 3)))
    print(f"  Test episodes: {args.episodes}  |  Max steps: {args.max_steps}")
    print("=" * (w_backend + 4 * (w_col + 3)))
    print(f"  {'Backend':<{w_backend}}{sep}{'Reward':^{w_col}}{sep}{'Temp (°C)':^{w_col}}{sep}{'Power (W)':^{w_col}}{sep}{'Comfort %':^{w_col}}")
    print("-" * (w_backend + 4 * (w_col + 3)))
    for name in ("pinn", "vanilla_nn", "rc"):
        r = results.get(name)
        if r is None:
            print(f"  {name:<{w_backend}}{sep}{'(missing model/agent)':^{w_col}}")
        else:
            reward_str = f"{r['reward_mean']:.2f} ± {r['reward_std']:.2f}"
            temp_str = f"{r['temp_mean']:.2f} ± {r['temp_std']:.2f}"
            power_str = f"{r['power_mean']:.2f} ± {r['power_std']:.2f}"
            comfort_str = f"{r['comfort_mean']:.1f} ± {r['comfort_std']:.1f}"
            print(f"  {name:<{w_backend}}{sep}{reward_str:^{w_col}}{sep}{temp_str:^{w_col}}{sep}{power_str:^{w_col}}{sep}{comfort_str:^{w_col}}")
    print("=" * (w_backend + 4 * (w_col + 3)) + "\n")

    if args.csv:
        with open(args.csv, "w") as f:
            f.write("backend,reward_mean,reward_std,temp_mean,temp_std,power_mean,power_std,comfort_mean,comfort_std\n")
            for name in ("pinn", "vanilla_nn", "rc"):
                r = results.get(name)
                if r is not None:
                    f.write(f"{name},{r['reward_mean']},{r['reward_std']},{r['temp_mean']},{r['temp_std']},"
                            f"{r['power_mean']},{r['power_std']},{r['comfort_mean']},{r['comfort_std']}\n")
        print(f"Results saved to {args.csv}")

    # Test comparison plot: each subplot has 3 lines (pinn, vanilla_nn, rc)
    if args.plot_test:
        _plot_test_comparison(results, args.plot_test)

    # Combined training curves: load curves_<backend>.npz and plot 3 lines per subplot
    if args.plot_training:
        _plot_training_combined(agents_dir, args.plot_training)


def _plot_test_comparison(results, save_path):
    """Plot test comparison: 4 subplots, each with 3 lines (pinn, vanilla_nn, rc)."""
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    colors = {"pinn": "C0", "vanilla_nn": "C1", "rc": "C2"}
    labels = {"pinn": "PINN", "vanilla_nn": "Vanilla NN", "rc": "RC"}

    for name in ("pinn", "vanilla_nn", "rc"):
        r = results.get(name)
        if r is None or "episode_rewards" not in r:
            continue
        ep = np.arange(1, len(r["episode_rewards"]) + 1)
        axes[0, 0].plot(ep, r["episode_rewards"], color=colors[name], label=labels[name], alpha=0.8)
        axes[0, 1].plot(ep, r["episode_temps"], color=colors[name], label=labels[name], alpha=0.8)
        axes[1, 0].plot(ep, r["episode_powers"], color=colors[name], label=labels[name], alpha=0.8)
        axes[1, 1].plot(ep, r["episode_comforts"], color=colors[name], label=labels[name], alpha=0.8)

    axes[0, 0].set_xlabel("Test episode"); axes[0, 0].set_ylabel("Total reward"); axes[0, 0].set_title("Reward")
    axes[0, 1].set_xlabel("Test episode"); axes[0, 1].set_ylabel("Temp (°C)"); axes[0, 1].set_title("Avg temperature")
    axes[1, 0].set_xlabel("Test episode"); axes[1, 0].set_ylabel("Power (W)"); axes[1, 0].set_title("Avg power")
    axes[1, 1].set_xlabel("Test episode"); axes[1, 1].set_ylabel("Comfort %"); axes[1, 1].set_title("Comfort %")
    for ax in axes.flat:
        ax.legend(); ax.grid(True)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"Test comparison plot saved to {save_path}")


def _plot_training_combined(agents_dir, save_path):
    """Load curves_<backend>.npz and plot training curves with 3 lines per subplot.

    Shows:
      - Smoothed training reward (with exploration) per backend
      - Evaluation reward (greedy) per backend, if available
      - Episode length, avg temperature, avg power as before
    """
    path = Path(agents_dir)
    curves = {}
    for name in ("pinn", "vanilla_nn", "rc"):
        npz_path = path / f"curves_{name}.npz"
        if npz_path.exists():
            data = np.load(npz_path, allow_pickle=True)
            curves[name] = {
                "rewards": data["episode_rewards"],
                "lengths": data["episode_lengths"],
                "temperatures": data["episode_temperatures"],
                "powers": data["episode_powers"],
                "eval_means": data["eval_means"] if "eval_means" in data.files else None,
                "eval_every": int(data["eval_every"]) if "eval_every" in data.files else None,
            }
    if not curves:
        print("No curves_<backend>.npz found; skipping training plot.")
        return

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    colors = {"pinn": "C0", "vanilla_nn": "C1", "rc": "C2"}
    labels = {"pinn": "PINN", "vanilla_nn": "Vanilla NN", "rc": "RC"}
    window = min(50, max(1, len(next(iter(curves.values()))["rewards"]) // 10))

    def moving_average(data, w):
        return np.convolve(data, np.ones(w) / w, mode="valid")

    # One line per variant (smoothed when enough points); overlay eval rewards if available
    for name in ("pinn", "vanilla_nn", "rc"):
        if name not in curves:
            continue
        c = curves[name]
        ep = np.arange(len(c["rewards"]))
        if len(c["rewards"]) >= window:
            ep_smooth = ep[window - 1 :]
            axes[0, 0].plot(
                ep_smooth,
                moving_average(c["rewards"], window),
                color=colors[name],
                label=f"{labels[name]} (train)",
                linewidth=2,
            )
            axes[0, 1].plot(ep_smooth, moving_average(c["lengths"], window), color=colors[name], label=labels[name], linewidth=2)
            axes[1, 0].plot(ep_smooth, moving_average(c["temperatures"], window), color=colors[name], label=labels[name], linewidth=2)
            axes[1, 1].plot(ep_smooth, moving_average(c["powers"], window), color=colors[name], label=labels[name], linewidth=2)
        else:
            axes[0, 0].plot(ep, c["rewards"], color=colors[name], label=f"{labels[name]} (train)", linewidth=2)
            axes[0, 1].plot(ep, c["lengths"], color=colors[name], label=labels[name], linewidth=2)
            axes[1, 0].plot(ep, c["temperatures"], color=colors[name], label=labels[name], linewidth=2)
            axes[1, 1].plot(ep, c["powers"], color=colors[name], label=labels[name], linewidth=2)

        # Overlay evaluation rewards (greedy) if present
        eval_means = c.get("eval_means")
        eval_every = c.get("eval_every")
        if eval_means is not None and len(eval_means) > 0 and eval_every:
            eval_x = np.arange(len(eval_means)) * eval_every + (eval_every - 1)
            axes[0, 0].plot(
                eval_x,
                eval_means,
                marker="o",
                linestyle="--",
                color=colors[name],
                alpha=0.8,
                label=f"{labels[name]} (eval)",
            )

    axes[0, 0].set_xlabel("Episode"); axes[0, 0].set_ylabel("Total reward"); axes[0, 0].set_title("Episode rewards")
    axes[0, 1].set_xlabel("Episode"); axes[0, 1].set_ylabel("Steps"); axes[0, 1].set_title("Episode lengths")
    axes[1, 0].set_xlabel("Episode"); axes[1, 0].set_ylabel("Temp (°C)"); axes[1, 0].set_title("Avg temperature")
    axes[1, 0].axhline(y=25, color="black", linestyle="--", alpha=0.5)
    axes[1, 0].axhspan(23, 27, alpha=0.1, color="green")
    axes[1, 1].set_xlabel("Episode"); axes[1, 1].set_ylabel("Power (W)"); axes[1, 1].set_title("Avg power")
    for ax in axes.flat:
        ax.legend(); ax.grid(True)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"Training curves (all 3 variants) saved to {save_path}")


if __name__ == "__main__":
    main()
