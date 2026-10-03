import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { importEventRosterAndRankings } from '../../utils/rankingsSync';
import { 
  Trophy, 
  ArrowUpDown, 
  Filter, 
  RefreshCw, 
  Eye, 
  Layers, 
  CheckSquare, 
  Square, 
  Edit3,
  Check,
  X,
  Award
} from 'lucide-react';

interface PicklistViewProps {
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
}

export type SortOption = 
  | 'totalFuel' 
  | 'autoSuccess' 
  | 'autoFuel' 
  | 'reliability' 
  | 'defense' 
  | 'defenseEffectiveness' 
  | 'matchesScouted' 
  | 'officialRank'
  | 'stateRank';

export const PicklistView: React.FC<PicklistViewProps> = ({ onNavigate }) => {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('totalFuel');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>([]);
  const [isSyncingRanks, setIsSyncingRanks] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Manual rank editing state
  const [editingRankTeamNum, setEditingRankTeamNum] = useState<number | null>(null);
  const [editingRankType, setEditingRankType] = useState<'official' | 'state' | null>(null);
  const [tempRankValue, setTempRankValue] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allTeams = await scoutingDB.getAllTeams();
    const allMatches = await scoutingDB.getAllMatches();
    setTeams(allTeams);
    setMatches(allMatches);
  };

  const handleSyncRankings = async () => {
    setIsSyncingRanks(true);
    const eventCode = await scoutingDB.getSetting<string>('eventCode', '2025micmp');
    const result = await importEventRosterAndRankings(eventCode);
    setIsSyncingRanks(false);
    setSyncToast(result.message);
    await loadData();
    setTimeout(() => setSyncToast(null), 3500);
  };

  const handleSaveManualRank = async (teamNum: number, rankType: 'official' | 'state') => {
    const targetTeam = teams.find((t) => t.teamNumber === teamNum);
    if (!targetTeam) return;

    const parsed = parseInt(tempRankValue, 10);
    const newRank = !isNaN(parsed) && parsed > 0 ? parsed : undefined;

    await scoutingDB.saveTeam({
      ...targetTeam,
      [rankType === 'official' ? 'officialRank' : 'stateRank']: newRank,
      updatedAt: Date.now(),
    });

    setEditingRankTeamNum(null);
    setEditingRankType(null);
    setTempRankValue('');
    await loadData();
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

  // Calculate stats for each team
  const enrichedTeams = teams.map((team) => {
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
    let reliabilityVal = 3; // 3 = HIGH, 2 = MED, 1 = LOW
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
    };
  });

  // Sort teams based on active sort option
  const sortedTeams = [...enrichedTeams].sort((a, b) => {
    switch (sortBy) {
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
        return b.avgTotalFuel - a.avgTotalFuel;
    }
  });

  // Filter teams by team number or name search
  const filteredTeams = sortedTeams.filter((t) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return t.teamNumber.toString().includes(q) || t.teamName.toLowerCase().includes(q);
  });

  const handleOpenCompare = () => {
    if (selectedTeamNums.length > 0) {
      onNavigate('compare', undefined, selectedTeamNums);
    } else {
      const topNums = filteredTeams.slice(0, 3).map((t) => t.teamNumber);
      onNavigate('compare', undefined, topNums);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-5 pb-32 flex flex-col gap-6">
      {/* Controls Bar: Sort by & Filter */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        {/* Sort By Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Sort by:</span>
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer w-full sm:w-auto"
          >
            <option value="totalFuel">Average Fuel (Total)</option>
            <option value="autoSuccess">Auto Success Rate</option>
            <option value="autoFuel">Auto Fuel</option>
            <option value="reliability">Reliability Rating</option>
            <option value="defense">Defense Effectiveness</option>
            <option value="officialRank">Official Event Rank</option>
            <option value="stateRank">State / District Rank</option>
            <option value="matchesScouted">Matches Scouted</option>
          </select>
        </div>

        {/* Filter Input */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter:</span>
          </label>
          <input
            type="text"
            placeholder="Search team #..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 w-full sm:w-40"
          />
        </div>
      </div>

      {/* Main Picklist Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 font-mono font-bold text-slate-400 text-[11px] uppercase">
              <th className="p-3 w-10 text-center">Select</th>
              <th className="p-3 w-12 text-center">#</th>
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
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500">
                  No teams registered. Perform pit or match scouting to populate the picklist.
                </td>
              </tr>
            ) : (
              filteredTeams.map((item, idx) => {
                const isSelected = selectedTeamNums.includes(item.teamNumber);
                const isEditingOfficial = editingRankTeamNum === item.teamNumber && editingRankType === 'official';
                const isEditingState = editingRankTeamNum === item.teamNumber && editingRankType === 'state';

                return (
                  <tr
                    key={item.teamNumber}
                    className={`hover:bg-slate-900/50 transition-colors ${
                      isSelected ? 'bg-amber-950/20 border-l-2 border-l-amber-400' : ''
                    }`}
                  >
                    {/* Select Checkbox */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectTeam(item.teamNumber)}
                        className="p-1 rounded text-slate-400 hover:text-amber-400 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>
                    </td>

                    {/* Picklist Rank */}
                    <td className="p-3 font-mono font-black text-center text-slate-400 text-xs">
                      {idx + 1}
                    </td>

                    {/* Team Info */}
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span 
                          onClick={() => onNavigate('team-profile', item.teamNumber)}
                          className="font-mono font-black text-amber-400 hover:underline cursor-pointer text-sm sm:text-base"
                        >
                          #{item.teamNumber}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                          {item.teamName}
                        </span>
                      </div>
                    </td>

                    {/* Auto Success */}
                    <td className="p-3 text-center font-mono font-bold text-blue-400">
                      {item.autoSuccessStr}
                    </td>

                    {/* Total Fuel */}
                    <td className="p-3 text-center font-mono font-black text-emerald-400 text-sm">
                      {item.avgTotalFuel.toFixed(1)}
                    </td>

                    {/* Reliability */}
                    <td className="p-3 text-center font-mono font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          item.reliabilityLabel === 'HIGH'
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
                          item.defenseLabel === 'HIGH'
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
              })
            )}
          </tbody>
        </table>
      </div>

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
