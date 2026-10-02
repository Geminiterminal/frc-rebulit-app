import React, { useState, useEffect, useRef } from 'react';
import { TeamProfile, StrategyPlan, StrategyRobotToken, DrawingPath, DrawingPoint } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { RebuiltFieldSvg } from '../common/RebuiltFieldSvg';
import { pointsToSmoothSvgPath } from '../../utils/drawingUtils';
import { 
  ArrowLeft,
  MapPin, 
  PenTool, 
  Trash2, 
  Undo2, 
  Save, 
  Check
} from 'lucide-react';

interface StrategyFieldProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const StrategyField: React.FC<StrategyFieldProps> = ({ onNavigate }) => {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [blueTeams, setBlueTeams] = useState<number[]>([0, 0, 0]);
  const [redTeams, setRedTeams] = useState<number[]>([0, 0, 0]);

  // Overlay toggles (clean slate by default)
  const [showAutoPaths, setShowAutoPaths] = useState<boolean>(false);
  const [showShootingZones, setShowShootingZones] = useState<boolean>(false);

  // Drawing tool
  const [activeTool, setActiveTool] = useState<'draw' | 'tokens'>('tokens');
  const [drawColor, setDrawColor] = useState<string>('#cbd5e1');
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentPointsRef = useRef<DrawingPoint[]>([]);
  const [activeSegmentPoints, setActiveSegmentPoints] = useState<DrawingPoint[]>([]);

