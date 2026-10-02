'use client';

import React, { useState } from 'react';
import { Activity, Zap, TrendingUp } from 'lucide-react';
import { TrajectoryStepLog } from '@/lib/types';

interface SimulationChartProps {
  history: TrajectoryStepLog[];
}

export const SimulationChart: React.FC<SimulationChartProps> = ({ history }) => {
  const [activeTab, setActiveTab] = useState<'temp' | 'power'>('temp');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs py-14 shadow-xs">
        No simulation data recorded yet. Click &quot;Execute Simulation Step&quot;, &quot;Run 24h Simulation&quot;, or upload a dataset to begin.
      </div>
    );
  }

  // Active inspected point: hovered point takes priority, then clicked/selected point
  const activeIndex = hoveredIndex !== null
    ? hoveredIndex
    : selectedIndex;
  const activePoint = activeIndex !== null && activeIndex < history.length ? history[activeIndex] : null;

  // Calculate SVG bounds
  const temps = history.flatMap((h) => [h.T_in, h.T_out, 23, 27]);
  const minTemp = Math.floor(Math.min(...temps)) - 1;
  const maxTemp = Math.ceil(Math.max(...temps)) + 1;
  const tempRange = maxTemp - minTemp || 1;

  const powers = history.map((h) => h.power_watts);
  const maxPower = Math.max(100, ...powers) * 1.15;

  const width = 800;
  const height = 240;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const getX = (index: number) => {
    if (history.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (history.length - 1)) * graphWidth;
  };

  const getYTemp = (val: number) => {
    return padding.top + (1 - (val - minTemp) / tempRange) * graphHeight;
  };

  const getYPower = (val: number) => {
    return padding.top + (1 - val / maxPower) * graphHeight;
  };

  const tInPoints = history.map((h, i) => `${getX(i)},${getYTemp(h.T_in)}`).join(' ');
  const tOutPoints = history.map((h, i) => `${getX(i)},${getYTemp(h.T_out)}`).join(' ');
  const powerPoints = history.map((h, i) => `${getX(i)},${getYPower(h.power_watts)}`).join(' ');

  // Comfort band (23°C to 27°C)
  const comfortTopY = getYTemp(27.0);
  const comfortBottomY = getYTemp(23.0);
  const comfortBandPolygon = `
    ${padding.left},${comfortTopY}
    ${width - padding.right},${comfortTopY}
    ${width - padding.right},${comfortBottomY}
    ${padding.left},${comfortBottomY}
  `;

  const modeNames: Record<number, string> = {
    1: 'Cooling',
    2: 'Heating',
    3: 'Ventilation',
  };

  // Active point coordinates for Power BI speech bubble
  let activeCx = 0;
  let activeCy = 0;
  let leftPct = 0;
  let topPct = 0;
  let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';

  if (activePoint && activeIndex !== null) {
    activeCx = getX(activeIndex);
    activeCy = activeTab === 'temp' ? getYTemp(activePoint.T_in) : getYPower(activePoint.power_watts);
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
      {/* Header Centered */}
      <div className="flex flex-col sm:flex-row items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center space-x-2 text-sky-700 font-semibold">
            <TrendingUp className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-semibold text-slate-900">Thermal Dynamics & Power Trajectory</h2>
          </div>
        </div>

        {/* View Switcher Centered */}
        <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('temp')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'temp'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Thermal Response</span>
          </button>
          <button
            onClick={() => setActiveTab('power')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'power'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Power Load Curve</span>
          </button>
        </div>
      </div>

      {/* SVG Interactive Graphic Container */}
      <div
        className="w-full relative bg-slate-50/50 rounded-xl p-2 border border-slate-100"
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
              />
            );
          })}

          {/* Vertical Selected Step Highlight Line */}
          {activePoint && activeIndex !== null && (
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
              {/* Comfort Zone Shaded Band (23-27°C) */}
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

              {/* T_out line */}
              <polyline
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="4 4"
                points={tOutPoints}
              />

              {/* T_in line */}
              <polyline fill="none" stroke="#0284c7" strokeWidth="2.5" points={tInPoints} />

              {/* Data points */}
              {history.map((h, i) => {
                const cx = getX(i);
                const cy = getYTemp(h.T_in);
                const isActive = i === activeIndex;

                return (
                  <g key={i}>
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
              <text x={padding.left - 8} y={getYTemp(25) + 3} textAnchor="end" fill="#0284c7" fontWeight="bold" fontSize="10">
                25°C
              </text>
              <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" fill="#64748b" fontSize="10">
                {minTemp}°C
              </text>
            </>
          ) : (
            <>
              {/* Power line */}
              <polyline fill="none" stroke="#0284c7" strokeWidth="2.5" points={powerPoints} />
              {history.map((h, i) => {
                const cx = getX(i);
                const cy = getYPower(h.power_watts);
                const isActive = i === activeIndex;

                return (
                  <g key={i}>
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
          {history.map((h, i) => {
            if (i % Math.ceil(history.length / 6) === 0 || i === history.length - 1) {
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 12}
                  textAnchor="middle"
                  fill={i === activeIndex ? '#0284c7' : '#64748b'}
                  fontWeight={i === activeIndex ? 'bold' : 'normal'}
                  fontSize="10"
                >
                  {h.time_label || `S${h.step}`}
                </text>
              );
            }
            return null;
          })}

          {/* Interactive Column Hover / Click Slices (Power BI Style scrubbing) */}
          {history.map((_, i) => {
            const sliceWidth = graphWidth / Math.max(1, history.length - 1);
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

        {/* Floating Power BI Speech-Bubble Callout */}
        {activePoint && (
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
            <div className="relative bg-white border border-sky-300 rounded-xl shadow-lg p-0 min-w-[215px] max-w-[250px] overflow-hidden text-xs">
              {/* Speech-Bubble Header */}
              <div className="bg-sky-50 px-3 py-1.5 border-b border-sky-100 flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-800 text-[11px] truncate">
                  {activePoint.time_label || `Step ${activePoint.step}`}
                </div>
                {activePoint.is_comfort ? (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Comfortable
                  </span>
                ) : (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Out of Band
                  </span>
                )}
              </div>

              {/* Speech-Bubble Content Rows */}
              <div className="p-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Indoor Temp:</span>
                  <span className="font-mono font-bold text-sky-700">{activePoint.T_in.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ambient Temp:</span>
                  <span className="font-mono font-semibold text-slate-700">{activePoint.T_out.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Power Demand:</span>
                  <span className="font-mono font-bold text-slate-800">{activePoint.power_watts.toFixed(0)} W</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Occupancy:</span>
                  <span className="font-mono text-slate-700">{activePoint.Occupancy.toFixed(0)} persons</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-500">AC Command:</span>
                  <span className="font-semibold text-slate-800 text-[10.5px]">
                    {activePoint.action.source === 1 ? 'ON' : 'OFF'} • {modeNames[activePoint.action.mode] || 'Cool'} • {activePoint.action.target_temp}°C
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Step Reward:</span>
                  <span className="font-mono font-semibold text-sky-800">{activePoint.reward.toFixed(3)}</span>
                </div>
              </div>

              {/* Speech-Bubble Pointer Arrow Tail */}
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

      {/* Legend Centered at Bottom */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs text-slate-600">
        {activeTab === 'temp' ? (
          <>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-1 bg-sky-600 rounded-full" />
              <span>Indoor Temperature (T_in)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-1 bg-slate-400 rounded-full border border-slate-400" />
              <span>Ambient Disturbance (T_out)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-sky-100 border border-sky-300 rounded" />
              <span>Target Comfort Band (23°C – 27°C)</span>
            </span>
          </>
        ) : (
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-1 bg-sky-600 rounded-full" />
            <span>HVAC Electrical Load (Watts)</span>
          </span>
        )}

        <span className="text-slate-400">
          Recorded Steps: <strong className="text-slate-800 font-mono">{history.length}</strong>
        </span>
      </div>
    </div>
  );
};
