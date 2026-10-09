import React, { useState } from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import { PantherLogo } from './PantherLogo';
import { 
  Menu, 
  X, 
  Search, 
  WifiOff,
  Home,
  Trophy,
  Users,
  Map,
  TrendingUp,
  FolderDown,
  Settings,
  Scale
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
  const isOnline = useOnlineStatus();
  const [searchInput, setSearchInput] = useState('');

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
    { id: 'home', label: 'Home', icon: Home },
    { id: 'picklist', label: 'Ranking', icon: Trophy },
    { id: 'strategy-field', label: 'Strategy', icon: Map },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'compare', label: 'Compare', icon: Scale },
    { id: 'event-data', label: 'Matches', icon: TrendingUp },
    { id: 'import-export', label: 'Backup / Sync', icon: FolderDown },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          {/* Brand matching exact image */}
          <div 
            onClick={() => {
              onNavigate('home');
              setMenuOpen(false);
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          >
            <PantherLogo size="sm" className="group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-black text-xs sm:text-sm tracking-tight text-white font-mono uppercase leading-tight">
                PANTHER SCOUTS
              </span>
              <span className="text-[10px] text-amber-500 font-mono tracking-wider font-bold">
                TEAM 9751
              </span>
            </div>
          </div>

          {/* Right Actions matching exact image */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />

            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono">
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </div>
            )}

            {/* Menu Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              aria-label="Navigation Menu"
            >
              {menuOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-slate-950/95 border-b border-slate-800 shadow-2xl p-3.5 backdrop-blur-md transition-all">
            <div className="max-w-md mx-auto space-y-2.5">
              {/* Team Jump Input */}
              <form onSubmit={handleSearchSubmit} className="flex items-center relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
                <input
                  type="number"
                  placeholder="Team number"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-14 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-bold"
                >
                  Go
                </button>
              </form>

              <div className="grid grid-cols-2 gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setMenuOpen(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer flex items-center gap-2 ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