  // Robot tokens
  const [tokens, setTokens] = useState<StrategyRobotToken[]>([
    { id: 'b1', teamNumber: 0, alliance: 'BLUE', x: 78, y: 22, role: 'Scorer', label: 'B1' },
    { id: 'b2', teamNumber: 0, alliance: 'BLUE', x: 50, y: 22, role: 'Scorer', label: 'B2' },
    { id: 'b3', teamNumber: 0, alliance: 'BLUE', x: 22, y: 22, role: 'Support', label: 'B3' },
    { id: 'r1', teamNumber: 0, alliance: 'RED', x: 78, y: 78, role: 'Scorer', label: 'R1' },
    { id: 'r2', teamNumber: 0, alliance: 'RED', x: 50, y: 78, role: 'Scorer', label: 'R2' },
    { id: 'r3', teamNumber: 0, alliance: 'RED', x: 22, y: 78, role: 'Defense', label: 'R3' },
  ]);

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [strategyNotes, setStrategyNotes] = useState<string>('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  // Sync token team numbers when team selection inputs change
  useEffect(() => {
    setTokens((prev) =>
      prev.map((t) => {
        if (t.id === 'b1') return { ...t, teamNumber: blueTeams[0] || t.teamNumber };
        if (t.id === 'b2') return { ...t, teamNumber: blueTeams[1] || t.teamNumber };
        if (t.id === 'b3') return { ...t, teamNumber: blueTeams[2] || t.teamNumber };
        if (t.id === 'r1') return { ...t, teamNumber: redTeams[0] || t.teamNumber };
        if (t.id === 'r2') return { ...t, teamNumber: redTeams[1] || t.teamNumber };
        if (t.id === 'r3') return { ...t, teamNumber: redTeams[2] || t.teamNumber };
        return t;
      })
    );
  }, [blueTeams, redTeams]);

  const loadTeams = async () => {
    const all = await scoutingDB.getAllTeams();
    setTeams(all);
    if (all.length >= 3) {
      setBlueTeams([all[0].teamNumber, all[1]?.teamNumber || all[0].teamNumber, all[2]?.teamNumber || all[0].teamNumber]);
    }
  };

  const getCoordinatesFromClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(3, Math.min(97, x)),
      y: Math.max(3, Math.min(97, y)),
    };
  };

  const getCoordinates = (e: React.PointerEvent<SVGElement>) => {
    return getCoordinatesFromClient(e.clientX, e.clientY);
  };

  // Direct Token Drag Handlers
  const handleTokenPointerDown = (tokenId: string, e: React.PointerEvent<SVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    setDraggedTokenId(tokenId);
    setSelectedTokenId(tokenId);
  };

  const handleTokenPointerMove = (tokenId: string, e: React.PointerEvent<SVGElement>) => {
    if (draggedTokenId !== tokenId) return;
    const coords = getCoordinatesFromClient(e.clientX, e.clientY);
    if (!coords) return;

    setTokens((prev) =>
      prev.map((t) => (t.id === tokenId ? { ...t, x: coords.x, y: coords.y } : t))
    );
  };

  const handleTokenPointerUp = (tokenId: string, e: React.PointerEvent<SVGElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setDraggedTokenId(null);
  };

  // Canvas background handlers for drawing and placing
  const handleCanvasPointerDown = (e: React.PointerEvent<SVGElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    if (activeTool === 'tokens') {
      const clickedToken = tokens.find((t) => Math.hypot(t.x - coords.x, t.y - coords.y) < 8);
      if (clickedToken) {
        setSelectedTokenId(clickedToken.id);
        setDraggedTokenId(clickedToken.id);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else if (selectedTokenId) {
        setTokens((prev) =>
          prev.map((t) => (t.id === selectedTokenId ? { ...t, x: coords.x, y: coords.y } : t))
        );
        setDraggedTokenId(selectedTokenId);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }
      return;
    }

    if (activeTool === 'draw') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      setIsDrawing(true);
      currentPointsRef.current = [coords];
      setActiveSegmentPoints([coords]);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<SVGElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    if (draggedTokenId) {
      setTokens((prev) =>
        prev.map((t) => (t.id === draggedTokenId ? { ...t, x: coords.x, y: coords.y } : t))
      );
      return;
    }

    if (activeTool === 'draw' && isDrawing) {
      const points = currentPointsRef.current;
      const last = points[points.length - 1];
      if (last && Math.hypot(last.x - coords.x, last.y - coords.y) < 0.2) return;
      points.push(coords);
      setActiveSegmentPoints([...points]);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<SVGElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (draggedTokenId) {
      setDraggedTokenId(null);
      return;
    }

    if (activeTool === 'draw' && isDrawing) {
      setIsDrawing(false);
      if (currentPointsRef.current.length >= 2) {
        const newPath: DrawingPath = {
          id: `draw-${Date.now()}`,
          color: drawColor,
          width: 3.5,
          type: 'path',
          points: [...currentPointsRef.current],
        };
        setDrawings((prev) => [...prev, newPath]);
      }
      currentPointsRef.current = [];
      setActiveSegmentPoints([]);
    }
  };

  const handleEraseAll = () => {
    setDrawings([]);
    currentPointsRef.current = [];
    setActiveSegmentPoints([]);
    setIsDrawing(false);
    setShowAutoPaths(false);
    setShowShootingZones(false);
  };

  const handleUndo = () => {
    setDrawings(drawings.slice(0, -1));
  };

  const handleSaveStrategy = async () => {
    const plan: StrategyPlan = {
      id: `strategy-${Date.now()}`,
      name: `Match Strategy`,
      redTeams,
      blueTeams,
      tokens,
      drawings,
      notes: strategyNotes,
      updatedAt: Date.now(),
    };
    await scoutingDB.saveStrategy(plan);
    setSaveToast('Saved');
    setTimeout(() => setSaveToast(null), 1200);
  };

  const blueProfiles = blueTeams.map((n) => teams.find((t) => t.teamNumber === n)).filter(Boolean) as TeamProfile[];

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 pb-24 flex flex-col gap-3">
      {/* Sleek Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Compact Alliance Selectors */}
        <div className="flex items-center gap-2 text-xs">
          {/* Blue team inputs */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="font-bold text-slate-400 text-[11px] mr-0.5">B:</span>
            {[0, 1, 2].map((slot) => (
              <input
                key={`b-${slot}`}
                type="number"
                value={blueTeams[slot] || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  const updated = [...blueTeams];
                  updated[slot] = val;
                  setBlueTeams(updated);
                }}
                className="w-11 text-center bg-slate-900 border border-slate-800 rounded px-0.5 py-0.5 font-mono font-bold text-slate-200 text-xs focus:outline-none"
              />
            ))}
          </div>

          {/* Red team inputs */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="font-bold text-slate-400 text-[11px] mr-0.5">R:</span>
            {[0, 1, 2].map((slot) => (
              <input
                key={`r-${slot}`}
                type="number"
                value={redTeams[slot] || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  const updated = [...redTeams];
                  updated[slot] = val;
                  setRedTeams(updated);
                }}
                className="w-11 text-center bg-slate-900 border border-slate-800 rounded px-0.5 py-0.5 font-mono font-bold text-slate-200 text-xs focus:outline-none"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveStrategy}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase shadow transition-colors active:scale-95 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>

      {/* Clean Streamlined Toolbar */}
      <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs">
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
            onClick={() => setActiveTool('tokens')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTool === 'tokens'
                ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Robots</span>
          </button>

          {activeTool === 'draw' && (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
              {['#cbd5e1', '#60a5fa', '#f87171', '#fbbf24', '#4ade80'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDrawColor(color)}
                  className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                    drawColor === color ? 'scale-125 border-slate-200 ring-1 ring-slate-400' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Undo, Erase All, and Overlays */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={drawings.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-900 disabled:opacity-30 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleEraseAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900/60 transition-colors cursor-pointer"
            title="Erase all drawings"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Erase All</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAutoPaths(!showAutoPaths)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              showAutoPaths ? 'bg-slate-800 text-slate-200 border border-slate-600' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Autos
          </button>
          <button
            type="button"
            onClick={() => setShowShootingZones(!showShootingZones)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              showShootingZones ? 'bg-slate-800 text-slate-200 border border-slate-600' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Zones
          </button>
        </div>
      </div>

      {/* Field Canvas Display */}
      <div className="relative max-w-sm mx-auto w-full select-none touch-none">
        <RebuiltFieldSvg className="w-full">
          {/* Interaction capture layer */}
          <rect
            ref={(el) => {
              if (el && !svgRef.current) svgRef.current = el.ownerSVGElement;
            }}
            width="500"
            height="1000"
            fill="transparent"
            className={activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          />

          {/* OVERLAY: Teams' Pit Shooting Zones */}
          {showShootingZones &&
            blueProfiles.map((p, pIdx) => {
              const colors = ['#38bdf8', '#818cf8', '#c084fc'];
              const color = colors[pIdx % colors.length];
              return (
                <g key={`zones-p-${p.teamNumber}`}>
                  {p.pit?.shootingAreas?.map((z) => {
                    const sx = (z.x / 100) * 500;
                    const sy = (z.y / 100) * 1000;
                    return (
                      <g key={`sz-${p.teamNumber}-${z.id}`}>
                        <circle cx={sx} cy={sy} r="18" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
                        <circle cx={sx} cy={sy} r="4" fill={color} />
                      </g>
                    );
                  })}
                </g>
              );
            })}

          {/* OVERLAY: Teams' Autonomous Routine Paths with smooth quadratic curves */}
          {showAutoPaths &&
            blueProfiles.map((p, pIdx) => {
              const pathColor = pIdx === 0 ? '#3b82f6' : pIdx === 1 ? '#eab308' : '#10b981';
              const routine = p.pit?.autoDrawings?.[0];
              if (!routine) return null;

              return (
                <g key={`auto-overlay-${p.teamNumber}`}>
                  {routine.paths?.map((path) => (
                    <path
                      key={path.id}
                      d={pointsToSmoothSvgPath(path.points)}
                      fill="none"
                      stroke={pathColor}
                      strokeWidth="3.5"
                      strokeDasharray="6 3"
                      strokeLinecap="round"
                    />
                  ))}
                  {routine.startPosition && (
                    <circle
                      cx={(routine.startPosition.x / 100) * 500}
                      cy={(routine.startPosition.y / 100) * 1000}
                      r="8"
                      fill={pathColor}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  )}
                </g>
              );
            })}

          {/* User whiteboard drawings with smooth quadratic curves */}
          {drawings.map((d) => (
            <path
              key={d.id}
              d={pointsToSmoothSvgPath(d.points)}
              fill="none"
              stroke={d.color}
              strokeWidth={d.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Active drawing stroke with smooth curve */}
          {isDrawing && activeSegmentPoints.length > 0 && (
            <path
              d={pointsToSmoothSvgPath(activeSegmentPoints)}
              fill="none"
              stroke={drawColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Robot Tokens (R1..3, B1..3) with Ultra-Smooth Dragging */}
          {tokens.map((token) => {
            const tx = (token.x / 100) * 500;
            const ty = (token.y / 100) * 1000;
            const isBlue = token.alliance === 'BLUE';
            const isSelected = selectedTokenId === token.id;
            const isDragging = draggedTokenId === token.id;

            return (
              <g
                key={token.id}
                transform={`translate(${tx}, ${ty})`}
                style={{ touchAction: 'none' }}
                className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                onPointerDown={(e) => handleTokenPointerDown(token.id, e)}
                onPointerMove={(e) => handleTokenPointerMove(token.id, e)}
                onPointerUp={(e) => handleTokenPointerUp(token.id, e)}
                onPointerCancel={(e) => handleTokenPointerUp(token.id, e)}
              >
                {/* Hit area target for effortless grabbing on finger touch */}
                <circle r="28" fill="transparent" />

                {/* Selected / Dragging Aura Ring */}
                {(isSelected || isDragging) && (
                  <circle
                    r={isDragging ? '24' : '22'}
                    fill="none"
                    stroke={isBlue ? '#60a5fa' : '#f87171'}
                    strokeWidth="2"
                    strokeDasharray={isDragging ? 'none' : '4 2'}
                    className="animate-pulse"
                  />
                )}

                {/* Main Token Body */}
                <circle
                  r={isDragging ? '20' : isSelected ? '19' : '17'}
                  fill={isBlue ? '#1d4ed8' : '#b91c1c'}
                  stroke={isSelected || isDragging ? '#ffffff' : isBlue ? '#60a5fa' : '#f87171'}
                  strokeWidth={isSelected || isDragging ? '2.5' : '1.5'}
                  filter="url(#tokenShadow)"
                />

                {/* Token identifier (e.g. B1, B2, R1) */}
                <text
                  textAnchor="middle"
                  dy="4.5"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="900"
                  className="select-none pointer-events-none"
                >
                  {token.id.toUpperCase()}
                </text>

                {/* Team number badge under token */}
                <g transform="translate(0, 25)" className="select-none pointer-events-none">
                  <rect
                    x="-18"
                    y="-7"
                    width="36"
                    height="13"
                    rx="3"
                    fill="#020617"
                    fillOpacity="0.85"
                    stroke="#334155"
                    strokeWidth="0.8"
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill="#e2e8f0"
                    fontSize="8"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {token.teamNumber && token.teamNumber > 0 ? token.teamNumber : '--'}
                  </text>
                </g>
              </g>
            );
          })}
        </RebuiltFieldSvg>
      </div>

      {/* Quick Notes */}
      <input
        type="text"
        value={strategyNotes}
        onChange={(e) => setStrategyNotes(e.target.value)}
        placeholder="Strategy note..."
        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 font-mono"
      />

      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-lg shadow-xl flex items-center gap-1.5">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
};
