'use client';

import React, { useState } from 'react';
import {
  Scale,
  RefreshCw,
  Activity,
  Zap,
  BarChart2,
  Minus,
  Plus,
  ChevronDown,
} from 'lucide-react';
import {
  EngineeringZoneRequest,
  ControlComparisonResponse,
  ControlComparisonRequest,
} from '@/lib/types';
import { compareControllers } from '@/lib/api';

interface ControlComparisonCardProps {
  currentZone: EngineeringZoneRequest;
}

export const ControlComparisonCard: React.FC<ControlComparisonCardProps> = ({ currentZone }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ControlComparisonResponse | null>(null);
  const [outdoorPattern, setOutdoorPattern] = useState<'diurnal' | 'heatwave' | 'constant'>('diurnal');
  const [baselineSetpoint, setBaselineSetpoint] = useState<number>(24.0);

  // Active view tab: 'temp' (Thermal Trajectory) or 'power' (Power Load Curve)
  const [activeTab, setActiveTab] = useState<'temp' | 'power'>('temp');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleRunComparison = async () => {
    setIsRunning(true);
    setHoveredIndex(null);
    setSelectedIndex(null);
    try {
      const req: ControlComparisonRequest = {
        zone: currentZone,
        steps: 24,
        outdoor_temp_pattern: outdoorPattern,
        baseline_setpoint_c: baselineSetpoint,
      };
      const res = await compareControllers(req);
      setComparisonResult(res);
    } catch (err: any) {
      alert(`Control comparison evaluation failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Trajectory Rendering following SimulationChart standards
  const renderTrajectoryChart = () => {
    if (!comparisonResult) return null;

    const dqnTraj = comparisonResult.dqn_trajectory;
    const baseTraj = comparisonResult.baseline_trajectory;
    const count = dqnTraj.length;
    if (count === 0) return null;

    // Active inspected point
    const activeIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex;
    const activeDqn = activeIndex !== null && activeIndex < count ? dqnTraj[activeIndex] : null;
    const activeBase = activeIndex !== null && activeIndex < baseTraj.length ? baseTraj[activeIndex] : null;

    // Dimension bounds
    const width = 800;
    const height = 240;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Temperature scale
    const allTemps = [...dqnTraj.map((d) => d.T_in), ...baseTraj.map((b) => b.T_in), 23, 27];
    const minTemp = Math.floor(Math.min(...allTemps)) - 1;
    const maxTemp = Math.ceil(Math.max(...allTemps)) + 1;
    const tempRange = maxTemp - minTemp || 1;

    // Power scale
    const allPowers = [...dqnTraj.map((d) => d.power_w), ...baseTraj.map((b) => b.power_w)];
    const maxPower = Math.max(100, ...allPowers) * 1.15;

    const getX = (index: number) => {
      if (count <= 1) return padding.left + graphWidth / 2;
      return padding.left + (index / (count - 1)) * graphWidth;
    };

    const getYTemp = (val: number) => {
      return padding.top + (1 - (val - minTemp) / tempRange) * graphHeight;
    };

    const getYPower = (val: number) => {
      return padding.top + (1 - val / maxPower) * graphHeight;
    };

    // Polyline points
    const dqnTempPoints = dqnTraj.map((d, i) => `${getX(i)},${getYTemp(d.T_in)}`).join(' ');
    const baseTempPoints = baseTraj.map((b, i) => `${getX(i)},${getYTemp(b.T_in)}`).join(' ');

    const dqnPowerPoints = dqnTraj.map((d, i) => `${getX(i)},${getYPower(d.power_w)}`).join(' ');
    const basePowerPoints = baseTraj.map((b, i) => `${getX(i)},${getYPower(b.power_w)}`).join(' ');

    // Comfort band
    const comfortTopY = getYTemp(27.0);
    const comfortBottomY = getYTemp(23.0);
    const comfortBandPolygon = `
      ${padding.left},${comfortTopY}
      ${width - padding.right},${comfortTopY}
      ${width - padding.right},${comfortBottomY}
      ${padding.left},${comfortBottomY}
    `;

    // Tooltip coordinates & placement
    let activeCx = 0;
    let activeCy = 0;
    let leftPct = 0;
    let topPct = 0;
    let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';

    if (activeDqn && activeIndex !== null) {
      activeCx = getX(activeIndex);
      activeCy = activeTab === 'temp' ? getYTemp(activeDqn.T_in) : getYPower(activeDqn.power_w);
      leftPct = (activeCx / width) * 100;
      topPct = (activeCy / height) * 100;

      if (leftPct > 68) {
        placement = 'left';
      } else if (leftPct < 32) {
        placement = 'right';
      } else if (topPct > 40) {
        placement = 'top';
      } else {
        placement = 'bottom';
      }
    }

    return (
      <div className="space-y-3">
        {/* Sub-header with Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-800">
              Comparative Trajectory Visualization:
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              (24-Hour Closed-Loop Simulation)
            </span>
          </div>

          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('temp')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'temp'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Thermal Response (°C)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('power')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'power'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Power Load Curve (W)</span>
            </button>
          </div>
        </div>

        {/* SVG Graphic Container */}
        <div
          className="w-full relative bg-slate-50/50 rounded-xl p-2 border border-slate-200"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none overflow-visible">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * graphHeight;
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              );
            })}

            {/* Vertical Cursor Line */}
            {activeDqn && activeIndex !== null && (
              <line
                x1={getX(activeIndex)}
                y1={padding.top}
                x2={getX(activeIndex)}
                y2={height - padding.bottom}
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                strokeOpacity="0.8"
              />
            )}

            {activeTab === 'temp' ? (
              <>
                {/* Comfort Band Shading (23°C to 27°C) */}
                <polygon points={comfortBandPolygon} fill="#e0f2fe" fillOpacity="0.75" />
                <line
                  x1={padding.left}
                  y1={comfortTopY}
                  x2={width - padding.right}
                  y2={comfortTopY}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <line
                  x1={padding.left}
                  y1={comfortBottomY}
                  x2={width - padding.right}
                  y2={comfortBottomY}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />

                {/* Baseline Thermostat Curve (Slate Dashed) */}
                <polyline
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  points={baseTempPoints}
                />

                {/* DQN Agent Curve (Sky Blue Solid) */}
                <polyline
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  points={dqnTempPoints}
                />

                {/* Baseline Points */}
                {baseTraj.map((b, i) => {
                  const cx = getX(i);
                  const cy = getYTemp(b.T_in);
                  const isActive = i === activeIndex;
                  return (
                    <circle
                      key={`base-${i}`}
                      cx={cx}
                      cy={cy}
                      r={isActive ? 4.5 : 3}
                      fill={isActive ? '#64748b' : '#ffffff'}
                      stroke="#64748b"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* DQN Points */}
                {dqnTraj.map((d, i) => {
                  const cx = getX(i);
                  const cy = getYTemp(d.T_in);
                  const isActive = i === activeIndex;
                  return (
                    <g key={`dqn-${i}`}>
                      {isActive && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r="9"
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="2.5"
                          strokeOpacity="0.4"
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isActive ? 5 : 3.5}
                        fill={isActive ? '#0284c7' : '#ffffff'}
                        stroke="#0284c7"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}

                {/* Y Axis Labels */}
                <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#64748b" fontSize="10">
                  {maxTemp}°C
                </text>
                <text x={padding.left - 8} y={getYTemp(25.0) + 3} textAnchor="end" fill="#0284c7" fontWeight="bold" fontSize="10">
                  25°C
                </text>
                <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" fill="#64748b" fontSize="10">
                  {minTemp}°C
                </text>
              </>
            ) : (
              <>
                {/* Baseline Power Line (Slate Dashed) */}
                <polyline
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  points={basePowerPoints}
                />

                {/* DQN Power Line (Sky Blue Solid) */}
                <polyline
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  points={dqnPowerPoints}
                />

                {/* Baseline Points */}
                {baseTraj.map((b, i) => {
                  const cx = getX(i);
                  const cy = getYPower(b.power_w);
                  const isActive = i === activeIndex;
                  return (
                    <circle
                      key={`base-p-${i}`}
                      cx={cx}
                      cy={cy}
                      r={isActive ? 4.5 : 3}
                      fill={isActive ? '#64748b' : '#ffffff'}
                      stroke="#64748b"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* DQN Points */}
                {dqnTraj.map((d, i) => {
                  const cx = getX(i);
                  const cy = getYPower(d.power_w);
                  const isActive = i === activeIndex;
                  return (
                    <g key={`dqn-p-${i}`}>
                      {isActive && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r="9"
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="2.5"
                          strokeOpacity="0.4"
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isActive ? 5 : 3.5}
                        fill={isActive ? '#0284c7' : '#ffffff'}
                        stroke="#0284c7"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}

                {/* Y Axis Labels */}
                <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fill="#64748b" fontSize="10">
                  {maxPower.toFixed(0)} W
                </text>
                <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" fill="#64748b" fontSize="10">
                  0 W
                </text>
              </>
            )}

            {/* X Axis Time Labels */}
            {dqnTraj.map((d, i) => {
              if (i % Math.ceil(count / 6) === 0 || i === count - 1) {
                return (
                  <text
                    key={`time-${i}`}
                    x={getX(i)}
                    y={height - 12}
                    textAnchor="middle"
                    fill={i === activeIndex ? '#0284c7' : '#64748b'}
                    fontWeight={i === activeIndex ? 'bold' : 'normal'}
                    fontSize="10"
                  >
                    {d.time_label || `H${d.step}`}
                  </text>
                );
              }
              return null;
            })}

            {/* Interactive Hover / Click Slices */}
            {dqnTraj.map((_, i) => {
              const sliceWidth = graphWidth / Math.max(1, count - 1);
              const xLeft = getX(i) - sliceWidth / 2;
              return (
                <rect
                  key={`slice-${i}`}
                  x={Math.max(padding.left, xLeft)}
                  y={padding.top}
                  width={sliceWidth}
                  height={graphHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onClick={() => setSelectedIndex(selectedIndex === i ? null : i)}
                />
              );
            })}
          </svg>

          {/* Floating Comparison Callout Speech Bubble */}
          {activeDqn && activeBase && (
            <div
              className="absolute z-30 pointer-events-none transition-all duration-150 ease-out"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform:
                  placement === 'left'
                    ? 'translate(calc(-100% - 12px), -50%)'
                    : placement === 'right'
                    ? 'translate(12px, -50%)'
                    : placement === 'bottom'
                    ? 'translate(-50%, 12px)'
                    : 'translate(-50%, calc(-100% - 12px))',
              }}
            >
              <div className="relative bg-white border border-sky-300 rounded-xl shadow-lg p-0 min-w-[240px] max-w-[280px] overflow-hidden text-xs">
                {/* Header */}
                <div className="bg-sky-50 px-3 py-1.5 border-b border-sky-100 flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800 text-[11px] truncate">
                    {activeDqn.time_label || `Step ${activeDqn.step}`} Comparison
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      activeDqn.is_comfort
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {activeDqn.is_comfort ? 'DQN in Comfort' : 'DQN Out of Band'}
                  </span>
                </div>

                {/* Content Rows */}
                <div className="p-2.5 space-y-1.5 text-[11px]">
                  {/* Indoor Temp Row */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Indoor Temp:</span>
                    <span className="font-mono">
                      <strong className="text-sky-700">{activeDqn.T_in.toFixed(1)}°C</strong>{' '}
                      <span className="text-slate-400">vs</span>{' '}
                      <span className="text-slate-600 font-semibold">{activeBase.T_in.toFixed(1)}°C</span>
                    </span>
                  </div>

                  {/* Power Row */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Power Demand:</span>
                    <span className="font-mono">
                      <strong className="text-sky-700">{activeDqn.power_w.toFixed(0)}W</strong>{' '}
                      <span className="text-slate-400">vs</span>{' '}
                      <span className="text-slate-600 font-semibold">{activeBase.power_w.toFixed(0)}W</span>
                    </span>
                  </div>

                  {/* Power Savings in Watts */}
                  <div className="flex justify-between items-center bg-sky-50/60 px-2 py-1 rounded border border-sky-100">
                    <span className="text-sky-900 font-medium">Power Difference:</span>
                    <span
                      className={`font-mono font-bold ${
                        activeBase.power_w - activeDqn.power_w >= 0
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {activeBase.power_w - activeDqn.power_w >= 0
                        ? `-${(activeBase.power_w - activeDqn.power_w).toFixed(0)} W Saved`
                        : `+${(activeDqn.power_w - activeBase.power_w).toFixed(0)} W`}
                    </span>
                  </div>

                  {/* AC Dispatch */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px]">
                    <span className="text-slate-500">DQN Action:</span>
                    <span className="font-semibold text-slate-800">
                      {activeDqn.action.source === 1 ? 'ON' : 'OFF'} • Fan {activeDqn.action.fan_speed} •{' '}
                      {activeDqn.action.target_temp}°C
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500">Thermostat:</span>
                    <span className="font-semibold text-slate-700">
                      {activeBase.action.source === 1 ? 'ON (Cooling)' : 'STANDBY (Off)'}
                    </span>
                  </div>
                </div>

                {/* Pointer Tail */}
                {placement === 'top' && (
                  <>
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-sky-300" />
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-[6.5px] w-0 h-0 border-x-[5px] border-x-transparent border-t-[7px] border-t-white" />
                  </>
                )}
                {placement === 'bottom' && (
                  <>
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-t-sky-300" />
                    <div className="absolute left-1/2 -translate-x-1/2 -top-[6.5px] w-0 h-0 border-x-[5px] border-x-transparent border-b-[7px] border-t-white" />
                  </>
                )}
                {placement === 'left' && (
                  <>
                    <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[8px] border-l-sky-300" />
                    <div className="absolute top-1/2 -translate-y-1/2 -right-[6.5px] w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-white" />
                  </>
                )}
                {placement === 'right' && (
                  <>
                    <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[8px] border-r-sky-300" />
                    <div className="absolute top-1/2 -translate-y-1/2 -left-[6.5px] w-0 h-0 border-y-[5px] border-y-transparent border-r-[7px] border-r-white" />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-1 text-xs text-slate-600">
          <span className="flex items-center space-x-1.5">
            <span className="w-3.5 h-1 bg-sky-600 rounded-full" />
            <span className="font-semibold text-slate-800">Autonomous DQN Agent</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3.5 h-1 bg-slate-500 rounded-full border border-slate-500 border-dashed" />
            <span className="font-semibold text-slate-800">Baseline Rule-Based Thermostat</span>
          </span>
          {activeTab === 'temp' && (
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-sky-100 border border-sky-300 rounded" />
              <span>Target Comfort Band (23°C – 27°C)</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header and Refined Scenario Control Bar */}
      <div className="space-y-4 border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-600 text-white shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Control Strategy Evaluation: DQN Agent vs Baseline Rule-Based Thermostat
              </h2>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleRunComparison}
            disabled={isRunning}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Evaluating 24h Trajectory...' : 'Run Comparative Evaluation'}</span>
          </button>
        </div>

        {/* Refined Scenario Selector Bar */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Outdoor Weather Scenario Dropdown */}
          <div className="flex items-center space-x-2.5 flex-1">
            <span className="text-xs font-semibold text-slate-700 shrink-0">
              Evaluation Weather Scenario:
            </span>
            <div className="relative flex-1 max-w-md">
              <select
                value={outdoorPattern}
                onChange={(e) => setOutdoorPattern(e.target.value as any)}
                className="w-full bg-white border border-slate-300 hover:border-sky-400 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-slate-800 transition appearance-none shadow-2xs cursor-pointer"
              >
                <option value="diurnal">Diurnal Summer Cycle (30.0°C – 34.5°C)</option>
                <option value="heatwave">Extreme Heatwave (36.0°C – 38.0°C)</option>
                <option value="constant">Constant Design Day (33.0°C Steady Peak)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Baseline Setpoint Stepper */}
          <div className="flex items-center justify-end space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 shrink-0">
            <span className="text-[11px] font-medium text-slate-600">
              Thermostat Setpoint:
            </span>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setBaselineSetpoint((prev) => Math.max(20.0, prev - 0.5))}
                className="p-1 hover:bg-slate-100 text-slate-600 rounded transition"
                title="Decrease baseline setpoint"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-2 font-mono font-bold text-sky-800 text-xs">
                {baselineSetpoint.toFixed(1)}°C
              </span>
              <button
                type="button"
                onClick={() => setBaselineSetpoint((prev) => Math.min(28.0, prev + 0.5))}
                className="p-1 hover:bg-slate-100 text-slate-600 rounded transition"
                title="Increase baseline setpoint"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonResult ? (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-sky-50/70 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                Total Energy Savings
              </span>
              <span className="text-2xl font-bold text-sky-950 font-mono">
                {comparisonResult.summary.energy_savings_pct > 0
                  ? `+${comparisonResult.summary.energy_savings_pct.toFixed(1)}%`
                  : `${comparisonResult.summary.energy_savings_pct.toFixed(1)}%`}
              </span>
              <span className="text-[10px] text-sky-700 block mt-0.5">
                DQN {comparisonResult.summary.dqn_energy_kwh.toFixed(2)} kWh vs Base{' '}
                {comparisonResult.summary.baseline_energy_kwh.toFixed(2)} kWh
              </span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                Comfort Compliance (23–27°C)
              </span>
              <span className="text-2xl font-bold text-sky-950 font-mono">
                {comparisonResult.summary.dqn_comfort_compliance_pct.toFixed(1)}%
              </span>
              <span className="text-[10px] text-sky-700 block mt-0.5">
                Baseline Compliance: {comparisonResult.summary.baseline_comfort_compliance_pct.toFixed(1)}%
              </span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                Mean Indoor Temperature
              </span>
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {comparisonResult.summary.dqn_mean_temp_c.toFixed(1)}°C
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Baseline Mean: {comparisonResult.summary.baseline_mean_temp_c.toFixed(1)}°C
              </span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                Mean Control Reward
              </span>
              <span className="text-2xl font-bold text-sky-950 font-mono">
                {comparisonResult.summary.dqn_mean_reward.toFixed(2)}
              </span>
              <span className="text-[10px] text-sky-700 block mt-0.5">
                Baseline Mean: {comparisonResult.summary.baseline_mean_reward.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Upgraded Trajectory Chart */}
          {renderTrajectoryChart()}


        </div>
      ) : (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl space-y-2">
          <BarChart2 className="w-8 h-8 text-sky-400 mx-auto" />
          <p className="text-xs text-slate-500">
            Click &ldquo;Run Comparative Evaluation&rdquo; to execute a 24-step side-by-side rollout of the DQN agent against a conventional commercial thermostat on the configured office zone.
          </p>
        </div>
      )}
    </div>
  );
};
