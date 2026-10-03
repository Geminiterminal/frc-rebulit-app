import React, { useState, useEffect } from 'react';
import { scoutingDB } from '../../db/indexedDB';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { 
  Sliders, 
  User, 
  Calendar, 
  Database, 
  Check, 
  Info,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

interface SettingsViewProps {
  onNavigate: (view: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const [scoutName, setScoutName] = useState('');
  const [eventCode, setEventCode] = useState('2026REBUILT');
  const [tbaApiKey, setTbaApiKey] = useState('');
  const [teamCount, setTeamCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const name = await scoutingDB.getSetting<string>('scoutName', '');
    const code = await scoutingDB.getSetting<string>('eventCode', '2026REBUILT');
    const key = await scoutingDB.getSetting<string>('tbaApiKey', '');
    setScoutName(name);
    setEventCode(code);
    setTbaApiKey(key);

    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    setTeamCount(teams.length);
    setMatchCount(matches.length);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await scoutingDB.setSetting('scoutName', scoutName);
    await scoutingDB.setSetting('eventCode', eventCode);
    await scoutingDB.setSetting('tbaApiKey', tbaApiKey);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 flex flex-col gap-6">
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 text-amber-400" />
          <span>Scouting Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure scout attribution, event preferences, and local storage.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Scout Name */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <label className="text-xs font-mono font-bold uppercase text-slate-300 block flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>Default Scout Name or Initials</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Alex M. or Lead Scout"
            value={scoutName}
            onChange={(e) => setScoutName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-[11px] text-slate-400">
            Automatically attached to all new pit profiles and match scouting records.
          </p>
        </div>

        {/* Event Code & TBA Key */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 block flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Event Code (e.g. 2026cmp or 2026micmp)</span>
            </label>
            <input
              type="text"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
              placeholder="2026REBUILT"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 block flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Optional TBA Auth Key (The Blue Alliance)</span>
            </label>
            <input
              type="password"
              value={tbaApiKey}
              onChange={(e) => setTbaApiKey(e.target.value)}
              placeholder="Paste TBA API Key..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Optional API Key for live qualification event rankings from The Blue Alliance.
            </p>
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow active:scale-95"
        >
          Save Preferences
        </button>

        {savedToast && (
          <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-300 text-xs text-center font-bold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>Settings saved locally.</span>
          </div>
        )}
      </form>

      {/* PWA & System info */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-400" />
          <span>Progressive Web App Status</span>
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          This scouting application is a standalone PWA. When installed or cached by your browser, it runs completely offline without any internet connection.
        </p>

        <div className="pt-2">
          <PWAInstallButton />
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Local IndexedDB:</span>
          <span className="text-white font-bold">
            {teamCount} Teams • {matchCount} Matches
          </span>
        </div>
      </div>
    </div>
  );
};
