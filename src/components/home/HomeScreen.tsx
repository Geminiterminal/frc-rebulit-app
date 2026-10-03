import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Gamepad2, 
  Map, 
  Search, 
  Users, 
  TrendingUp, 
  FolderDown, 
  Sliders, 
  ChevronRight,
  Share2,
  QrCode,
  Cloud,
  Radio,
  Zap,
  Target,
  Trophy
} from 'lucide-react';
import { scoutingDB } from '../../db/indexedDB';
import { TeamProfile } from '../../types/scouting';
import { DistributeModal } from '../common/DistributeModal';
import { TeamRoomSyncModal } from '../sync/TeamRoomSyncModal';
import { cloudSync, SyncStatus } from '../../db/cloudSync';
import { PantherLogo } from '../common/PantherLogo';

interface HomeScreenProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const [teamSearch, setTeamSearch] = useState('');
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [showDistribute, setShowDistribute] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudSync.getStatus());

  useEffect(() => {
    loadSummary();
    const unsub = cloudSync.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsub();
  }, []);

  const loadSummary = async () => {
    const allTeams = await scoutingDB.getAllTeams();
    setTeams(allTeams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = parseInt(teamSearch.replace(/\D/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum > 0) {
      onNavigate('team-profile', cleanNum);
    }
  };

  return (
    <>
      <div className="max-w-xl mx-auto px-3.5 sm:px-5 py-6 pb-28 flex flex-col gap-6">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
          <input
            type="number"
            placeholder="Search Team # (e.g. 9751, 254, 1678)..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-20 py-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Open
          </button>
        </form>

        {/* PRIMARY FUNCTIONS */}
        <div className="grid grid-cols-1 gap-3.5">
          {/* 1. PICKLIST & COMPARISON */}
          <button
            type="button"
            onClick={() => onNavigate('picklist')}
            className="group text-left p-5 sm:p-5.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-amber-500/30 hover:border-amber-500/60 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-black text-amber-400 tracking-tight font-mono">
                  RANKING
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 2. PIT SCOUT */}
          <button
            type="button"
            onClick={() => onNavigate('pit-scout')}
            className="group text-left p-5 sm:p-5.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-750 text-slate-200 flex items-center justify-center group-hover:bg-blue-950/60 group-hover:border-blue-700/60 group-hover:text-blue-300 transition-colors">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="text-base sm:text-lg font-black text-slate-100 tracking-tight font-mono">
                PIT SCOUTING
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 3. MATCH SCOUT */}
          <button
            type="button"
            onClick={() => onNavigate('match-scout')}
            className="group text-left p-5 sm:p-5.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-750 text-slate-200 flex items-center justify-center group-hover:bg-emerald-950/60 group-hover:border-emerald-700/60 group-hover:text-emerald-300 transition-colors">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div className="text-base sm:text-lg font-black text-slate-100 tracking-tight font-mono">
                MATCH SCOUTING
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />
          </button>

          {/* 4. STRATEGY FIELD */}
          <button
            type="button"
            onClick={() => onNavigate('strategy-field')}
            className="group text-left p-5 sm:p-5.5 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-750 text-slate-200 flex items-center justify-center group-hover:bg-purple-950/60 group-hover:border-purple-700/60 group-hover:text-purple-300 transition-colors">
                <Map className="w-5 h-5" />
              </div>
              <div className="text-base sm:text-lg font-black text-slate-100 tracking-tight font-mono">
                STRATEGY & WHITEBOARD
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Quick Team Chips */}
        {teams.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-0.5">
              <span className="uppercase font-mono tracking-wider">Recently Scouted Teams ({teams.length})</span>
              <button
                type="button"
                onClick={() => onNavigate('teams')}
                className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
              >
                View All →
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {teams.slice(0, 8).map((t) => (
                <button
                  key={t.teamNumber}
                  type="button"
                  onClick={() => onNavigate('team-profile', t.teamNumber)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono font-semibold transition-colors cursor-pointer"
                >
                  {t.teamNumber}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Secondary Menu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('teams')}
            className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm"
          >
            <Users className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-slate-200">Teams</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('event-data')}
            className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-slate-200">Matches</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('import-export')}
            className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm"
          >
            <FolderDown className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-slate-200">Export/Sync</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm"
          >
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm text-slate-200">Settings</span>
          </button>
        </div>
      </div>

      <DistributeModal
        isOpen={showDistribute}
        onClose={() => setShowDistribute(false)}
      />

      <TeamRoomSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </>
  );
};
