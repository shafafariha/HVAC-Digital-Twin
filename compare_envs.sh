#!/usr/bin/env bash
#
# Compare the three environment variants: pinn, vanilla_nn, rc.
#
# 1. Optionally trains world models (PINN, vanilla_nn) and/or agents.
# 2. Runs test episodes in each env with its agent and prints a comparison table.
#
# Usage:
#   ./compare_envs.sh              # use existing models/agents; run comparison only
#   ./compare_envs.sh --train      # train agents first (short runs), then compare
#   ./compare_envs.sh --train-all  # retrain PINN + vanilla_nn + all 3 agents, then compare
#                                   (with periodic eval + optional multi-seed)
#

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defaults (override with env or edit)
EPISODES="${EPISODES:-50}"          # RL training episodes per backend
MAX_STEPS="${MAX_STEPS:-50}"        # Max steps per training episode
TEST_EPISODES="${TEST_EPISODES:-5}" # Evaluation episodes per backend
TEST_STEPS="${TEST_STEPS:-100}"     # Max steps per eval episode
DEVICE="${DEVICE:-cpu}"
MODELS_DIR="${MODELS_DIR:-models}"
DATA_CSV="${DATA_CSV:-data/processed/train_data.csv}"
RL_SEEDS="${RL_SEEDS:-5}"           # Number of random seeds for 2_train_rl.py
BASE_SEED="${BASE_SEED:-0}"         # Base seed (each run uses base_seed + i)
EVAL_EVERY="${EVAL_EVERY:-10}"      # Evaluate greedy policy every N episodes
EVAL_EPISODES="${EVAL_EPISODES:-5}" # Greedy episodes per evaluation

TRAIN=false
TRAIN_ALL=false
for arg in "$@"; do
  case "$arg" in
    --train)      TRAIN=true ;;
    --train-all)  TRAIN_ALL=true ;;
  esac
done

echo "=== Environment variants comparison ==="
echo "  Models dir:      $MODELS_DIR"
echo "  Train episodes:  $EPISODES"
echo "  Train steps:     $MAX_STEPS"
echo "  Test episodes:   $TEST_EPISODES"
echo "  Test steps:      $TEST_STEPS"
echo "  Device:          $DEVICE"
echo "  RL seeds:        $RL_SEEDS (base_seed=$BASE_SEED)"
echo "  Eval every:      $EVAL_EVERY episodes, $EVAL_EPISODES greedy eps"
echo ""

# Optional: train world models (PINN and vanilla_nn) — with --train-all always retrain both
if [[ "$TRAIN_ALL" == true ]]; then
  echo ">>> Training PINN world model..."
  python 1_train_pinn.py \
    --data "$DATA_CSV" \
    --config configs/pinn_config.yaml \
    --model "$MODELS_DIR/pinn_model.pth" \
    --device "$DEVICE"
  echo ""
  echo ">>> Training vanilla_nn world model (physics_lambda=0)..."
  python 1_train_pinn.py \
    --data "$DATA_CSV" \
    --config configs/vanilla_nn_config.yaml \
    --model "$MODELS_DIR/vanilla_model.pth" \
    --device "$DEVICE"
  echo ""
fi

# Optional: train one agent per backend
if [[ "$TRAIN" == true || "$TRAIN_ALL" == true ]]; then
  echo ">>> Training agents (${EPISODES} episodes, ${MAX_STEPS} steps per backend, ${RL_SEEDS} seed(s))..."
  for backend in pinn vanilla_nn rc; do
    agent_path="$MODELS_DIR/dqn_agent_${backend}.pth"
    curves_npz="$MODELS_DIR/curves_${backend}.npz"
    echo "    Backend: $backend -> $agent_path"

    if [[ "$backend" == "pinn" ]]; then
      if [[ "$TRAIN_ALL" != true && ! -f "$MODELS_DIR/pinn_model.pth" ]]; then
        echo "      Skipping pinn (pinn_model.pth not found; run: python 1_train_pinn.py --model $MODELS_DIR/pinn_model.pth or use --train-all)"
        continue
      fi
      python 2_train_rl.py \
        --backend pinn \
        --pinn_model "$MODELS_DIR/pinn_model.pth" \
        --config configs/rl_config.yaml \
        --agent "$agent_path" \
        --device "$DEVICE" \
        --episodes "$EPISODES" \
        --max_steps "$MAX_STEPS" \
        --curves_data "$curves_npz" \
        --no_plot \
        --eval_every "$EVAL_EVERY" \
        --eval_episodes "$EVAL_EPISODES" \
        --seeds "$RL_SEEDS" \
        --base_seed "$BASE_SEED"

    elif [[ "$backend" == "vanilla_nn" ]]; then
      if [[ "$TRAIN_ALL" != true && ! -f "$MODELS_DIR/vanilla_model.pth" ]]; then
        echo "      Skipping vanilla_nn (vanilla_model.pth not found; run with --train-all)"
        continue
      fi
      python 2_train_rl.py \
        --backend vanilla_nn \
        --pinn_model "$MODELS_DIR/vanilla_model.pth" \
        --config configs/rl_config.yaml \
        --agent "$agent_path" \
        --device "$DEVICE" \
        --episodes "$EPISODES" \
        --max_steps "$MAX_STEPS" \
        --curves_data "$curves_npz" \
        --no_plot \
        --eval_every "$EVAL_EVERY" \
        --eval_episodes "$EVAL_EPISODES" \
        --seeds "$RL_SEEDS" \
        --base_seed "$BASE_SEED"

    else  # rc
      python 2_train_rl.py \
        --backend rc \
        --config configs/rl_config.yaml \
        --agent "$agent_path" \
        --device "$DEVICE" \
        --episodes "$EPISODES" \
        --max_steps "$MAX_STEPS" \
        --curves_data "$curves_npz" \
        --no_plot \
        --eval_every "$EVAL_EVERY" \
        --eval_episodes "$EVAL_EPISODES" \
        --seeds "$RL_SEEDS" \
        --base_seed "$BASE_SEED"
    fi
  done
  echo ""
fi

# Run comparison (expects dqn_agent_pinn.pth, dqn_agent_vanilla_nn.pth, dqn_agent_rc.pth)
# Plots: test comparison + combined training curves (all 3 variants per plot)
echo ">>> Running comparison across backends..."
python compare_envs.py \
  --agents_dir "$MODELS_DIR" \
  --pinn_model "$MODELS_DIR/pinn_model.pth" \
  --vanilla_model "$MODELS_DIR/vanilla_model.pth" \
  --episodes "$TEST_EPISODES" \
  --max_steps "$TEST_STEPS" \
  --device "$DEVICE" \
  --csv "$MODELS_DIR/env_comparison.csv" \
  --plot_test "$MODELS_DIR/env_comparison.png" \
  --plot_training "$MODELS_DIR/training_curves.png"

echo ""
echo "Done."
