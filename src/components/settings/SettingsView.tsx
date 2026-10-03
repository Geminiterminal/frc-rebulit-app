import React, { useState, useEffect } from 'react';
import { scoutingDB } from '../../db/indexedDB';
import { importEventRosterAndRankings, bulkImportTeams } from '../../utils/rankingsSync';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { 
  Sliders, 
  User, 
  Calendar, 
  Database, 
  Check, 
  Info,
  Smartphone,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface SettingsViewProps {
  onNavigate: (view: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const [scoutName, setScoutName] = useState('');
  const [eventCode, setEventCode] = useState('2025micmp');
  const [tbaApiKey, setTbaApiKey] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [teamCount, setTeamCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [savedToast, setSavedToast] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await scoutingDB.clearAllData();
      setShowClearModal(false);
      window.location.reload();
    } catch {
      setIsClearing(false);
    }
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
            placeholder="Scout Name or Initials"
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
              <span>Event Code (2026cmp or 2026micmp)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="2026REBUILT"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={async () => {
                  await scoutingDB.setSetting('eventCode', eventCode);
                  if (tbaApiKey) await scoutingDB.setSetting('tbaApiKey', tbaApiKey);
                  const res = await importEventRosterAndRankings(eventCode);
                  alert(res.message);
                  loadSettings();
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase cursor-pointer shrink-0"
              >
                Fetch Event Teams
              </button>
            </div>
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

          {/* Manual Bulk Team Import */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 block flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Paste Team Numbers (Comma or Space separated)</span>
            </label>
            <div className="flex flex-col gap-2">
              <textarea
                rows={2}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="9751, 3322, 1684, 254, 1678..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!bulkInput.trim()) return;
                  const res = await bulkImportTeams(bulkInput);
                  alert(res.message);
                  setBulkInput('');
                  loadSettings();
                }}
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs uppercase cursor-pointer"
              >
                Bulk Add Teams To Roster
              </button>
            </div>
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

      {/* Danger Zone: Erase All Data */}
      <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-3">
        <div className="flex items-center gap-2 text-rose-400">
          <Trash2 className="w-4 h-4" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider">
            Reset & Erase Database
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Permanently deletes all teams, match observations, pit notes, and drawings on this device.
        </p>
        <button
          type="button"
          onClick={() => setShowClearModal(true)}
          className="w-full py-2.5 px-4 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Erase All Data</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-100">Erase All Data?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete all teams, matches, photos, and drawings stored on this device.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow disabled:opacity-50"
              >
                {isClearing ? 'Erasing...' : 'Yes, Erase All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
