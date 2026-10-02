import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  Search, 
  Plus, 
  ChevronRight, 
  Filter, 
  Target, 
  CheckCircle2, 
  AlertTriangle,
  Camera,
  Layers,
  Flame,
  ArrowUpDown
} from 'lucide-react';

interface TeamListProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const TeamList: React.FC<TeamListProps> = ({ onNavigate }) => {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrivetrain, setFilterDrivetrain] = useState<string>('ALL');
  const [filterCapability, setFilterCapability] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'matches' | 'reliability'>('number');
  const [newTeamNumber, setNewTeamNumber] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allTeams = await scoutingDB.getAllTeams();
    const allMatches = await scoutingDB.getAllMatches();
    setTeams(allTeams);
    setMatches(allMatches);
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

  // Pre-calculate match counts
  const matchCountMap = new Map<number, number>();
  matches.forEach((m) => {
    matchCountMap.set(m.teamNumber, (matchCountMap.get(m.teamNumber) || 0) + 1);
  });

  // Filter & Sort
  const filteredTeams = teams
    .filter((t) => {
      const matchSearch =
        searchQuery === '' ||
        t.teamNumber.toString().includes(searchQuery) ||
        (t.teamName && t.teamName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (filterDrivetrain !== 'ALL') {
        if (t.pit?.drivetrain !== filterDrivetrain) return false;
      }

      if (filterCapability === 'TRENCH') {
        if (t.pit?.bumpTrench !== 'BOTH' && t.pit?.bumpTrench !== 'TRENCH ONLY') return false;
      } else if (filterCapability === 'TURRET') {
        if (!t.pit?.shooter?.includes('TURRET')) return false;
      } else if (filterCapability === 'AUTO') {
        if (t.pit?.hasAutonomous !== 'YES') return false;
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
          return 1;
        };
        return score(b) - score(a);
      }
      return 0;
    });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 flex flex-col gap-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-100 tracking-tight font-mono">
            Teams Registry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {teams.length} registered teams • Fast search and filtering
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider shadow transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search team # (e.g. 9751) or name (Press Enter to open)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-20 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors font-mono"
        />
        {searchQuery && (
          <button
            type="submit"
            className="absolute right-2 top-2 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold"
          >
            Open
          </button>
        )}
      </form>

      {/* Filter & Sort Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-medium">Filter:</span>
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

          {['TRENCH', 'TURRET', 'MATCHES'].map((cap) => (
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
              {cap === 'TRENCH' ? 'Trench Traversal' : cap === 'TURRET' ? 'Turret Shooter' : 'Has Matches'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 text-xs focus:outline-none"
          >
            <option value="number">Sort by Team #</option>
            <option value="matches">Sort by Match Count</option>
            <option value="reliability">Sort by Reliability</option>
          </select>
        </div>
      </div>

      {/* Team Cards Scrollable List */}
      <div className="space-y-2.5">
        {filteredTeams.length > 0 ? (
          filteredTeams.map((t) => {
            const mCount = matchCountMap.get(t.teamNumber) || 0;
            const pit = t.pit;

            return (
              <div
                key={t.teamNumber}
                onClick={() => onNavigate('team-profile', t.teamNumber)}
                className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-14 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-lg text-white group-hover:border-blue-500 transition-colors shrink-0">
                    {t.teamNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {t.teamName}
                      </span>
                      {pit?.reliability && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pit.reliability === 'VERY RELIABLE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : pit.reliability === 'MOSTLY RELIABLE'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {pit.reliability}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1 font-mono">
                      <span>Drive: <strong className="text-slate-200">{pit?.drivetrain || '—'}</strong></span>
                      <span>Shooter: <strong className="text-slate-200">{pit?.shooter?.join('/') || '—'}</strong></span>
                      <span>Hopper: <strong className="text-amber-400">{pit?.hopperCapacity ?? '—'}</strong></span>
                      <span>Accuracy: <strong className="text-emerald-400">{pit?.shootingAccuracy || '—'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Matches</span>
                    <span className="font-mono font-bold text-xs text-slate-200">
                      {mCount} recorded
                    </span>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
            <p className="text-sm">No teams found matching query "{searchQuery}".</p>
            {searchQuery && (
              <button
                onClick={() => {
                  const num = parseInt(searchQuery, 10);
                  if (!isNaN(num) && num > 0) {
                    onNavigate('pit-scout', num);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase"
              >
                Create Team {searchQuery}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-black text-lg text-white mb-2">Register New Team</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the FRC team number to begin pit scouting.
            </p>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-1">
                  Team Number
                </label>
                <input
                  type="number"
                  autoFocus
                  required
                  placeholder="e.g. 9751"
                  value={newTeamNumber}
                  onChange={(e) => setNewTeamNumber(e.target.value)}
                  className="w-full text-center text-2xl font-mono font-bold bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
