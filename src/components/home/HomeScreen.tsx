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
  Zap
} from 'lucide-react';
import { scoutingDB } from '../../db/indexedDB';
import { TeamProfile } from '../../types/scouting';
import { DistributeModal } from '../common/DistributeModal';
import { TeamRoomSyncModal } from '../sync/TeamRoomSyncModal';
import { cloudSync, SyncStatus } from '../../db/cloudSync';

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
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-3.5">
        {/* Cloud Room Status Pill (if connected) */}
        {syncStatus.roomCode && (
          <div 
            onClick={() => setShowSyncModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/80 flex items-center justify-between cursor-pointer hover:bg-emerald-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-300 font-mono">
                ROOM: {syncStatus.roomCode}
              </span>
              <span className="text-[11px] text-emerald-400/80 hidden sm:inline">
                • Live Auto-Syncing Active
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-700/60">
              Manage
            </span>
          </div>
        )}

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="number"
            placeholder="Search Team # (e.g. 9751)"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-16 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Open
          </button>
        </form>

        {/* THREE LARGE PRIMARY FUNCTIONS (Calm, dark, matte) */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* 1. PIT SCOUT */}
          <button
            type="button"
            onClick={() => onNavigate('pit-scout')}
            className="group text-left p-4 sm:p-4.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 flex items-center justify-center">
                <ClipboardList className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-200 tracking-tight font-mono">
                  1. PIT SCOUT
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* 2. MATCH SCOUT */}
          <button
            type="button"
            onClick={() => onNavigate('match-scout')}
            className="group text-left p-4 sm:p-4.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 flex items-center justify-center">
                <Gamepad2 className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-200 tracking-tight font-mono">
                  2. MATCH SCOUT
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* 3. STRATEGY FIELD */}
          <button
            type="button"
            onClick={() => onNavigate('strategy-field')}
            className="group text-left p-4 sm:p-4.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-150 active:scale-[0.99] cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 flex items-center justify-center">
                <Map className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-200 tracking-tight font-mono">
                  3. STRATEGY FIELD
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        {/* Quick Team Chips */}
        {teams.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-0.5">
            {teams.slice(0, 7).map((t) => (
              <button
                key={t.teamNumber}
                type="button"
                onClick={() => onNavigate('team-profile', t.teamNumber)}
                className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80 text-xs font-mono font-medium transition-colors"
              >
                {t.teamNumber}
              </button>
            ))}
          </div>
        )}

        {/* Secondary Menu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onNavigate('teams')}
            className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-xs text-slate-300">Teams</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('event-data')}
            className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-xs text-slate-300">Matches</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('import-export')}
            className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FolderDown className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-xs text-slate-300">Import / Export</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-850 text-left border border-slate-800/80 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-xs text-slate-300">Settings</span>
          </button>
        </div>

        {/* Cloud Auto-Sync & Distribute Banners */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Cloud Auto-Sync Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                syncStatus.roomCode 
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400' 
                  : 'bg-blue-950/60 border-blue-800/80 text-blue-400'
              }`}>
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {syncStatus.roomCode ? `Synced: ${syncStatus.roomCode}` : 'Team Cloud Auto-Sync'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {syncStatus.roomCode ? 'Live multi-scout sync' : 'Sync scouts anywhere'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-sm cursor-pointer ${
                syncStatus.roomCode
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {syncStatus.roomCode ? 'Status' : 'Join'}
            </button>
          </div>

          {/* Distribute Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Share App Link</div>
                <div className="text-[11px] text-slate-400">Install PWA on phones</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDistribute(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
            >
              Share
            </button>
          </div>
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
