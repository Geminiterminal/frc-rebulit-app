import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord, DrivetrainType, ShooterType, BumpTrenchCapability } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  Trophy, 
  ArrowUpDown, 
  Filter, 
  Eye, 
  Layers, 
  CheckSquare, 
  Square, 
  Edit3, 
  Check, 
  X, 
  ChevronUp, 
  ChevronDown, 
  GripVertical, 
  RotateCcw, 
  UserX, 
  UserCheck, 
  ChevronRight,
  Ban,
  SlidersHorizontal,
  RotateCw
} from 'lucide-react';

interface PicklistViewProps {
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
}

export type SortOption = 
  | 'preferenceRank'
  | 'officialRank'
  | 'stateRank'
  | 'totalFuel' 
  | 'autoSuccess' 
  | 'autoFuel' 
  | 'reliability' 
  | 'defense' 
  | 'defenseEffectiveness' 
  | 'matchesScouted';

interface EnrichedTeam {
  team: TeamProfile;
  teamNumber: number;
  teamName: string;
  matchesCount: number;
  autoSuccessRatio: number;
  autoSuccessStr: string;
  avgAutoFuel: number;
  avgTeleopFuel: number;
  avgTotalFuel: number;
  reliabilityVal: number;
  reliabilityLabel: string;
  defenseVal: number;
  defenseLabel: string;
  officialRank?: number;
  stateRank?: number;
  customPicklistRank?: number;
  isUnavailable: boolean;
}

