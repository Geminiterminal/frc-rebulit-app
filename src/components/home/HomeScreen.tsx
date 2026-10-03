import React from 'react';
import { CaptainDashboard } from '../captain/CaptainDashboard';
import { ScoutDashboard } from '../scout/ScoutDashboard';

interface HomeScreenProps {
  onNavigate: (view: string, teamNumber?: number) => void;
  appMode: 'captain' | 'scout';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, appMode }) => {
  return (
    <div className="max-w-md mx-auto px-2 sm:px-3 py-2 pb-24 flex flex-col gap-3 font-mono">
      {/* Main Dashboard Render */}
      {appMode === 'captain' ? (
        <CaptainDashboard onNavigate={onNavigate} />
      ) : (
        <ScoutDashboard onNavigate={onNavigate} />
      )}
    </div>
  );
};
