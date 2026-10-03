import React, { useState, useEffect } from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import { DistributeModal } from './DistributeModal';
import { TeamRoomSyncModal } from '../sync/TeamRoomSyncModal';
import { cloudSync, SyncStatus } from '../../db/cloudSync';
import { PantherLogo } from './PantherLogo';
import { 
  Menu, 
  X, 
  Search,
  WifiOff,
  Share2,
  Cloud,
  Radio
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, teamNumber?: number) => void;
  quickSearchTeam?: string;
  onSearchChange?: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudSync.getStatus());
  const isOnline = useOnlineStatus();
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const unsub = cloudSync.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsub();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = parseInt(searchInput.replace(/\D/g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum > 0) {
      onNavigate('team-profile', cleanNum);
      setSearchInput('');
      setMenuOpen(false);
    }
  };

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'picklist', label: 'Ranking' },
    { id: 'compare', label: 'Compare' },
    { id: 'teams', label: 'Teams' },
    { id: 'event-data', label: 'Matches' },
    { id: 'import-export', label: 'Import / Export' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div 
            onClick={() => {
              onNavigate('home');
              setMenuOpen(false);
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <PantherLogo size="sm" className="group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-black text-sm sm:text-base tracking-tight text-white font-mono uppercase leading-tight">
                PANTHER SCOUTS
              </span>
              <span className="text-[10px] text-amber-400 font-mono tracking-wider font-semibold">
                TEAM 9751
              </span>
            </div>
          </div>

          {/* Center Quick Search (Tablet / Desktop) */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500" />
            <input
              type="number"
              placeholder="Team #"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
            />
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Cloud Sync Status Button */}
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors active:scale-95 cursor-pointer ${
                syncStatus.roomCode
                  ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-900 border-slate-750 text-slate-300 hover:bg-slate-800'
              }`}
              title={syncStatus.roomCode ? `Connected to Room ${syncStatus.roomCode}` : 'Join Team Cloud Sync Room'}
            >
              <Cloud className={`w-3.5 h-3.5 ${syncStatus.roomCode ? 'text-emerald-400' : 'text-blue-400'}`} />
              <span className="hidden sm:inline font-mono">
                {syncStatus.roomCode ? syncStatus.roomCode : 'Sync'}
              </span>
              {syncStatus.roomCode && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:inline" />
              )}
            </button>

            <PWAInstallButton />

            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </div>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              aria-label="Navigation Menu"
            >
              {menuOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute top-13 left-0 right-0 bg-slate-950 border-b border-slate-800 shadow-2xl p-4 transition-all duration-150">
            <div className="max-w-md mx-auto space-y-3">
              {/* Mobile team search */}
              <form onSubmit={handleSearchSubmit} className="sm:hidden flex items-center relative w-full">
                <Search className="w-4 h-4 absolute left-3 text-slate-400" />
                <input
                  type="number"
                  placeholder="Jump to Team #"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-16 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold"
                >
                  Go
                </button>
              </form>

              <div className="grid grid-cols-2 gap-1.5">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold text-left transition-colors ${
                      currentView === item.id
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800/80'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Distribute & Install Modal */}
      <DistributeModal
        isOpen={showDistributeModal}
        onClose={() => setShowDistributeModal(false)}
      />

      {/* Team Room Cloud Sync Modal */}
      <TeamRoomSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </>
  );
};
