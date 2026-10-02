import argparse
import torch
import numpy as np
import matplotlib.pyplot as plt

from src.env.pinn_model import PINNModel
from src.env.simulator import HVACSimulator, BackendType
from src.agent.dqn import DQNAgent
from src.utils.reward import calculate_total_reward

def test_agent(
    backend: BackendType,
    agent_path: str,
    pinn_model_path: str = None,
    num_episodes: int = 5,
    max_steps: int = 100,
    device: str = 'cpu',
    render: bool = True,
    rc_delta_t: float = 60.0,
):
    """
    Test trained agent in HVAC simulator.

    Args:
        backend: Environment variant: "pinn", "vanilla_nn", or "rc"
        agent_path: Path to trained DQN agent
        pinn_model_path: Path to NN checkpoint (required for pinn/vanilla_nn; ignored for rc)
        num_episodes: Number of test episodes
        max_steps: Maximum steps per episode
        device: Device to run on
        render: Whether to plot results
        rc_delta_t: Time step for RC model (when backend=rc)
    """
    state_dim = 6
    action_dim = 4
    pinn_model = None
    state_bounds = None

    if backend in ('pinn', 'vanilla_nn'):
        if not pinn_model_path:
            raise ValueError(f"pinn_model_path is required when backend={backend!r}")
        print(f"Loading {backend} model from {pinn_model_path}...")
        checkpoint = torch.load(pinn_model_path, map_location=device, weights_only=False)
        state_dim = checkpoint['state_dim']
        action_dim = checkpoint['action_dim']
        state_bounds = checkpoint.get('state_bounds', None)
        action_bounds = checkpoint.get('action_bounds', None)
        pinn_model = PINNModel(
            state_dim=state_dim,
            action_dim=action_dim,
            hidden_dims=checkpoint['config'].get('hidden_dims', [128, 128, 64])
        ).to(device)
        pinn_model.load_state_dict(checkpoint['model_state_dict'])
        pinn_model.eval()
        print(f"{backend} model loaded")

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

    print(f"Loading agent from {agent_path}...")
    agent = DQNAgent(
        state_dim=state_dim,
        action_dim=action_space_size,
        device=device
    )
    agent.load(agent_path)
    agent.epsilon = 0.0  # No exploration during testing
    
    print("Starting test episodes...\n")
    
    all_episodes = []
    
    for episode in range(num_episodes):
        state = simulator.reset()
        
        episode_states = [state.copy()]
        episode_actions = []
        episode_rewards = []
        episode_temperatures = []
        episode_powers = []
        
        total_reward = 0.0
        
        for step in range(max_steps):
            action = agent.select_action(state, training=False)
            
            next_state, power, done, info = simulator.step(state, action)
            
            temperature = info.get('temperature', next_state[0])
            reward, _, _ = calculate_total_reward(
                temperature=temperature,
                power=power,
                w_comfort=0.7,
                w_energy=0.3,
                target_temp=25.0,
                tolerance=2.0 
            )
            
            episode_states.append(next_state.copy())
            episode_actions.append(action)
            episode_rewards.append(reward)
            episode_temperatures.append(float(temperature))
            episode_powers.append(float(power))
            
            total_reward += reward
            state = next_state
            
            if done:
                break
        
        all_episodes.append({
            'states': episode_states,
            'actions': episode_actions,
            'rewards': episode_rewards,
            'temperatures': episode_temperatures,
            'powers': episode_powers,
            'total_reward': total_reward
        })
        
        avg_temp = np.mean(episode_temperatures)
        avg_power = np.mean(episode_powers)
        temp_in_range = np.sum((np.array(episode_temperatures) >= 23) & 
                              (np.array(episode_temperatures) <= 27)) / len(episode_temperatures)
        
        print(f"Episode {episode+1}:")
        print(f"  Total Reward: {total_reward:.2f}")
        print(f"  Avg Temperature: {avg_temp:.2f}°C")
        print(f"  Avg Power: {avg_power:.2f}W")
        print(f"  Time in Comfort Zone: {temp_in_range*100:.1f}%")
        print()
    
    if render:
        plot_test_results(all_episodes)
    
    return all_episodes

def plot_test_results(episodes):
    """Plot test episode results."""
    num_episodes = len(episodes)
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    
    for i, episode in enumerate(episodes):
        steps = np.arange(len(episode['temperatures']))
        
        axes[0, 0].plot(steps, episode['temperatures'], alpha=0.7, label=f'Episode {i+1}')
        
        axes[0, 1].plot(steps, episode['powers'], alpha=0.7, label=f'Episode {i+1}')
        
        cumulative_reward = np.cumsum(episode['rewards'])
        axes[1, 0].plot(steps, cumulative_reward, alpha=0.7, label=f'Episode {i+1}')
        
        axes[1, 1].plot(steps, episode['rewards'], alpha=0.7, label=f'Episode {i+1}')
    
    axes[0, 0].axhline(y=25, color='black', linestyle='--', linewidth=2, label='Target (25°C)')
    axes[0, 0].axhspan(23, 27, alpha=0.2, color='green', label='Comfort Zone')
    axes[0, 0].set_xlabel('Step')
    axes[0, 0].set_ylabel('Temperature (°C)')
    axes[0, 0].set_title('Temperature Trajectories')
    axes[0, 0].legend()
    axes[0, 0].grid(True)
    
    axes[0, 1].set_xlabel('Step')
    axes[0, 1].set_ylabel('Power (W)')
    axes[0, 1].set_title('Power Consumption')
    axes[0, 1].legend()
    axes[0, 1].grid(True)
    
    axes[1, 0].set_xlabel('Step')
    axes[1, 0].set_ylabel('Cumulative Reward')
    axes[1, 0].set_title('Cumulative Reward')
    axes[1, 0].legend()
    axes[1, 0].grid(True)
    
    axes[1, 1].set_xlabel('Step')
    axes[1, 1].set_ylabel('Reward')
    axes[1, 1].set_title('Reward per Step')
    axes[1, 1].legend()
    axes[1, 1].grid(True)
    
    plt.tight_layout()
    plt.savefig('models/test_results.png', dpi=150)
    print("Test results saved to models/test_results.png")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Test trained DQN agent')
    parser.add_argument('--backend', type=str, default='pinn', choices=['pinn', 'vanilla_nn', 'rc'],
                        help='Environment backend: pinn, vanilla_nn, or rc')
    parser.add_argument('--pinn_model', type=str, default='models/pinn_model.pth',
                        help='Path to NN checkpoint (for pinn/vanilla_nn; ignored for rc)')
    parser.add_argument('--agent', type=str, default='models/dqn_agent.pth',
                        help='Path to trained DQN agent')
    parser.add_argument('--episodes', type=int, default=5,
                        help='Number of test episodes')
    parser.add_argument('--max_steps', type=int, default=100,
                        help='Maximum steps per episode')
    parser.add_argument('--device', type=str, default='cuda' if torch.cuda.is_available() else 'cpu',
                        help='Device to run on')
    parser.add_argument('--rc_delta_t', type=float, default=60.0,
                        help='Time step for RC model (when backend=rc)')
    args = parser.parse_args()

    test_agent(
        backend=args.backend,
        agent_path=args.agent,
        pinn_model_path=args.pinn_model if args.backend in ('pinn', 'vanilla_nn') else None,
        num_episodes=args.episodes,
        max_steps=args.max_steps,
        device=args.device,
        rc_delta_t=args.rc_delta_t,
    )

