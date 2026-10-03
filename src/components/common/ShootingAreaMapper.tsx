import React from 'react';
import { ShootingZonePoint } from '../../types/scouting';
import { RebuiltFieldSvg } from './RebuiltFieldSvg';
import { Trash2 } from 'lucide-react';

interface ShootingAreaMapperProps {
  zones: ShootingZonePoint[];
  onChange: (zones: ShootingZonePoint[]) => void;
  readOnly?: boolean;
  isHidden?: boolean;
}

export const ShootingAreaMapper: React.FC<ShootingAreaMapperProps> = ({
  zones,
  onChange,
  readOnly = false,
  isHidden = false,
}) => {
  if (isHidden) return null;
  // Convert pointer coordinates to percentage (0 - 100)
  const handlePointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (readOnly) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();

    const clientX = e.clientX;
    const clientY = e.clientY;

    const clickX = ((clientX - rect.left) / rect.width) * 100;
    const clickY = ((clientY - rect.top) / rect.height) * 100;

    // Check if clicked close to an existing zone (within 6%), if so, remove it
    const existingIndex = zones.findIndex((z) => {
      const dist = Math.hypot(z.x - clickX, z.y - clickY);
      return dist < 6;
    });

    if (existingIndex >= 0) {
      onChange(zones.filter((_, i) => i !== existingIndex));
    } else {
      const newPoint: ShootingZonePoint = {
        id: `z-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        x: Math.round(clickX * 10) / 10,
        y: Math.round(clickY * 10) / 10,
      };
      onChange([...zones, newPoint]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Minimal Header */}
      {!readOnly && zones.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900/60 text-xs transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Erase All</span>
          </button>
        </div>
      )}

      {/* Field Container */}
      <div className="relative max-w-sm mx-auto w-full select-none touch-none">
        <RebuiltFieldSvg className="w-full">
          {/* Clickable transparent overlay */}
          <rect
            width="500"
            height="1000"
            fill="transparent"
            className={readOnly ? '' : 'cursor-crosshair'}
            onPointerDown={handlePointerDown}
          />

          {/* Render Shooting Zones */}
          {zones.map((zone) => {
            const svgX = (zone.x / 100) * 500;
            const svgY = (zone.y / 100) * 1000;
            return (
              <g key={zone.id}>
                {/* Outer soft ring */}
                <circle
                  cx={svgX}
                  cy={svgY}
                  r="20"
                  fill="#38bdf8"
                  fillOpacity="0.15"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                {/* Core target */}
                <circle
                  cx={svgX}
                  cy={svgY}
                  r="8"
                  fill="#0369a1"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                <circle cx={svgX} cy={svgY} r="2" fill="#ffffff" />
              </g>
            );
          })}
        </RebuiltFieldSvg>
      </div>
    </div>
  );
};
