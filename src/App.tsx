/**
 * FRC REBUILT Scouting Web App
 * Offline-first, cross-platform competition scouting system
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { HomeScreen } from './components/home/HomeScreen';
import { PitScoutForm } from './components/pit/PitScoutForm';
import { MatchScoutForm } from './components/match/MatchScoutForm';
import { StrategyField } from './components/strategy/StrategyField';
import { TeamList } from './components/teams/TeamList';
import { TeamProfileView } from './components/teams/TeamProfileView';
import { PicklistView } from './components/teams/PicklistView';
import { TeamCompareView } from './components/teams/TeamCompareView';
import { EventDataView } from './components/data/EventDataView';
import { DataManagement } from './components/data/DataManagement';
import { SettingsView } from './components/settings/SettingsView';
import { scoutingDB } from './db/indexedDB';
import { 
  Home, 
  ClipboardList, 
  Gamepad2, 
  Trophy, 
  Users 
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | undefined>(undefined);
  const [selectedMatchNumber, setSelectedMatchNumber] = useState<number | undefined>(undefined);
  const [selectedAlliance, setSelectedAlliance] = useState<'red' | 'blue' | undefined>(undefined);
  const [compareTeamNums, setCompareTeamNums] = useState<number[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [appMode, setAppMode] = useState<'captain' | 'scout'>(() => {
    return (localStorage.getItem('frc_app_mode') as 'captain' | 'scout') || 'captain';
  });

  const handleModeChange = (mode: 'captain' | 'scout') => {
    setAppMode(mode);
    localStorage.setItem('frc_app_mode', mode);
  };

  useEffect(() => {
    // Initialize local database on app start
    scoutingDB.init().finally(() => {
      setIsDbLoaded(true);
    });
  }, []);

  const [navStack, setNavStack] = useState<{view: string, teamNumber?: number, matches?: number, alliance?: 'red' | 'blue', extraParam?: any}[]>([]);

  const handleNavigate = (view: string, teamNumber?: number, extraParam?: any, allianceParam?: 'red' | 'blue') => {
    // Push current state to stack before navigating
    setNavStack(prev => [...prev, {
      view: currentView,
      teamNumber: selectedTeamNumber,
      matches: selectedMatchNumber,
      alliance: selectedAlliance,
      extraParam: currentView === 'compare' ? compareTeamNums : undefined
    }]);

    if (teamNumber) setSelectedTeamNumber(teamNumber);
    if (typeof teamNumber === 'number' && typeof extraParam === 'number') {
      setSelectedMatchNumber(extraParam);
    } else if (view === 'match-scout' && typeof teamNumber === 'number' && extraParam === undefined) {
      setSelectedMatchNumber(undefined);
    }

    if (allianceParam === 'red' || allianceParam === 'blue') {
      setSelectedAlliance(allianceParam);
    } else if (extraParam === 'red' || extraParam === 'blue') {
      setSelectedAlliance(extraParam);
    } else {
      setSelectedAlliance(undefined);
    }

    if (view === 'compare' && Array.isArray(extraParam)) {
      setCompareTeamNums(extraParam);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    if (navStack.length === 0) return;
    const last = navStack[navStack.length - 1];
    setNavStack(prev => prev.slice(0, -1));
    
    // Restore state
    if (last.teamNumber) setSelectedTeamNumber(last.teamNumber);
    if (last.matches) setSelectedMatchNumber(last.matches);
    if (last.alliance) setSelectedAlliance(last.alliance);
    if (last.extraParam && last.view === 'compare') setCompareTeamNums(last.extraParam);
    
    setCurrentView(last.view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-slate-700 selection:text-white">
      {/* Global Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        appMode={appMode}
        onAppModeChange={handleModeChange}
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
              <HomeScreen onNavigate={handleNavigate} onBack={handleBack} appMode={appMode} />
            )}

            {currentView === 'pit-scout' && (
              <PitScoutForm
                initialTeamNumber={selectedTeamNumber}
                onNavigate={handleNavigate}
                onBack={handleBack}
              />
            )}

            {currentView === 'match-scout' && (
              <MatchScoutForm
                initialTeamNumber={selectedTeamNumber}
                initialMatchNumber={selectedMatchNumber}
                initialAlliance={selectedAlliance}
                onNavigate={handleNavigate}
                onBack={handleBack}
              />
            )}

            {currentView === 'strategy-field' && (
              <StrategyField onNavigate={handleNavigate} onBack={handleBack} />
            )}

            {currentView === 'teams' && (
              <TeamList onNavigate={handleNavigate} onBack={handleBack} />
            )}

            {currentView === 'picklist' && (
              <PicklistView onNavigate={handleNavigate} onBack={handleBack} />
            )}

            {currentView === 'compare' && (
              <TeamCompareView
                initialSelectedTeams={compareTeamNums}
                onNavigate={handleNavigate}
                onBack={handleBack}
              />
            )}

            {currentView === 'team-profile' && selectedTeamNumber && (
              <TeamProfileView
                teamNumber={selectedTeamNumber}
                onNavigate={handleNavigate}
                onBack={handleBack}
              />
            )}

            {currentView === 'event-data' && (
              <EventDataView onNavigate={handleNavigate} onBack={handleBack} />
            )}

            {currentView === 'import-export' && (
              <DataManagement onNavigate={handleNavigate} onBack={handleBack} />
            )}

            {currentView === 'settings' && (
              <SettingsView onNavigate={handleNavigate} onBack={handleBack} />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
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
          onClick={() => handleNavigate('picklist')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'picklist' || currentView === 'compare' ? 'text-amber-400 font-bold bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-[10px]">Ranking</span>
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
          onClick={() => handleNavigate('teams')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
            currentView === 'teams' ? 'text-slate-100 font-bold bg-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px]">Teams</span>
        </button>
      </nav>
    </div>
  );
}
