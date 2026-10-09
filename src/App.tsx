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
  Users,
  Map,
  Settings
} from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number | undefined>(undefined);
  const [selectedMatchNumber, setSelectedMatchNumber] = useState<number | undefined>(undefined);
  const [selectedAlliance, setSelectedAlliance] = useState<'red' | 'blue' | undefined>(undefined);
  const [compareTeamNums, setCompareTeamNums] = useState<number[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [appMode, setAppMode] = useState<'captain' | 'scout'>(() => {
    return (localStorage.getItem('frc_app_mode') as 'captain' | 'scout') || 'scout';
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
                appMode={appMode}
              />
            )}

            {currentView === 'strategy-field' && (
              <StrategyField onNavigate={handleNavigate} onBack={handleBack} />
            )}

            {currentView === 'teams' && (
              <TeamList onNavigate={handleNavigate} onBack={handleBack} appMode={appMode} />
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
              <SettingsView 
                onNavigate={handleNavigate} 
                onBack={handleBack} 
                appMode={appMode} 
                onAppModeChange={handleModeChange} 
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {appMode === 'captain' && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/85 border-t border-slate-800/80 backdrop-blur-xl px-1.5 py-1 flex items-center justify-around shadow-2xl select-none">
          {[
            { id: 'home', label: 'Home', icon: Home, isActive: currentView === 'home' },
            { id: 'picklist', label: 'Ranking', icon: Trophy, isActive: currentView === 'picklist' || currentView === 'compare' },
            { id: 'teams', label: 'Teams', icon: Users, isActive: currentView === 'teams' },
            { id: 'strategy-field', label: 'Strategy', icon: Map, isActive: currentView === 'strategy-field' },
            { id: 'settings', label: 'Settings', icon: Settings, isActive: currentView === 'settings' },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNavigate(tab.id)}
                className="no-active-scale relative flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl cursor-pointer group focus:outline-none"
              >
                {/* Smooth pill background without abrupt layout shifts */}
                <div
                  className={`absolute inset-0 rounded-xl transition-all duration-200 pointer-events-none ${
                    tab.isActive
                      ? 'bg-amber-400/10 border border-amber-400/25 shadow-sm'
                      : 'bg-transparent border border-transparent'
                  }`}
                />
                
                <Icon
                  className={`relative w-4 h-4 transition-colors duration-200 ${
                    tab.isActive
                      ? 'text-amber-400'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span
                  className={`relative text-[10px] tracking-tight transition-colors duration-200 ${
                    tab.isActive
                      ? 'text-amber-400 font-bold'
                      : 'text-slate-400 font-medium group-hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
