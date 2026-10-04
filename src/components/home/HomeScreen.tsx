import React from 'react';
import { CaptainDashboard } from '../captain/CaptainDashboard';
import { ScoutDashboard } from '../scout/ScoutDashboard';

interface HomeScreenProps {
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
  appMode: 'captain' | 'scout';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, appMode }) => {
  return appMode === 'captain' ? (
    <CaptainDashboard onNavigate={onNavigate} />
  ) : (
    <ScoutDashboard onNavigate={onNavigate} />
  );
};
