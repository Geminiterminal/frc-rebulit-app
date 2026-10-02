import React, { useState, useRef } from 'react';
import { scoutingDB } from '../../db/indexedDB';
import { ScoutingDatabaseExport } from '../../types/scouting';
import { 
  Download, 
  Upload, 
  Trash2,
  Sparkles, 
  Check, 
  AlertTriangle,
  X
} from 'lucide-react';

interface DataManagementProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({ onNavigate }) => {
  const [exportStats, setExportStats] = useState<{ teams: number; matches: number } | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-app Confirmation Modals (NO window.confirm!)
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showSeedModal, setShowSeedModal] = useState<boolean>(false);

  // Conflict resolution modal
  const [pendingImportData, setPendingImportData] = useState<ScoutingDatabaseExport | null>(null);
  const [conflictTeamsCount, setConflictTeamsCount] = useState<number>(0);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const data = await scoutingDB.exportFullDatabase();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FRC_REBUILT_Scouting_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStats({ teams: data.teams.length, matches: data.matchRecords.length });
    } catch (e: any) {
      setErrorMsg(`Export failed: ${e.message}`);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data: ScoutingDatabaseExport = JSON.parse(text);

        if (!data || !Array.isArray(data.teams)) {
          throw new Error('Invalid scouting backup file format.');
        }

        const existingTeams = await scoutingDB.getAllTeams();
        const existingSet = new Set(existingTeams.map((t) => t.teamNumber));
        const conflicts = data.teams.filter((t) => existingSet.has(t.teamNumber)).length;

        if (conflicts > 0) {
          setPendingImportData(data);
          setConflictTeamsCount(conflicts);
          setShowConflictModal(true);
        } else {
          const res = await scoutingDB.importDatabase(data, 'update');
          setImportResult(`Imported ${res.importedTeams} teams and ${res.importedMatches} matches.`);
        }
      } catch (err: any) {
        setErrorMsg(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeImportMode = async (mode: 'update' | 'keep' | 'replace') => {
    if (!pendingImportData) return;
    try {
      const res = await scoutingDB.importDatabase(pendingImportData, mode);
      setShowConflictModal(false);
      setPendingImportData(null);
      setImportResult(
        `Import complete (${mode}): ${res.importedTeams} teams, ${res.importedMatches} matches.`
      );
    } catch (err: any) {
      setErrorMsg(`Import failed: ${err.message}`);
    }
  };

  const executeResetSampleData = async () => {
    try {
      await scoutingDB.seedSampleData();
      setShowSeedModal(false);
      setImportResult('Sample competition data initialized (Teams 9751, 254, 1678).');
    } catch (err: any) {
      setErrorMsg(`Failed to seed data: ${err.message}`);
    }
  };

  const executeClearAll = async () => {
    try {
      await scoutingDB.clearAllData();
      setShowClearModal(false);
      setImportResult('All local scouting data has been completely erased (0 teams, 0 matches).');
      setExportStats({ teams: 0, matches: 0 });
    } catch (err: any) {
      setErrorMsg(`Failed to clear database: ${err.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-28 flex flex-col gap-5">
      {/* Header */}
      <div className="pb-1 border-b border-slate-800">
        <h1 className="text-xl font-black text-slate-100 tracking-tight font-mono">
          Backup & Data Management
        </h1>
      </div>

      {/* Main Export & Import Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* EXPORT DATA */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-200 uppercase font-mono">
              Export Data
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Download JSON backup file with all teams, photos, drawings, and matches.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleExport}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-colors shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Download Backup</span>
            </button>

            {exportStats && (
              <div className="mt-2 text-center text-xs text-slate-400 font-mono">
                ✓ {exportStats.teams} teams, {exportStats.matches} matches
              </div>
            )}
          </div>
        </div>

        {/* IMPORT DATA */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-750 text-slate-300 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-200 uppercase font-mono">
              Import Data
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Load a backup file generated by another device.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-colors shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Select File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Toasts */}
      {importResult && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{importResult}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-slate-900 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Database Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={() => setShowSeedModal(true)}
          className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-left transition-colors flex items-center gap-3 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-200">Load Sample Data</div>
            <div className="text-[11px] text-slate-400">Team 9751 & test records</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowClearModal(true)}
          className="p-3.5 rounded-xl bg-slate-900 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/60 text-left transition-colors flex items-center gap-3 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-rose-300">Erase All Data</div>
            <div className="text-[11px] text-slate-400">Clear local database completely</div>
          </div>
        </button>
      </div>

      {/* IN-APP CONFIRMATION MODAL: ERASE ALL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-100">Erase All Data?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete all teams, pit scouting answers, autonomous drawings, photos, and match observation records stored on this device.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearAll}
                className="flex-1 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold text-xs uppercase shadow transition-colors cursor-pointer"
              >
                Yes, Erase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION MODAL: SEED DATA */}
      {showSeedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Sparkles className="w-6 h-6" />
              <h3 className="font-black text-lg text-white">Load Sample Data?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will populate your database with sample competition data for Team 9751, 254, and 1678 with sample autonomous paths, shooting zones, and match observations.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSeedModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetSampleData}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase shadow transition-colors"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFLICT RESOLUTION MODAL */}
      {showConflictModal && pendingImportData && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-black text-lg text-white">Conflict Detected</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The imported file contains <strong>{conflictTeamsCount} existing team(s)</strong> already in this database.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeImportMode('update')}
                className="w-full text-left p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 transition-colors"
              >
                <div className="font-bold text-xs">1. Update existing data</div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Overwrite existing records with imported data.
                </div>
              </button>

              <button
                type="button"
                onClick={() => executeImportMode('keep')}
                className="w-full text-left p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 transition-colors"
              >
                <div className="font-bold text-xs">2. Keep existing data</div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Keep local records, only import new teams.
                </div>
              </button>

              <button
                type="button"
                onClick={() => executeImportMode('replace')}
                className="w-full text-left p-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-200 transition-colors"
              >
                <div className="font-bold text-xs">3. Replace existing data</div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Completely replace database with imported file.
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowConflictModal(false);
                setPendingImportData(null);
              }}
              className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