export const PicklistView: React.FC<PicklistViewProps> = ({ onNavigate }) => {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('preferenceRank');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>([]);
  const [separateUnavailable, setSeparateUnavailable] = useState<boolean>(true);
  const [isUnavailableCollapsed, setIsUnavailableCollapsed] = useState<boolean>(false);

  // Advanced Filter Variables State
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [filterDrivetrain, setFilterDrivetrain] = useState<string>('ALL');
  const [filterShooter, setFilterShooter] = useState<string>('ALL');
  const [filterCapability, setFilterCapability] = useState<string>('ALL');
  const [filterReliability, setFilterReliability] = useState<string>('ALL');
  const [filterDefense, setFilterDefense] = useState<string>('ALL');
  const [filterAuto, setFilterAuto] = useState<string>('ALL');

  // Manual rank editing state (Event Rank or State Rank)
  const [editingRankTeamNum, setEditingRankTeamNum] = useState<number | null>(null);
  const [editingRankType, setEditingRankType] = useState<'official' | 'state' | 'preference' | null>(null);
  const [tempRankValue, setTempRankValue] = useState<string>('');

  // Drag and drop state
  const [draggedTeamNum, setDraggedTeamNum] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allTeams = await scoutingDB.getAllTeams();
    const allMatches = await scoutingDB.getAllMatches();

    // Check if teams need customPicklistRank initialization
    const needsInit = allTeams.some((t) => typeof t.customPicklistRank !== 'number');
    if (needsInit && allTeams.length > 0) {
      // Sort initially by officialRank (if available) or avg fuel / teamNumber
      const sorted = [...allTeams].sort((a, b) => {
        const rA = a.officialRank ?? 9999;
        const rB = b.officialRank ?? 9999;
        if (rA !== rB) return rA - rB;
        return a.teamNumber - b.teamNumber;
      });

      const initialized = sorted.map((t, idx) => ({
        ...t,
        customPicklistRank: t.customPicklistRank ?? idx + 1,
      }));

      await scoutingDB.saveTeamsBatch(initialized);
      setTeams(initialized);
    } else {
      setTeams(allTeams);
    }

    setMatches(allMatches);
  };

  // Toggle availability (crossed off / picked by other alliance)
  const handleToggleUnavailable = async (teamNum: number, currentStatus: boolean) => {
    const target = teams.find((t) => t.teamNumber === teamNum);
    if (!target) return;

    const updated = {
      ...target,
      isUnavailable: !currentStatus,
      updatedAt: Date.now(),
    };

    setTeams((prev) => prev.map((t) => (t.teamNumber === teamNum ? updated : t)));
    await scoutingDB.saveTeam(updated);
  };

  // Clear all unavailable (reset alliance selection)
  const handleResetAllAvailability = async () => {
    const updated = teams.map((t) => ({
      ...t,
      isUnavailable: false,
      updatedAt: Date.now(),
    }));
    setTeams(updated);
    await scoutingDB.saveTeamsBatch(updated);
  };

  // Move a team up or down in custom preference ranking
  const handleMovePreference = async (teamNum: number, direction: 'UP' | 'DOWN') => {
    const activeTeams = [...teams].sort((a, b) => (a.customPicklistRank ?? 9999) - (b.customPicklistRank ?? 9999));
    const currentIndex = activeTeams.findIndex((t) => t.teamNumber === teamNum);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeTeams.length) return;

    const currentTeam = activeTeams[currentIndex];
    const targetTeam = activeTeams[targetIndex];

    const currentRank = currentTeam.customPicklistRank ?? currentIndex + 1;
    const targetRank = targetTeam.customPicklistRank ?? targetIndex + 1;

    currentTeam.customPicklistRank = targetRank;
    targetTeam.customPicklistRank = currentRank;

    const updated = [...teams];
    setTeams(updated);
    await scoutingDB.saveTeamsBatch([currentTeam, targetTeam]);
  };

  // Set specific custom rank directly
  const handleSetCustomRank = async (teamNum: number, newRankStr: string) => {
    const newRank = parseInt(newRankStr, 10);
    if (isNaN(newRank) || newRank <= 0) {
      setEditingRankTeamNum(null);
      setEditingRankType(null);
      return;
    }

    const sorted = [...teams].sort((a, b) => (a.customPicklistRank ?? 9999) - (b.customPicklistRank ?? 9999));
    const itemIndex = sorted.findIndex((t) => t.teamNumber === teamNum);
    if (itemIndex === -1) return;

    const [movedItem] = sorted.splice(itemIndex, 1);
    const clampedTarget = Math.max(0, Math.min(newRank - 1, sorted.length));
    sorted.splice(clampedTarget, 0, movedItem);

    const reindexed = sorted.map((t, idx) => ({
      ...t,
      customPicklistRank: idx + 1,
    }));

    setTeams(reindexed);
    setEditingRankTeamNum(null);
    setEditingRankType(null);
    setTempRankValue('');
    await scoutingDB.saveTeamsBatch(reindexed);
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, teamNum: number) => {
    e.dataTransfer.setData('text/plain', teamNum.toString());
    setDraggedTeamNum(teamNum);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetTeamNum: number) => {
    e.preventDefault();
    const sourceTeamNum = draggedTeamNum;
    setDraggedTeamNum(null);

    if (!sourceTeamNum || sourceTeamNum === targetTeamNum) return;

    const sorted = [...teams].sort((a, b) => (a.customPicklistRank ?? 9999) - (b.customPicklistRank ?? 9999));
    const sourceIdx = sorted.findIndex((t) => t.teamNumber === sourceTeamNum);
    const targetIdx = sorted.findIndex((t) => t.teamNumber === targetTeamNum);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [moved] = sorted.splice(sourceIdx, 1);
    sorted.splice(targetIdx, 0, moved);

    const reindexed = sorted.map((t, idx) => ({
      ...t,
      customPicklistRank: idx + 1,
    }));

    setTeams(reindexed);
    await scoutingDB.saveTeamsBatch(reindexed);
  };

  // Quick preset initialization
  const handleInitializeFrom = async (criterion: 'officialRank' | 'fuel' | 'stateRank') => {
    const sorted = [...teams].sort((a, b) => {
      if (criterion === 'officialRank') {
        const rA = a.officialRank ?? 9999;
        const rB = b.officialRank ?? 9999;
        return rA - rB;
      } else if (criterion === 'stateRank') {
        const rA = a.stateRank ?? 9999;
        const rB = b.stateRank ?? 9999;
        return rA - rB;
      } else {
        const fuelA = matches.filter((m) => m.teamNumber === a.teamNumber).reduce((sum, m) => sum + (m.autoFuelScored || 0) + (m.teleopFuelScored || 0), 0);
        const fuelB = matches.filter((m) => m.teamNumber === b.teamNumber).reduce((sum, m) => sum + (m.autoFuelScored || 0) + (m.teleopFuelScored || 0), 0);
        return fuelB - fuelA;
      }
    });

    const reindexed = sorted.map((t, idx) => ({
      ...t,
      customPicklistRank: idx + 1,
    }));

    setTeams(reindexed);
    setSortBy('preferenceRank');
    await scoutingDB.saveTeamsBatch(reindexed);
  };

  const handleSaveManualRank = async (teamNum: number, rankType: 'official' | 'state') => {
    const targetTeam = teams.find((t) => t.teamNumber === teamNum);
    if (!targetTeam) return;

    const parsed = parseInt(tempRankValue, 10);
    const newRank = !isNaN(parsed) && parsed > 0 ? parsed : undefined;

    const updated = {
      ...targetTeam,
      [rankType === 'official' ? 'officialRank' : 'stateRank']: newRank,
      updatedAt: Date.now(),
    };

    setTeams((prev) => prev.map((t) => (t.teamNumber === teamNum ? updated : t)));
    setEditingRankTeamNum(null);
    setEditingRankType(null);
    setTempRankValue('');
    await scoutingDB.saveTeam(updated);
  };

  const toggleSelectTeam = (teamNum: number) => {
    if (selectedTeamNums.includes(teamNum)) {
      setSelectedTeamNums(selectedTeamNums.filter((n) => n !== teamNum));
    } else {
      if (selectedTeamNums.length < 4) {
        setSelectedTeamNums([...selectedTeamNums, teamNum]);
      } else {
        setSelectedTeamNums([...selectedTeamNums.slice(1), teamNum]);
      }
    }
  };

  const resetAllFilters = () => {
    setFilterDrivetrain('ALL');
    setFilterShooter('ALL');
    setFilterCapability('ALL');
    setFilterReliability('ALL');
    setFilterDefense('ALL');
    setFilterAuto('ALL');
    setFilterQuery('');
  };

  const activeFilterCount = 
    (filterDrivetrain !== 'ALL' ? 1 : 0) +
    (filterShooter !== 'ALL' ? 1 : 0) +
    (filterCapability !== 'ALL' ? 1 : 0) +
    (filterReliability !== 'ALL' ? 1 : 0) +
    (filterDefense !== 'ALL' ? 1 : 0) +
    (filterAuto !== 'ALL' ? 1 : 0);

  // Enrich teams with match scouting statistics
  const enrichedTeams: EnrichedTeam[] = teams.map((team) => {
    const teamMatches = matches.filter((m) => m.teamNumber === team.teamNumber);
    const count = teamMatches.length;

    const autoWorkedCount = teamMatches.filter((m) => m.autoWorked !== false).length;
    const autoSuccessRatio = count > 0 ? autoWorkedCount / count : 0;
    const autoSuccessStr = count > 0 ? `${autoWorkedCount}/${count}` : '0/0';

    const avgAutoFuel = count
      ? teamMatches.reduce((sum, m) => sum + (m.autoFuelScored ?? m.autoHighScored ?? 0), 0) / count
      : 0;

    const avgTeleopFuel = count
      ? teamMatches.reduce((sum, m) => sum + (m.teleopFuelScored ?? m.teleopHighScored ?? 0), 0) / count
      : 0;

    const avgTotalFuel = avgAutoFuel + avgTeleopFuel;

    // Reliability Rating
    const majorIssues = teamMatches.filter((m) => m.robotIssues === 'MAJOR' || m.robotIssues === 'DISABLED').length;
    const minorIssues = teamMatches.filter((m) => m.robotIssues === 'MINOR').length;
    let reliabilityVal = 3;
    let reliabilityLabel = 'HIGH';
    if (majorIssues >= 2) {
      reliabilityVal = 1;
      reliabilityLabel = 'LOW';
    } else if (majorIssues === 1 || minorIssues >= 2) {
      reliabilityVal = 2;
      reliabilityLabel = 'MED';
    }

    // Defense Effectiveness
    const defenseMatches = teamMatches.filter((m) => m.playedDefense);
    let defenseVal = 0;
    let defenseLabel = 'NONE';
    if (defenseMatches.length > 0) {
      const highDef = defenseMatches.filter((m) => m.defenseEffectiveness === 'HIGH').length;
      const medDef = defenseMatches.filter((m) => m.defenseEffectiveness === 'MEDIUM').length;
      if (highDef > 0) {
        defenseVal = 3;
        defenseLabel = 'HIGH';
      } else if (medDef > 0) {
        defenseVal = 2;
        defenseLabel = 'MED';
      } else {
        defenseVal = 1;
        defenseLabel = 'LOW';
      }
    }

    return {
      team,
      teamNumber: team.teamNumber,
      teamName: team.teamName,
      matchesCount: count,
      autoSuccessRatio,
      autoSuccessStr,
      avgAutoFuel,
      avgTeleopFuel,
      avgTotalFuel,
      reliabilityVal,
      reliabilityLabel,
      defenseVal,
      defenseLabel,
      officialRank: team.officialRank,
      stateRank: team.stateRank,
      customPicklistRank: team.customPicklistRank,
      isUnavailable: !!team.isUnavailable,
    };
  });

  // Sort function
  const sortFn = (a: EnrichedTeam, b: EnrichedTeam) => {
    switch (sortBy) {
      case 'preferenceRank': {
        const pA = a.customPicklistRank ?? 9999;
        const pB = b.customPicklistRank ?? 9999;
        return pA - pB;
      }
      case 'totalFuel':
        return b.avgTotalFuel - a.avgTotalFuel;
      case 'autoSuccess':
        return b.autoSuccessRatio - a.autoSuccessRatio;
      case 'autoFuel':
        return b.avgAutoFuel - a.avgAutoFuel;
      case 'reliability':
        return b.reliabilityVal - a.reliabilityVal;
      case 'defense':
      case 'defenseEffectiveness':
        return b.defenseVal - a.defenseVal;
      case 'matchesScouted':
        return b.matchesCount - a.matchesCount;
      case 'officialRank': {
        const rA = a.officialRank !== undefined ? a.officialRank : 999;
        const rB = b.officialRank !== undefined ? b.officialRank : 999;
        return rA - rB;
      }
      case 'stateRank': {
        const rA = a.stateRank !== undefined ? a.stateRank : 999;
        const rB = b.stateRank !== undefined ? b.stateRank : 999;
        return rA - rB;
      }
      default:
        return (a.customPicklistRank ?? 9999) - (b.customPicklistRank ?? 9999);
    }
  };

  // Multi-variable filtering logic
  const filteredTeams = enrichedTeams.filter((item) => {
    // 1. Text Query (Number or Name)
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      const matchQuery = item.teamNumber.toString().includes(q) || item.teamName.toLowerCase().includes(q);
      if (!matchQuery) return false;
    }

    // 2. Drivetrain Filter
    if (filterDrivetrain !== 'ALL') {
      const dt = item.team.pit?.drivetrain || '';
      if (dt !== filterDrivetrain) return false;
    }

    // 3. Shooter Type Filter
    if (filterShooter !== 'ALL') {
      const shooters = item.team.pit?.shooter || [];
      if (!shooters.includes(filterShooter as ShooterType)) return false;
    }

    // 4. Bump/Trench Capability Filter
    if (filterCapability !== 'ALL') {
      const cap = item.team.pit?.bumpTrench || '';
      if (cap !== filterCapability) return false;
    }

    // 5. Reliability Filter
    if (filterReliability !== 'ALL') {
      if (filterReliability === 'HIGH' && item.reliabilityLabel !== 'HIGH') return false;
      if (filterReliability === 'MED+' && item.reliabilityLabel === 'LOW') return false;
    }

    // 6. Defense Filter
    if (filterDefense !== 'ALL') {
      if (filterDefense === 'HIGH' && item.defenseLabel !== 'HIGH') return false;
      if (filterDefense === 'ANY' && item.defenseLabel === 'NONE') return false;
    }

    // 7. Auto Capability Filter
    if (filterAuto !== 'ALL') {
      if (filterAuto === 'HAS_AUTO' && item.team.pit?.hasAutonomous === 'NO') return false;
      if (filterAuto === 'CONSISTENT_AUTO' && item.autoSuccessRatio < 0.75) return false;
    }

    return true;
  });

  // Split into Available vs Unavailable
  const availableTeams = filteredTeams.filter((t) => !t.isUnavailable).sort(sortFn);
  const unavailableTeams = filteredTeams.filter((t) => t.isUnavailable).sort(sortFn);
  const unifiedTeams = [...filteredTeams].sort(sortFn);

  const handleOpenCompare = () => {
    if (selectedTeamNums.length > 0) {
      onNavigate('compare', undefined, selectedTeamNums);
    } else {
      const topNums = availableTeams.slice(0, 3).map((t) => t.teamNumber);
      onNavigate('compare', undefined, topNums);
    }
  };

  const renderTeamRow = (item: EnrichedTeam, displayIndex: number, isUnavailableSection: boolean = false) => {
    const isSelected = selectedTeamNums.includes(item.teamNumber);
    const isEditingOfficial = editingRankTeamNum === item.teamNumber && editingRankType === 'official';
    const isEditingState = editingRankTeamNum === item.teamNumber && editingRankType === 'state';
    const isEditingPref = editingRankTeamNum === item.teamNumber && editingRankType === 'preference';

    const rowUnavailable = item.isUnavailable;

    return (
      <tr
        key={item.teamNumber}
        draggable={!rowUnavailable && sortBy === 'preferenceRank'}
        onDragStart={(e) => handleDragStart(e, item.teamNumber)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, item.teamNumber)}
        className={`transition-colors select-none ${
          rowUnavailable 
            ? 'bg-slate-950/40 opacity-55 hover:opacity-75' 
            : isSelected 
              ? 'bg-amber-950/20 border-l-2 border-l-amber-400' 
              : 'hover:bg-slate-900/60'
        } ${draggedTeamNum === item.teamNumber ? 'opacity-30 border-2 border-dashed border-amber-400' : ''}`}
      >
        {/* Availability Cross-off Box */}
        <td className="p-3 text-center">
          <button
            type="button"
            onClick={() => handleToggleUnavailable(item.teamNumber, item.isUnavailable)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              item.isUnavailable
                ? 'bg-rose-950/80 border border-rose-700/80 text-rose-400 hover:bg-rose-900/80'
                : 'bg-slate-900 border border-slate-750 text-slate-500 hover:border-rose-600 hover:text-rose-400'
            }`}
            title={item.isUnavailable ? 'Team is Unavailable / Picked. Click to restore' : 'Click to Cross Off (Picked / Unavailable)'}
          >
            {item.isUnavailable ? (
              <Ban className="w-4 h-4 text-rose-400" />
            ) : (
              <UserCheck className="w-4 h-4 text-slate-400 hover:text-rose-400" />
            )}
          </button>
        </td>

        {/* Compare Checkbox */}
        <td className="p-3 text-center">
          <button
            type="button"
            onClick={() => toggleSelectTeam(item.teamNumber)}
            className="p-1 rounded text-slate-400 hover:text-amber-400 cursor-pointer"
            title="Select for comparison"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-amber-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </td>

        {/* Custom Rank & Reorder Controls */}
        <td className="p-3 text-center">
          {isEditingPref ? (
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={tempRankValue}
                onChange={(e) => setTempRankValue(e.target.value)}
                placeholder="#"
                autoFocus
                className="w-12 bg-slate-900 border border-amber-500 rounded px-1 py-0.5 text-center font-mono text-xs text-amber-300 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetCustomRank(item.teamNumber, tempRankValue);
                  if (e.key === 'Escape') setEditingRankTeamNum(null);
                }}
              />
              <button
                type="button"
                onClick={() => handleSetCustomRank(item.teamNumber, tempRankValue)}
                className="p-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              {sortBy === 'preferenceRank' && !rowUnavailable && (
                <div className="flex items-center gap-0.5 text-slate-500 mr-0.5">
                  <GripVertical className="w-3.5 h-3.5 text-slate-600 cursor-grab active:cursor-grabbing hidden sm:inline" />
                  <div className="flex flex-col -space-y-1">
                    <button
                      type="button"
                      onClick={() => handleMovePreference(item.teamNumber, 'UP')}
                      disabled={displayIndex === 0}
                      className="p-0.5 hover:text-amber-400 text-slate-500 disabled:opacity-20 cursor-pointer"
                      title="Move up 1 position"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMovePreference(item.teamNumber, 'DOWN')}
                      className="p-0.5 hover:text-amber-400 text-slate-500 cursor-pointer"
                      title="Move down 1 position"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              <span
                onClick={() => {
                  setEditingRankTeamNum(item.teamNumber);
                  setEditingRankType('preference');
                  setTempRankValue(item.customPicklistRank ? item.customPicklistRank.toString() : '');
                }}
                className={`font-mono font-black text-xs px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  rowUnavailable
                    ? 'text-slate-500 bg-slate-900 line-through'
                    : displayIndex === 0 && !isUnavailableSection
                      ? 'text-amber-300 bg-amber-950/70 border border-amber-800'
                      : 'text-slate-300 bg-slate-900/80 hover:bg-slate-800'
                }`}
                title="Click to set rank number"
              >
                #{item.customPicklistRank ?? displayIndex + 1}
              </span>
            </div>
          )}
        </td>

        {/* Team Number and Name */}
        <td className="p-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span 
                onClick={() => onNavigate('team-profile', item.teamNumber)}
                className={`font-mono font-black text-sm sm:text-base cursor-pointer hover:underline ${
                  rowUnavailable 
                    ? 'line-through decoration-rose-500/80 decoration-2 text-slate-500' 
                    : 'text-amber-400'
                }`}
              >
                #{item.teamNumber}
              </span>
              {rowUnavailable && (
                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[9px] font-mono font-bold uppercase tracking-wider">
                  PICKED
                </span>
              )}
            </div>
            <span className={`text-[11px] truncate max-w-[120px] ${rowUnavailable ? 'line-through text-slate-600' : 'text-slate-400'}`}>
              {item.teamName}
            </span>
          </div>
        </td>

        {/* Auto Success */}
        <td className="p-3 text-center font-mono font-bold text-blue-400">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.autoSuccessStr}
          </span>
        </td>

        {/* Total Fuel */}
        <td className="p-3 text-center font-mono font-black text-emerald-400 text-sm">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.avgTotalFuel.toFixed(1)}
          </span>
        </td>

        {/* Reliability */}
        <td className="p-3 text-center font-mono font-bold">
          <span
            className={`px-2 py-0.5 rounded text-[10px] ${
              rowUnavailable
                ? 'bg-slate-900 text-slate-600 border border-slate-800'
                : item.reliabilityLabel === 'HIGH'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : item.reliabilityLabel === 'MED'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}
          >
            {item.reliabilityLabel}
          </span>
        </td>

        {/* Defense */}
        <td className="p-3 text-center font-mono font-bold">
          <span
            className={`px-2 py-0.5 rounded text-[10px] ${
              rowUnavailable
                ? 'bg-slate-900 text-slate-600'
                : item.defenseLabel === 'HIGH'
                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                : item.defenseLabel === 'MED'
                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                : 'bg-slate-900 text-slate-500'
            }`}
          >
            {item.defenseLabel}
          </span>
        </td>

        {/* Official Event Rank */}
        <td className="p-3 text-center font-mono font-bold">
          {isEditingOfficial ? (
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={tempRankValue}
                onChange={(e) => setTempRankValue(e.target.value)}
                placeholder="Rank #"
                autoFocus
                className="w-14 bg-slate-900 border border-amber-500 rounded px-1 py-0.5 text-center font-mono text-xs text-amber-300 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveManualRank(item.teamNumber, 'official');
                  if (e.key === 'Escape') setEditingRankTeamNum(null);
                }}
              />
              <button
                type="button"
                onClick={() => handleSaveManualRank(item.teamNumber, 'official')}
                className="p-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 group">
              <span className={item.officialRank ? 'text-amber-300 font-black' : 'text-slate-500 font-bold'}>
                {item.officialRank ? `Rank ${item.officialRank}` : 'N/A'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingRankTeamNum(item.teamNumber);
                  setEditingRankType('official');
                  setTempRankValue(item.officialRank ? item.officialRank.toString() : '');
                }}
                className="opacity-40 group-hover:opacity-100 p-1 text-slate-400 hover:text-amber-400 transition-opacity cursor-pointer"
                title="Edit Event Rank"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>

        {/* State / District Rank */}
        <td className="p-3 text-center font-mono font-bold">
          {isEditingState ? (
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={tempRankValue}
                onChange={(e) => setTempRankValue(e.target.value)}
                placeholder="State #"
                autoFocus
                className="w-14 bg-slate-900 border border-blue-500 rounded px-1 py-0.5 text-center font-mono text-xs text-blue-300 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveManualRank(item.teamNumber, 'state');
                  if (e.key === 'Escape') setEditingRankTeamNum(null);
                }}
              />
              <button
                type="button"
                onClick={() => handleSaveManualRank(item.teamNumber, 'state')}
                className="p-1 rounded bg-blue-500 text-slate-950 hover:bg-blue-400 cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 group">
              <span className={item.stateRank ? 'text-blue-300 font-black' : 'text-slate-500 font-bold'}>
                {item.stateRank ? `Rank ${item.stateRank}` : 'N/A'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingRankTeamNum(item.teamNumber);
                  setEditingRankType('state');
                  setTempRankValue(item.stateRank ? item.stateRank.toString() : '');
                }}
                className="opacity-40 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-400 transition-opacity cursor-pointer"
                title="Edit State Rank"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>

        {/* Action View */}
        <td className="p-3 text-right">
          <button
            type="button"
            onClick={() => onNavigate('team-profile', item.teamNumber)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 font-mono text-xs font-bold transition-colors cursor-pointer"
          >
            View
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-5 pb-32 flex flex-col gap-5">
      {/* Controls Bar: Rank by & Variable Filter */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        {/* Rank By Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Rank by:</span>
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer w-full sm:w-auto"
          >
            <option value="preferenceRank">⭐ Custom</option>
            <option value="officialRank">Official Event Rank</option>
            <option value="stateRank">State / District Rank</option>
            <option value="totalFuel">Average Fuel (Total)</option>
            <option value="autoSuccess">Auto Success Rate</option>
            <option value="autoFuel">Auto Fuel</option>
            <option value="reliability">Reliability Rating</option>
            <option value="defense">Defense Effectiveness</option>
            <option value="matchesScouted">Matches Scouted</option>
          </select>
        </div>

        {/* Filter Trigger Button & Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Custom Initializer */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Custom ▾</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1 z-30 hidden group-hover:flex flex-col">
              <button
                type="button"
                onClick={() => handleInitializeFrom('officialRank')}
                className="w-full text-left px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-900 rounded-lg"
              >
                Reset to Event Rank
              </button>
              <button
                type="button"
                onClick={() => handleInitializeFrom('stateRank')}
                className="w-full text-left px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-900 rounded-lg"
              >
                Reset to State Rank
              </button>
              <button
                type="button"
                onClick={() => handleInitializeFrom('fuel')}
                className="w-full text-left px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-900 rounded-lg"
              >
                Reset to Avg Fuel Score
              </button>
            </div>
          </div>

          {/* Variable Filter Button */}
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-colors cursor-pointer ${
              activeFilterCount > 0
                ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>Filter Variables</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Quick Search */}
          <input
            type="text"
            placeholder="Search team #..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 w-full sm:w-36"
          />

          {/* Uncross All Button if teams are crossed off */}
          {unavailableTeams.length > 0 && (
            <button
              type="button"
              onClick={handleResetAllAvailability}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-rose-900/60 hover:bg-rose-950/40 text-rose-300 font-mono text-xs font-bold cursor-pointer"
              title="Clear all crossed off teams"
            >
              <UserX className="w-3.5 h-3.5 text-rose-400" />
              <span>Uncross ({unavailableTeams.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: AVAILABLE FOR OUR ALLIANCE */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
        {separateUnavailable && (
          <div className="p-3 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="font-mono font-black text-xs sm:text-sm text-slate-200 uppercase tracking-wider">
                AVAILABLE TEAMS ({availableTeams.length})
              </h2>
            </div>
            {sortBy === 'preferenceRank' && (
              <span className="text-[11px] font-mono text-amber-400/80 hidden sm:inline">
                Use ▲ / ▼ or drag to adjust custom priority
              </span>
            )}
          </div>
        )}

        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 font-mono font-bold text-slate-400 text-[11px] uppercase">
              <th className="p-3 w-12 text-center" title="Mark as picked or unavailable">Cross Off</th>
              <th className="p-3 w-10 text-center">Compare</th>
              <th className="p-3 w-20 text-center">Custom #</th>
              <th className="p-3 min-w-[110px]">TEAM</th>
              <th className="p-3 text-center">AUTO</th>
              <th className="p-3 text-center">FUEL</th>
              <th className="p-3 text-center">REL.</th>
              <th className="p-3 text-center">DEF.</th>
              <th className="p-3 text-center">EVENT RANK</th>
              <th className="p-3 text-center">STATE RANK</th>
              <th className="p-3 text-right">ACTION</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-850">
            {(!separateUnavailable ? unifiedTeams : availableTeams).length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500 font-mono text-xs">
                  {teams.length === 0 
                    ? 'No teams registered yet. Import an event roster or perform scouting.' 
                    : 'No teams match the current variable filters.'}
                </td>
              </tr>
            ) : (
              (!separateUnavailable ? unifiedTeams : availableTeams).map((item, idx) => 
                renderTeamRow(item, idx, false)
              )
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: NOT AVAILABLE / PICKED BY OTHER ALLIANCE (Crossed Off) */}
      {separateUnavailable && unavailableTeams.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-rose-950/60 bg-slate-950/90 shadow-2xl transition-all">
          <div 
            onClick={() => setIsUnavailableCollapsed(!isUnavailableCollapsed)}
            className="p-3 px-4 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between cursor-pointer hover:bg-rose-950/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Ban className="w-4 h-4 text-rose-400" />
              <h2 className="font-mono font-black text-xs sm:text-sm text-rose-300 uppercase tracking-wider">
                UNAVAILABLE / PICKED TEAMS ({unavailableTeams.length})
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono font-bold">
              <span>{isUnavailableCollapsed ? 'Show' : 'Hide'}</span>
              <ChevronRight className={`w-4 h-4 transform transition-transform ${isUnavailableCollapsed ? '' : 'rotate-90'}`} />
            </div>
          </div>

          {!isUnavailableCollapsed && (
            <table className="w-full text-left border-collapse text-xs sm:text-sm opacity-85">
              <thead>
                <tr className="bg-slate-900/70 border-b border-slate-800 font-mono font-bold text-slate-500 text-[11px] uppercase">
                  <th className="p-3 w-12 text-center">Restore</th>
                  <th className="p-3 w-10 text-center">Compare</th>
                  <th className="p-3 w-20 text-center">Custom #</th>
                  <th className="p-3 min-w-[110px]">TEAM</th>
                  <th className="p-3 text-center">AUTO</th>
                  <th className="p-3 text-center">FUEL</th>
                  <th className="p-3 text-center">REL.</th>
                  <th className="p-3 text-center">DEF.</th>
                  <th className="p-3 text-center">EVENT RANK</th>
                  <th className="p-3 text-center">STATE RANK</th>
                  <th className="p-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {unavailableTeams.map((item, idx) => renderTeamRow(item, idx, true))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* INTERACTIVE VARIABLE FILTER MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <h3 className="font-mono font-black text-base text-white uppercase">Filter Scouting Variables</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-mono">
              {/* Drivetrain Variable */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase block">Drivetrain Type</label>
                <select
                  value={filterDrivetrain}
                  onChange={(e) => setFilterDrivetrain(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Drivetrains</option>
                  <option value="SWERVE">Swerve Only</option>
                  <option value="TANK / WEST COAST">Tank / West Coast</option>
                  <option value="MECANUM">Mecanum</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Shooter Type Variable */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase block">Shooter Mechanism</label>
                <select
                  value={filterShooter}
                  onChange={(e) => setFilterShooter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Shooters</option>
                  <option value="TURRET">Turret Shooter</option>
                  <option value="PIVOTING">Pivoting Hood</option>
                  <option value="FIXED">Fixed Shooter</option>
                  <option value="DUMPER">Dumper</option>
                </select>
              </div>

              {/* Field Capability */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase block">Bump / Trench</label>
                <select
                  value={filterCapability}
                  onChange={(e) => setFilterCapability(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Capabilities</option>
                  <option value="BOTH">Both Bump & Trench</option>
                  <option value="BUMP ONLY">Bump Only</option>
                  <option value="TRENCH ONLY">Trench Only</option>
                </select>
              </div>

              {/* Reliability Rating */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase block">Reliability Rating</label>
                <select
                  value={filterReliability}
                  onChange={(e) => setFilterReliability(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Ratings</option>
                  <option value="HIGH">High Reliability Only</option>
                  <option value="MED+">Medium or High</option>
                </select>
              </div>

              {/* Defense Effectiveness */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase block">Defense Effectiveness</label>
                <select
                  value={filterDefense}
                  onChange={(e) => setFilterDefense(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Defense Levels</option>
                  <option value="HIGH">High Defense Only</option>
                  <option value="ANY">Any Defense Played</option>
                </select>
              </div>

              {/* Autonomous Capability */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase block">Autonomous Routine</label>
                <select
                  value={filterAuto}
                  onChange={(e) => setFilterAuto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Autonomous</option>
                  <option value="HAS_AUTO">Has Autonomous</option>
                  <option value="CONSISTENT_AUTO">Consistent Auto (&gt;75%)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider shadow"
              >
                Apply Filters ({filteredTeams.length} teams)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Buttons */}
      <div className="fixed bottom-14 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3">
        <button
          type="button"
          onClick={handleOpenCompare}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-mono text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>COMPARE {selectedTeamNums.length > 0 ? `(${selectedTeamNums.length})` : ''}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('teams')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-750 font-mono font-bold text-xs uppercase cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          <span>VIEW TEAMS</span>
        </button>
      </div>
    </div>
  );
};
