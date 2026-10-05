import React, { useState, useEffect } from 'react';
import { scoutingDB } from '../../db/indexedDB';
import { importEventRosterAndRankings, bulkImportTeams } from '../../utils/rankingsSync';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { 
  Sliders, 
  Calendar, 
  Database, 
  Check, 
  Smartphone,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface SettingsViewProps {
  onNavigate: (view: string) => void;
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate, onBack }) => {
  const [eventCode, setEventCode] = useState('');
  const [tbaApiKey, setTbaApiKey] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [teamCount, setTeamCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [savedToast, setSavedToast] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [tbaStatusMsg, setTbaStatusMsg] = useState<string | null>(null);
  const [isFetchingTba, setIsFetchingTba] = useState(false);
  const [isClearingUnscouted, setIsClearingUnscouted] = useState(false);
  const [unscoutedResultMsg, setUnscoutedResultMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    let code = await scoutingDB.getSetting<string>('eventCode', '');
    if (code === '2025micmp') {
      await scoutingDB.setSetting('eventCode', '');
      localStorage.removeItem('frc_active_event_code');
      code = '';
    }
    const key = await scoutingDB.getSetting<string>('tbaApiKey', '');
    setEventCode(code);
    setTbaApiKey(key);

    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    setTeamCount(teams.length);
    setMatchCount(matches.length);
  };

  const handleClearUnscoutedTeams = async () => {
    setIsClearingUnscouted(true);
    setUnscoutedResultMsg(null);
    try {
      const allTeams = await scoutingDB.getAllTeams();
      const allMatches = await scoutingDB.getAllMatches();
      const teamNumsWithMatches = new Set(allMatches.map((m) => m.teamNumber));

      let deletedCount = 0;
      for (const t of allTeams) {
        const hasPit = t.pit && (t.pit.drivetrain || t.pit.reliability || t.pit.lastUpdated || (t.pit.photos && t.pit.photos.length > 0));
        const hasMatches = teamNumsWithMatches.has(t.teamNumber);
        if (!hasPit && !hasMatches) {
          await scoutingDB.deleteTeam(t.teamNumber);
          deletedCount++;
        }
      }
      setUnscoutedResultMsg(`Removed ${deletedCount} unscouted teams from roster.`);
      await loadSettings();
      setTimeout(() => setUnscoutedResultMsg(null), 3500);
    } catch {
      setUnscoutedResultMsg('Failed to clear unscouted teams.');
    } finally {
      setIsClearingUnscouted(false);
    }
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
    await scoutingDB.setSetting('eventCode', eventCode);
    await scoutingDB.setSetting('tbaApiKey', tbaApiKey);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-28 flex flex-col gap-5">
      <div className="pb-1 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2 font-mono">
          <Sliders className="w-5 h-5 text-slate-400" />
          <span>Settings</span>
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Event Code & TBA */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Event Code</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="2026REBUILT"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-slate-600"
              />
              <button
                type="button"
                disabled={isFetchingTba}
                onClick={async () => {
                  setIsFetchingTba(true);
                  setTbaStatusMsg(null);
                  await scoutingDB.setSetting('eventCode', eventCode);
                  if (tbaApiKey) await scoutingDB.setSetting('tbaApiKey', tbaApiKey);
                  const res = await importEventRosterAndRankings(eventCode);
                  setTbaStatusMsg(res.message);
                  setIsFetchingTba(false);
                  loadSettings();
                  setTimeout(() => {
                    setTbaStatusMsg(null);
                  }, 3000);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 disabled:opacity-50 text-slate-200 border border-slate-800 font-mono font-bold text-xs uppercase cursor-pointer shrink-0 transition-colors"
              >
                {isFetchingTba ? 'Fetching...' : 'Fetch Teams'}
              </button>
            </div>
            {tbaStatusMsg && (
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
                {tbaStatusMsg}
              </div>
            )}
          </div>

          {/* Manual Bulk Team Numbers */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 block flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Team Numbers List</span>
            </label>
            <div className="flex flex-col gap-2">
              <textarea
                rows={2}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="9751, 3322, 1684, 254, 1678..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-slate-600 resize-none"
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
                className="py-2 px-3.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 font-mono font-bold text-xs uppercase cursor-pointer transition-colors"
              >
                Add Teams To Roster
              </button>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-100 border border-slate-800 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm active:scale-98 cursor-pointer"
        >
          Save Preferences
        </button>

        {savedToast && (
          <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs text-center font-bold flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Settings saved.</span>
          </div>
        )}
      </form>

      {/* PWA & Storage Info */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-300">
            <Smartphone className="w-4 h-4 text-slate-400" />
            <span>App Status</span>
          </div>
          <PWAInstallButton />
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Local Storage:</span>
          <span className="text-slate-200 font-bold">
            {teamCount} Teams • {matchCount} Matches
          </span>
        </div>
      </div>

      {/* Manage Teams Data */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <button
          type="button"
          disabled={isClearingUnscouted}
          onClick={handleClearUnscoutedTeams}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 font-mono"
        >
          <Trash2 className="w-4 h-4 text-slate-400" />
          <span>{isClearingUnscouted ? 'Clearing...' : 'Clear Unscouted Teams Roster'}</span>
        </button>
        {unscoutedResultMsg && (
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono text-center">
            {unscoutedResultMsg}
          </div>
        )}
      </div>

      {/* Erase All Data */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => setShowClearModal(true)}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 text-rose-400 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Erase All Local Data</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-100">Erase All Local Data?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete all teams, matches, photos, and routines stored on this device.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="flex-1 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="flex-1 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold text-xs cursor-pointer shadow disabled:opacity-50"
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
