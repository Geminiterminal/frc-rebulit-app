import React, { useRef, useState, useEffect } from 'react';
import { AutonomousDrawing, DrawingPath, DrawingPoint, StartPosition } from '../../types/scouting';
import { RebuiltFieldSvg } from './RebuiltFieldSvg';
import { pointsToSmoothSvgPath } from '../../utils/drawingUtils';
import { 
  Undo2, 
  Trash2, 
  PenTool, 
  MapPin, 
  Compass
} from 'lucide-react';

interface AutonomousDrawerProps {
  drawing?: AutonomousDrawing;
  onSave?: (drawing: AutonomousDrawing) => void;
  readOnly?: boolean;
}

const PATH_COLORS = [
  { label: 'Drive', value: '#60a5fa', type: 'path' as const },
  { label: 'Intake', value: '#f59e0b', type: 'intake' as const },
  { label: 'Shoot', value: '#f87171', type: 'shoot' as const },
];

export const AutonomousDrawer: React.FC<AutonomousDrawerProps> = ({
  drawing,
  onSave,
  readOnly = false,
}) => {
  const [paths, setPaths] = useState<DrawingPath[]>(drawing?.paths || []);
  const [history, setHistory] = useState<DrawingPath[][]>([drawing?.paths || []]);
  const [historyStep, setHistoryStep] = useState<number>(0);

  const [startPos, setStartPos] = useState<StartPosition | undefined>(
    drawing?.startPosition || { x: 50, y: 15, angle: 180, label: 'Start' }
  );

  const [activeTool, setActiveTool] = useState<'draw' | 'start-pos'>('draw');
  const [selectedColor, setSelectedColor] = useState<string>('#60a5fa');
  const [currentPathType, setCurrentPathType] = useState<'path' | 'intake' | 'shoot'>('path');

  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentPointsRef = useRef<DrawingPoint[]>([]);
  const [activeSegmentPoints, setActiveSegmentPoints] = useState<DrawingPoint[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (drawing) {
      setPaths(drawing.paths || []);
      setHistory([drawing.paths || []]);
      setHistoryStep(0);
      setStartPos(drawing.startPosition);
    }
  }, [drawing]);

  const getCoordinates = (
    e: React.PointerEvent<SVGElement>
  ): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();

    const clientX = e.clientX;
    const clientY = e.clientY;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(100, Math.round(y * 10) / 10)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (readOnly) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const coords = getCoordinates(e);
    if (!coords) return;

    if (activeTool === 'start-pos') {
      const updatedPos: StartPosition = {
        x: coords.x,
        y: coords.y,
        angle: startPos ? startPos.angle : 180,
        label: 'Start',
      };
      setStartPos(updatedPos);
      if (onSave) {
        onSave({
          id: drawing?.id || `auto-${Date.now()}`,
          name: 'Autonomous Routine',
          createdAt: Date.now(),
          startPosition: updatedPos,
          paths,
        });
      }
      return;
    }

    if (activeTool === 'draw') {
      setIsDrawing(true);
      currentPointsRef.current = [coords];
      setActiveSegmentPoints([coords]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGElement>) => {
    if (readOnly || !isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const points = currentPointsRef.current;
    const last = points[points.length - 1];
    // Smooth micro-distance filter
    if (last && Math.hypot(last.x - coords.x, last.y - coords.y) < 0.25) {
      return;
    }

    points.push(coords);
    setActiveSegmentPoints([...points]);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGElement>) => {
    if (readOnly || !isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(false);

    if (currentPointsRef.current.length >= 2) {
      const newPath: DrawingPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        color: selectedColor,
        width: 3.5,
        type: currentPathType,
        points: [...currentPointsRef.current],
      };

      const updated = [...paths, newPath];
      setPaths(updated);

      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(updated);
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);

      if (onSave) {
        onSave({
          id: drawing?.id || `auto-${Date.now()}`,
          name: 'Autonomous Routine',
          createdAt: Date.now(),
          startPosition: startPos,
          paths: updated,
        });
      }
    }

    currentPointsRef.current = [];
    setActiveSegmentPoints([]);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setPaths(history[prevStep]);
      if (onSave) {
        onSave({
          id: drawing?.id || `auto-${Date.now()}`,
          name: 'Autonomous Routine',
          createdAt: Date.now(),
          startPosition: startPos,
          paths: history[prevStep],
        });
      }
    }
  };

  const handleClear = () => {
    setPaths([]);
    setHistory([[]]);
    setHistoryStep(0);
    setActiveSegmentPoints([]);
    currentPointsRef.current = [];
    setIsDrawing(false);
    if (onSave) {
      onSave({
        id: drawing?.id || `auto-${Date.now()}`,
        name: 'Autonomous Routine',
        createdAt: Date.now(),
        startPosition: startPos,
        paths: [],
      });
    }
  };

  const rotateStartHeading = () => {
    if (!startPos) return;
    const angles = [0, 90, 180, 270];
    const currIdx = angles.indexOf(startPos.angle);
    const nextAngle = angles[(currIdx + 1) % angles.length];
    const updated = { ...startPos, angle: nextAngle };
    setStartPos(updated);
    if (onSave) {
      onSave({
        id: drawing?.id || `auto-${Date.now()}`,
        name: 'Autonomous Routine',
        createdAt: Date.now(),
        startPosition: updated,
        paths,
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Simple, intuitive toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTool('draw')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTool === 'draw'
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('start-pos')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTool === 'start-pos'
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Start</span>
            </button>

            {startPos && (
              <button
                type="button"
                onClick={rotateStartHeading}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 cursor-pointer"
                title="Rotate heading"
              >
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                <span>{startPos.angle}°</span>
              </button>
            )}

            {/* Subdued Colors */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
              {PATH_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setSelectedColor(c.value);
                    setCurrentPathType(c.type);
                    setActiveTool('draw');
                  }}
                  className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                    selectedColor === c.value && activeTool === 'draw'
                      ? 'scale-125 border-slate-200 ring-1 ring-slate-400'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Undo & Erase All */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-900 disabled:opacity-30 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
              title="Undo last stroke"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900/60 transition-colors cursor-pointer"
              title="Erase all paths"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Erase All</span>
            </button>
          </div>
        </div>
      )}

      {/* Field Drawing Canvas */}
      <div className="relative max-w-sm mx-auto w-full select-none touch-none">
        <RebuiltFieldSvg className="w-full">
          {/* Interactive Capture Layer */}
          <rect
            ref={(el) => {
              if (el && !svgRef.current) svgRef.current = el.ownerSVGElement;
            }}
            width="500"
            height="1000"
            fill="transparent"
            className={readOnly ? '' : activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-pointer'}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          {/* Render Completed Paths with smooth quadratic curve interpolation */}
          {paths.map((p) => {
            const d = pointsToSmoothSvgPath(p.points);
            const endPt = p.points[p.points.length - 1];
            const ex = (endPt.x / 100) * 500;
            const ey = (endPt.y / 100) * 1000;

            return (
              <g key={p.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={p.width + 2}
                  strokeOpacity="0.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={p.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={ex} cy={ey} r={p.width + 1} fill={p.color} stroke="#0f172a" strokeWidth="1" />
              </g>
            );
          })}

          {/* Active Drawing Segment with smooth rendering */}
          {isDrawing && activeSegmentPoints.length > 0 && (
            <path
              d={pointsToSmoothSvgPath(activeSegmentPoints)}
              fill="none"
              stroke={selectedColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Robot Starting Position Marker */}
          {startPos && (
            <g
              transform={`translate(${(startPos.x / 100) * 500}, ${(startPos.y / 100) * 1000}) rotate(${
                startPos.angle
              })`}
            >
              <rect
                x="-14"
                y="-14"
                width="28"
                height="28"
                rx="4"
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <polygon points="0,-10 -5,-3 5,-3" fill="#cbd5e1" />
              <circle cx="0" cy="0" r="3" fill="#cbd5e1" />
            </g>
          )}
        </RebuiltFieldSvg>
      </div>
    </div>
  );
};
