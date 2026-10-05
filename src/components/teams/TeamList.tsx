import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { scoutingAssignments } from '../../db/scoutingAssignments';
import { 
  Search, 
  Plus, 
  ChevronRight, 
  Target, 
  CheckCircle2, 
  ArrowUpDown,
  CheckSquare,
  Square
} from 'lucide-react';

interface TeamListProps {
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
  onBack: () => void;
}

export const TeamList: React.FC<TeamListProps> = ({ onNavigate, onBack }) => {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrivetrain, setFilterDrivetrain] = useState<string>('ALL');
  const [filterCapability, setFilterCapability] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'matches' | 'reliability' | 'scouted'>('number');
  const [newTeamNumber, setNewTeamNumber] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [filterAssignedOnly, setFilterAssignedOnly] = useState<boolean>(false);
  const [assignedTeams, setAssignedTeams] = useState<number[]>([]);
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allTeams = await scoutingDB.getAllTeams();
    const allMatches = await scoutingDB.getAllMatches();
    setTeams(allTeams);
    setMatches(allMatches);
    setAssignedTeams(scoutingAssignments.getMyTargetTeams());
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num > 0) {
      onNavigate('team-profile', num);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newTeamNumber.trim(), 10);
    if (isNaN(num) || num <= 0) return;

    const existing = await scoutingDB.getTeam(num);
    if (!existing) {
      const newTeam: TeamProfile = {
        teamNumber: num,
        teamName: `Team ${num}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await scoutingDB.saveTeam(newTeam);
    }
    setShowAddModal(false);
    onNavigate('pit-scout', num);
  };

  const toggleSelectTeam = (teamNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const matchCountMap = new Map<number, number>();
  matches.forEach((m) => {
    matchCountMap.set(m.teamNumber, (matchCountMap.get(m.teamNumber) || 0) + 1);
  });

  const filteredTeams = teams
    .filter((t) => {
      const matchSearch =
        searchQuery === '' ||
        t.teamNumber.toString().includes(searchQuery) ||
        (t.teamName && t.teamName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (filterAssignedOnly) {
        if (!assignedTeams.includes(t.teamNumber)) return false;
      }

      if (filterDrivetrain !== 'ALL') {
        if (t.pit?.drivetrain !== filterDrivetrain) return false;
      }

      if (filterCapability === 'TRENCH') {
        if (t.pit?.bumpTrench !== 'BUMP AND TRENCH' && t.pit?.bumpTrench !== 'BOTH' && t.pit?.bumpTrench !== 'TRENCH ONLY') return false;
      } else if (filterCapability === 'TURRET') {
        if (!t.pit?.shooter?.includes('TURRET')) return false;
      } else if (filterCapability === 'AUTO') {
        if (t.pit?.hasAutonomous !== 'YES') return false;
      } else if (filterCapability === 'PIT') {
        if (!t.pit || Object.keys(t.pit).length === 0) return false;
      } else if (filterCapability === 'NOT_SCOUTED') {
        if (t.pit && Object.keys(t.pit).length > 0) return false;
      } else if (filterCapability === 'MATCHES') {
        if ((matchCountMap.get(t.teamNumber) || 0) === 0) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'number') {
        return a.teamNumber - b.teamNumber;
      } else if (sortBy === 'matches') {
        return (matchCountMap.get(b.teamNumber) || 0) - (matchCountMap.get(a.teamNumber) || 0);
      } else if (sortBy === 'reliability') {
        const score = (t: TeamProfile) => {
          if (t.pit?.reliability === 'VERY RELIABLE') return 4;
          if (t.pit?.reliability === 'MOSTLY RELIABLE') return 3;
          if (t.pit?.reliability === 'SOMEWHAT RELIABLE') return 2;
          if (t.pit?.reliability === 'UNRELIABLE') return 1;
          return 0;
        };
        return score(b) - score(a);
      } else if (sortBy === 'scouted') {
        const getScoutScore = (t: TeamProfile) => {
          let s = 0;
          if (t.pit && Object.keys(t.pit).length > 0) s += 2;
          if ((matchCountMap.get(t.teamNumber) || 0) > 0) s += 1;
          return s;
        };
        return getScoutScore(b) - getScoutScore(a);
      }
      return 0;
    });

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 pb-32 flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-100 tracking-tight font-mono uppercase">
            Teams ({teams.length})
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Team</span>
        </button>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search team number or name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-16 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors font-mono"
        />
        {searchQuery && (
          <button
            type="submit"
            className="absolute right-1.5 top-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer"
          >
            Open
          </button>
        )}
      </form>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {assignedTeams.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterAssignedOnly(!filterAssignedOnly)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                filterAssignedOnly
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-850'
              }`}
            >
              <Target className="w-3 h-3 text-slate-400" />
              <span>Assigned ({assignedTeams.length})</span>
            </button>
          )}
          {['ALL', 'SWERVE', 'TANK / WEST COAST'].map((dt) => (
            <button
              key={dt}
              type="button"
              onClick={() => setFilterDrivetrain(dt)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterDrivetrain === dt
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-850'
              }`}
            >
              {dt === 'TANK / WEST COAST' ? 'Tank' : dt}
            </button>
          ))}

          {['TRENCH', 'TURRET', 'MATCHES', 'PIT', 'NOT_SCOUTED'].map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => setFilterCapability(filterCapability === cap ? 'ALL' : cap)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterCapability === cap
                  ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-900 border border-slate-850'
              }`}
            >
              {cap === 'TRENCH' ? 'Trench' : 
               cap === 'TURRET' ? 'Turret' : 
               cap === 'MATCHES' ? 'Matches' :
               cap === 'PIT' ? 'Pit Scouted' : 'Not Scouted'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="number">Team #</option>
            <option value="scouted">Scouted Status</option>
            <option value="matches">Match Count</option>
            <option value="reliability">Reliability</option>
          </select>
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-2">
        {filteredTeams.length > 0 ? (
          filteredTeams.map((t) => {
            const mCount = matchCountMap.get(t.teamNumber) || 0;
            const pit = t.pit;
            const hasPit = pit && Object.keys(pit).length > 0;
            const isFullyScouted = hasPit && mCount > 0;
            const isSelected = selectedTeamNums.includes(t.teamNumber);

            return (
              <div
                key={t.teamNumber}
                onClick={() => onNavigate('team-profile', t.teamNumber)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                  isSelected ? 'bg-slate-850/60 border-blue-500/50' : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  {/* Compare Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => toggleSelectTeam(t.teamNumber, e)}
                    className="p-1 rounded text-slate-400 hover:text-white cursor-pointer self-center"
                    title="Select for comparison"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>

                  <div className={`w-12 h-11 rounded-xl border flex items-center justify-center font-mono font-black text-base shrink-0 ${
                    isFullyScouted 
                      ? 'bg-slate-950 border-emerald-500/50 text-emerald-400' 
                      : hasPit 
                      ? 'bg-slate-950 border-slate-600 text-slate-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    {t.teamNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {t.teamName}
                      </span>
                      {isFullyScouted && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-black uppercase">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Scouted</span>
                        </div>
                      )}
                      {pit?.reliability && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          pit.reliability === 'UNRELIABLE' ? 'bg-rose-950/80 text-rose-300 border-rose-700' :
                          pit.reliability === 'SOMEWHAT RELIABLE' ? 'bg-amber-950/60 text-amber-300 border-amber-800' :
                          pit.reliability === 'MOSTLY RELIABLE' ? 'bg-blue-950/60 text-blue-300 border-blue-800' :
                          'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        }`}>
                          {pit.reliability}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5 font-mono">
                      <span>Drive: <strong className="text-slate-200">{pit?.drivetrain || '—'}</strong></span>
                      <span>Shooter: <strong className="text-slate-200">{pit?.shooter?.join('/') || '—'}</strong></span>
                      <span>Hopper: <strong className="text-slate-200">{pit?.hopperCapacity ?? '—'}</strong></span>
                      <span>Accuracy: <strong className="text-slate-200">{pit?.shootingAccuracy || '—'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <div className="text-right">
                    <span className="font-mono font-bold text-xs text-slate-300">
                      {mCount} match{mCount === 1 ? '' : 'es'}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
            <p className="text-xs">No teams found matching "{searchQuery}".</p>
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h3 className="font-bold text-base text-white">Register Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
                  Team Number
                </label>
                <input
                  type="number"
                  autoFocus
                  required
                  placeholder="Team number"
                  value={newTeamNumber}
                  onChange={(e) => setNewTeamNumber(e.target.value)}
                  className="w-full text-center text-2xl font-mono font-bold bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-slate-600"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 font-bold text-xs uppercase cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Compare Action Bar */}
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
