/**
 * FRC REBUILT Scouting Web App
 * Offline-first, cross-platform competition scouting system
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { HomeScreen } from './components/home/HomeScreen';
import { PitScoutForm } from './components/pit/PitScoutForm';
import { MatchScoutForm } from './components/match/MatchScoutForm';
import { StrategyField } from './components/strategy/StrategyField';
import { TeamList } from './components/teams/TeamList';
import { TeamProfileView } from './components/teams/TeamProfileView';
import { EventDataView } from './components/data/EventDataView';
import { DataManagement } from './components/data/DataManagement';
import { SettingsView } from './components/settings/SettingsView';
import { scoutingDB } from './db/indexedDB';
import { 
  Home, 
  ClipboardList, 
  Gamepad2, 
  Map, 
  Users 
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | undefined>(undefined);
  const [selectedMatchNumber, setSelectedMatchNumber] = useState<number | undefined>(undefined);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Seed sample data on first run if empty
    scoutingDB.seedInitialDataIfEmpty().finally(() => {
      setIsDbLoaded(true);
    });
  }, []);

  const handleNavigate = (view: string, teamNumber?: number, matchNumber?: number) => {
    if (teamNumber) setSelectedTeamNumber(teamNumber);
    if (matchNumber) setSelectedMatchNumber(matchNumber);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-slate-700 selection:text-white">
      {/* Global Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pb-16 sm:pb-8">
        {!isDbLoaded ? (
          <div className="max-w-md mx-auto p-12 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono uppercase tracking-wider">
              Initializing Local Database...
            </p>
          </div>
        ) : (
          <>
            {currentView === 'home' && (
              <HomeScreen onNavigate={handleNavigate} />
            )}

            {currentView === 'pit-scout' && (
              <PitScoutForm
                initialTeamNumber={selectedTeamNumber}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'match-scout' && (
              <MatchScoutForm
                initialTeamNumber={selectedTeamNumber}
                initialMatchNumber={selectedMatchNumber}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'strategy-field' && (
              <StrategyField onNavigate={handleNavigate} />
            )}

            {currentView === 'teams' && (
              <TeamList onNavigate={handleNavigate} />
            )}

            {currentView === 'team-profile' && selectedTeamNumber && (
              <TeamProfileView
                teamNumber={selectedTeamNumber}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'event-data' && (
              <EventDataView onNavigate={handleNavigate} />
            )}

            {currentView === 'import-export' && (
              <DataManagement onNavigate={handleNavigate} />
            )}

            {currentView === 'settings' && (
              <SettingsView onNavigate={handleNavigate} />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Persistent quick access on phones) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-md px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'home' ? 'text-slate-100 font-bold bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('pit-scout')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'pit-scout' ? 'text-slate-100 font-bold bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span className="text-[10px]">Pit</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('match-scout')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'match-scout' ? 'text-slate-100 font-bold bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span className="text-[10px]">Match</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('strategy-field')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'strategy-field' ? 'text-slate-100 font-bold bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Map className="w-4 h-4" />
          <span className="text-[10px]">Field</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('teams')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'teams' || currentView === 'team-profile'
              ? 'text-slate-100 font-bold bg-slate-900'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px]">Teams</span>
        </button>
      </nav>

      {/* Global Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
}
