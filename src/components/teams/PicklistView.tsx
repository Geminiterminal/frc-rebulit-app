import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { tbaApi } from '../../utils/tbaApi';
import { 
  ArrowLeft,
  ArrowUpDown, 
  CheckSquare, 
  Square, 
  Edit3, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  GripVertical, 
  UserX, 
  UserCheck, 
  ChevronRight,
  Ban,
  RefreshCw
} from 'lucide-react';

interface PicklistViewProps {
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
  onBack: () => void;
}

export type SortOption = 
  | 'preferenceRank'
  | 'officialRank'
  | 'totalFuel' 
  | 'autoFuel' 
  | 'matchesScouted';

interface EnrichedTeam {
  team: TeamProfile;
  teamNumber: number;
  teamName: string;
  matchesCount: number;
  highestFuel: number;
  lowestFuel: number;
  avgTotalFuel: number;
  avgAutoFuel: number;
  hopperCapacity: number | string;
  officialRank?: number;
  customPicklistRank?: number;
  isUnavailable: boolean;
}

export const PicklistView: React.FC<PicklistViewProps> = ({ onNavigate, onBack }) => {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('preferenceRank');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>([]);
  const [separateUnavailable, setSeparateUnavailable] = useState<boolean>(true);
  const [isUnavailableCollapsed, setIsUnavailableCollapsed] = useState<boolean>(false);

  // Manual rank editing state
  const [editingRankTeamNum, setEditingRankTeamNum] = useState<number | null>(null);
  const [editingRankType, setEditingRankType] = useState<'official' | 'preference' | null>(null);
  const [tempRankValue, setTempRankValue] = useState<string>('');

  // Drag and drop state
  const [draggedTeamNum, setDraggedTeamNum] = useState<number | null>(null);

  // Live Rankings Sync State
  const [isSyncingRankings, setIsSyncingRankings] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncRankings = async () => {
    setIsSyncingRankings(true);
    setSyncStatusMsg(null);
    const code = localStorage.getItem('frc_active_event_code') || '2025micmp';
    const key = localStorage.getItem('frc_tba_auth_key') || (await scoutingDB.getSetting<string>('tbaApiKey', ''));

    const res = await tbaApi.fetchEventTeams(code, key);
    setSyncStatusMsg(res.message);
    setIsSyncingRankings(false);
    await loadData();
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  const loadData = async () => {
    const allTeams = await scoutingDB.getAllTeams();
    const allMatches = await scoutingDB.getAllMatches();

    const needsInit = allTeams.some((t) => typeof t.customPicklistRank !== 'number');
    if (needsInit && allTeams.length > 0) {
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

  const handleResetAllAvailability = async () => {
    const updated = teams.map((t) => ({
      ...t,
      isUnavailable: false,
      updatedAt: Date.now(),
    }));
    setTeams(updated);
    await scoutingDB.saveTeamsBatch(updated);
  };

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

  const handleSaveManualRank = async (teamNum: number, rankType: 'official') => {
    const targetTeam = teams.find((t) => t.teamNumber === teamNum);
    if (!targetTeam) return;

    const parsed = parseInt(tempRankValue, 10);
    const newRank = !isNaN(parsed) && parsed > 0 ? parsed : undefined;

    const updated = {
      ...targetTeam,
      officialRank: newRank,
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

  const enrichedTeams: EnrichedTeam[] = teams.map((team) => {
    const teamMatches = matches.filter((m) => m.teamNumber === team.teamNumber);
    const count = teamMatches.length;

    const totalFuelValues = teamMatches.map((m) => (m.autoFuelScored ?? m.autoHighScored ?? 0) + (m.teleopFuelScored ?? m.teleopHighScored ?? 0));
    const autoFuelValues = teamMatches.map((m) => m.autoFuelScored ?? m.autoHighScored ?? 0);

    const highestFuel = count > 0 ? Math.max(...totalFuelValues) : 0;
    const lowestFuel = count > 0 ? Math.min(...totalFuelValues) : 0;
    const avgTotalFuel = count > 0 ? totalFuelValues.reduce((a, b) => a + b, 0) / count : 0;
    const avgAutoFuel = count > 0 ? autoFuelValues.reduce((a, b) => a + b, 0) / count : 0;

    const hopperCapacity = team.pit?.hopperCapacity !== undefined ? team.pit.hopperCapacity : '—';

    return {
      team,
      teamNumber: team.teamNumber,
      teamName: team.teamName,
      matchesCount: count,
      highestFuel,
      lowestFuel,
      avgTotalFuel,
      avgAutoFuel,
      hopperCapacity,
      officialRank: team.officialRank,
      customPicklistRank: team.customPicklistRank,
      isUnavailable: !!team.isUnavailable,
    };
  });

  const sortFn = (a: EnrichedTeam, b: EnrichedTeam) => {
    switch (sortBy) {
      case 'preferenceRank': {
        const pA = a.customPicklistRank ?? 9999;
        const pB = b.customPicklistRank ?? 9999;
        return pA - pB;
      }
      case 'totalFuel':
        return b.avgTotalFuel - a.avgTotalFuel;
      case 'autoFuel':
        return b.avgAutoFuel - a.avgAutoFuel;
      case 'matchesScouted':
        return b.matchesCount - a.matchesCount;
      case 'officialRank': {
        const rA = a.officialRank !== undefined ? a.officialRank : 999;
        const rB = b.officialRank !== undefined ? b.officialRank : 999;
        return rA - rB;
      }
      default:
        return (a.customPicklistRank ?? 9999) - (b.customPicklistRank ?? 9999);
    }
  };

  const filteredTeams = enrichedTeams.filter((item) => {
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      return item.teamNumber.toString().includes(q) || item.teamName.toLowerCase().includes(q);
    }
    return true;
  });

  const availableTeams = filteredTeams.filter((t) => !t.isUnavailable).sort(sortFn);
  const unavailableTeams = filteredTeams.filter((t) => t.isUnavailable).sort(sortFn);
  const unifiedTeams = [...filteredTeams].sort(sortFn);

  const renderTeamRow = (item: EnrichedTeam, displayIndex: number, isUnavailableSection: boolean = false) => {
    const isSelected = selectedTeamNums.includes(item.teamNumber);
    const isEditingOfficial = editingRankTeamNum === item.teamNumber && editingRankType === 'official';
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
              ? 'bg-slate-850/60 border-l-2 border-l-slate-400' 
              : 'hover:bg-slate-900/60'
        } ${draggedTeamNum === item.teamNumber ? 'opacity-30 border-2 border-dashed border-slate-500' : ''}`}
      >
        {/* Availability Cross-off */}
        <td className="p-2 sm:p-3 text-center">
          <button
            type="button"
            onClick={() => handleToggleUnavailable(item.teamNumber, item.isUnavailable)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              item.isUnavailable
                ? 'bg-rose-950/80 border border-rose-700/80 text-rose-400 hover:bg-rose-900/80'
                : 'bg-slate-900 border border-slate-750 text-slate-500 hover:border-rose-600 hover:text-rose-400'
            }`}
            title={item.isUnavailable ? 'Restore team' : 'Cross off'}
          >
            {item.isUnavailable ? (
              <Ban className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
            )}
          </button>
        </td>

        {/* Compare Checkbox */}
        <td className="p-2 sm:p-3 text-center">
          <button
            type="button"
            onClick={() => toggleSelectTeam(item.teamNumber)}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            title="Select for comparison"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-slate-200" />
            ) : (
              <Square className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </td>

        {/* Team Number and Name */}
        <td className="p-2 sm:p-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span 
                onClick={() => onNavigate('team-profile', item.teamNumber)}
                className={`font-mono font-bold text-sm cursor-pointer hover:underline ${
                  rowUnavailable 
                    ? 'line-through text-slate-500' 
                    : 'text-slate-100'
                }`}
              >
                #{item.teamNumber}
              </span>
              {rowUnavailable && (
                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[9px] font-mono font-bold uppercase">
                  PICKED
                </span>
              )}
            </div>
            <span className={`text-[10px] truncate max-w-[100px] ${rowUnavailable ? 'line-through text-slate-600' : 'text-slate-400'}`}>
              {item.teamName}
            </span>
          </div>
        </td>

        {/* Matches */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-300">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.matchesCount}
          </span>
        </td>

        {/* Highest Fuel */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold text-emerald-400">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.highestFuel}
          </span>
        </td>

        {/* Lowest Fuel */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold text-amber-400">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.lowestFuel}
          </span>
        </td>

        {/* Avg Fuel */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-100 text-sm">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.avgTotalFuel.toFixed(1)}
          </span>
        </td>

        {/* Avg Auto Fuel */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold text-blue-400">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.avgAutoFuel.toFixed(1)}
          </span>
        </td>

        {/* Hopper Capacity */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold text-slate-300">
          <span className={rowUnavailable ? 'line-through text-slate-600' : ''}>
            {item.hopperCapacity}
          </span>
        </td>

        {/* Event Rank */}
        <td className="p-2 sm:p-3 text-center font-mono font-bold">
          {isEditingOfficial ? (
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={tempRankValue}
                onChange={(e) => setTempRankValue(e.target.value)}
                placeholder="Rank #"
                autoFocus
                className="w-14 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-center font-mono text-xs text-white focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveManualRank(item.teamNumber, 'official');
                  if (e.key === 'Escape') setEditingRankTeamNum(null);
                }}
              />
              <button
                type="button"
                onClick={() => handleSaveManualRank(item.teamNumber, 'official')}
                className="p-1 rounded bg-slate-800 text-white cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 group">
              <span className={item.officialRank ? 'text-slate-200 font-bold' : 'text-slate-500 font-bold'}>
                {item.officialRank ? `#${item.officialRank}` : '—'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingRankTeamNum(item.teamNumber);
                  setEditingRankType('official');
                  setTempRankValue(item.officialRank ? item.officialRank.toString() : '');
                }}
                className="opacity-40 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity cursor-pointer"
                title="Edit Event Rank"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>

        {/* FRC Rank (Custom Picklist Rank) */}
        <td className="p-2 sm:p-3 text-center">
          {isEditingPref ? (
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={tempRankValue}
                onChange={(e) => setTempRankValue(e.target.value)}
                placeholder="#"
                autoFocus
                className="w-12 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-center font-mono text-xs text-white focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetCustomRank(item.teamNumber, tempRankValue);
                  if (e.key === 'Escape') setEditingRankTeamNum(null);
                }}
              />
              <button
                type="button"
                onClick={() => handleSetCustomRank(item.teamNumber, tempRankValue)}
                className="p-1 rounded bg-slate-800 text-white cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              {sortBy === 'preferenceRank' && !rowUnavailable && (
                <div className="flex items-center gap-0.5 text-slate-500 mr-0.5">
                  <GripVertical className="w-3.5 h-3.5 text-slate-600 cursor-grab hidden sm:inline" />
                </div>
              )}
              <span
                onClick={() => {
                  setEditingRankTeamNum(item.teamNumber);
                  setEditingRankType('preference');
                  setTempRankValue(item.customPicklistRank ? item.customPicklistRank.toString() : '');
                }}
                className={`font-mono font-bold text-xs px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  rowUnavailable
                    ? 'text-slate-500 bg-slate-900 line-through'
                    : 'text-amber-400 bg-slate-900/80 hover:bg-slate-800'
                }`}
              >
                #{item.customPicklistRank ?? displayIndex + 1}
              </span>
            </div>
          )}
        </td>

        {/* Action */}
        <td className="p-2 sm:p-3 text-right">
          <button
            type="button"
            onClick={() => onNavigate('team-profile', item.teamNumber)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono text-xs font-bold transition-colors cursor-pointer"
          >
            View
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-4 pb-32 flex flex-col gap-4">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-mono font-bold cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← BACK</span>
        </button>

        <span className="text-xs font-bold text-slate-300 tracking-widest uppercase font-mono">
          RANKINGS
        </span>

        <div className="w-16" />
      </div>

      {/* Controls Bar */}
      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort by:</span>
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-slate-600 cursor-pointer w-full sm:w-auto"
          >
            <option value="preferenceRank">Custom Rank</option>
            <option value="officialRank">Official Event Rank</option>
            <option value="totalFuel">Average Fuel (Total)</option>
            <option value="autoFuel">Auto Fuel</option>
            <option value="matchesScouted">Matches Scouted</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncRankings}
            disabled={isSyncingRankings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 font-mono text-xs font-bold cursor-pointer shadow transition-transform active:scale-98 disabled:opacity-50 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${isSyncingRankings ? 'animate-spin' : ''}`} />
            <span>{isSyncingRankings ? 'Syncing...' : 'Sync Rankings'}</span>
          </button>

          <input
            type="text"
            placeholder="Search team #"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 w-full sm:w-32"
          />

          {unavailableTeams.length > 0 && (
            <button
              type="button"
              onClick={handleResetAllAvailability}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-rose-900/60 hover:bg-rose-950/40 text-rose-300 font-mono text-xs font-bold cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5 text-rose-400" />
              <span>Uncross ({unavailableTeams.length})</span>
            </button>
          )}
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs font-bold flex items-center justify-between">
          <span>{syncStatusMsg}</span>
          <button type="button" onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: AVAILABLE */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
        {separateUnavailable && (
          <div className="p-3 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h2 className="font-mono font-bold text-xs text-slate-200 uppercase tracking-wider">
                Available Teams ({availableTeams.length})
              </h2>
            </div>
          </div>
        )}

        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800 font-mono font-bold text-slate-400 text-[11px] uppercase whitespace-nowrap">
              <th className="p-2 sm:p-3 w-10 text-center">Cross Off</th>
              <th className="p-2 sm:p-3 w-10 text-center">Compare</th>
              <th className="p-2 sm:p-3 min-w-[90px]">Team</th>
              <th className="p-2 sm:p-3 text-center">Matches</th>
              <th className="p-2 sm:p-3 text-center">Highest Fuel</th>
              <th className="p-2 sm:p-3 text-center">Lowest Fuel</th>
              <th className="p-2 sm:p-3 text-center">Avg Fuel</th>
              <th className="p-2 sm:p-3 text-center">Avg Auto Fuel</th>
              <th className="p-2 sm:p-3 text-center">Hopper Capacity</th>
              <th className="p-2 sm:p-3 text-center">Event Rank</th>
              <th className="p-2 sm:p-3 text-center">FRC Rank</th>
              <th className="p-2 sm:p-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-850">
            {(!separateUnavailable ? unifiedTeams : availableTeams).length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500 font-mono text-xs">
                  No teams found.
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

      {/* SECTION 2: UNAVAILABLE / PICKED */}
      {separateUnavailable && unavailableTeams.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-rose-950/60 bg-slate-950/90 shadow-2xl transition-all">
          <div 
            onClick={() => setIsUnavailableCollapsed(!isUnavailableCollapsed)}
            className="p-3 px-4 bg-rose-950/20 border-b border-rose-900/40 flex items-center justify-between cursor-pointer hover:bg-rose-950/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              <h2 className="font-mono font-bold text-xs text-rose-300 uppercase tracking-wider">
                Crossed Off ({unavailableTeams.length})
              </h2>
            </div>
            <div className="flex items-center gap-1 text-xs text-rose-400 font-mono font-bold">
              <span>{isUnavailableCollapsed ? 'Show' : 'Hide'}</span>
              <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${isUnavailableCollapsed ? '' : 'rotate-90'}`} />
            </div>
          </div>

          {!isUnavailableCollapsed && (
            <table className="w-full text-left border-collapse text-xs sm:text-sm opacity-85">
              <thead>
                <tr className="bg-slate-900/70 border-b border-slate-800 font-mono font-bold text-slate-500 text-[11px] uppercase whitespace-nowrap">
                  <th className="p-2 sm:p-3 w-10 text-center">Restore</th>
                  <th className="p-2 sm:p-3 w-10 text-center">Compare</th>
                  <th className="p-2 sm:p-3 min-w-[90px]">Team</th>
                  <th className="p-2 sm:p-3 text-center">Matches</th>
                  <th className="p-2 sm:p-3 text-center">Highest Fuel</th>
                  <th className="p-2 sm:p-3 text-center">Lowest Fuel</th>
                  <th className="p-2 sm:p-3 text-center">Avg Fuel</th>
                  <th className="p-2 sm:p-3 text-center">Avg Auto Fuel</th>
                  <th className="p-2 sm:p-3 text-center">Hopper Capacity</th>
                  <th className="p-2 sm:p-3 text-center">Event Rank</th>
                  <th className="p-2 sm:p-3 text-center">FRC Rank</th>
                  <th className="p-2 sm:p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {unavailableTeams.map((item, idx) => renderTeamRow(item, idx, true))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Stable Floating Compare Action Bar */}
      {selectedTeamNums.length > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-45 bg-slate-900 border border-blue-500/60 shadow-2xl rounded-2xl p-3 px-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate('compare', undefined, selectedTeamNums)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-black text-xs uppercase shadow-lg transition-all cursor-pointer"
          >
            COMPARE ({selectedTeamNums.length})
          </button>
        </div>
      )}
    </div>
  );
};
