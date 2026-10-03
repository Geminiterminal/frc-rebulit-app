import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Trophy, 
  ClipboardList, 
  Gamepad2, 
  Map, 
  ChevronRight, 
  Users, 
  TrendingUp, 
  FolderDown, 
  Sliders, 
  Plus, 
  Trash2, 
  QrCode, 
  Camera, 
  Database, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { scoutingDB } from '../../db/indexedDB';
import { scoutingAssignments, ScoutAssignment } from '../../db/scoutingAssignments';
import { tbaApi } from '../../utils/tbaApi';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { QrScannerModal } from '../common/QrScannerModal';
import { TeamProfile } from '../../types/scouting';

interface CaptainDashboardProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const CaptainDashboard: React.FC<CaptainDashboardProps> = ({ onNavigate }) => {
  const [allTeams, setAllTeams] = useState<TeamProfile[]>([]);
  const [scoutedTeams, setScoutedTeams] = useState<TeamProfile[]>([]);
  const [assignments, setAssignments] = useState<ScoutAssignment[]>([]);

  // TBA Setup
  const [eventCode, setEventCode] = useState<string>(() => localStorage.getItem('frc_active_event_code') || '');
  const [tbaAuthKey, setTbaAuthKey] = useState<string>(() => localStorage.getItem('frc_tba_auth_key') || '');
  const [isFetchingTba, setIsFetchingTba] = useState<boolean>(false);
  const [tbaStatusMsg, setTbaStatusMsg] = useState<string | null>(null);

  // New Assignment Modal
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [newScoutName, setNewScoutName] = useState('');
  const [newScoutRole, setNewScoutRole] = useState<'PIT_SCOUT' | 'MATCH_SCOUT'>('PIT_SCOUT');
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>([]);
  const [manualTeamInput, setManualTeamInput] = useState('');

  // Assignment QR Modal
  const [activeAssignmentQr, setActiveAssignmentQr] = useState<{ scoutName: string; qrUrl: string } | null>(null);

  // Scanner Modal
  const [isScanDataOpen, setIsScanDataOpen] = useState(false);
  const [scanResultMsg, setScanResultMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const teams = await scoutingDB.getAllTeams();
    setAllTeams(teams);

    const matches = await scoutingDB.getAllMatches();
    const teamNumsWithMatches = new Set(matches.map((m) => m.teamNumber));

    const filtered = teams.filter((t) => {
      const hasPit = t.pit && (
        t.pit.lastUpdated || 
        t.pit.drivetrain || 
        t.pit.reliability || 
        t.pit.scoutName || 
        (t.pit.photos && t.pit.photos.length > 0)
      );
      const hasMatch = teamNumsWithMatches.has(t.teamNumber);
      return hasPit || hasMatch;
    });
    setScoutedTeams(filtered);

    const list = scoutingAssignments.getAllAssignments();
    setAssignments(list);
  };

  const handleFetchTba = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFetchingTba(true);
    setTbaStatusMsg(null);
    const res = await tbaApi.fetchEventTeams(eventCode, "");
    setTbaStatusMsg(res.message);
    setIsFetchingTba(false);
    if (res.success) {
      loadData();
    }
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setTbaStatusMsg(null);
    }, 3000);
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScoutName.trim()) return;

    let finalTeams = [...selectedTeamNums];
    if (manualTeamInput.trim()) {
      const parsedNums = manualTeamInput
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
      finalTeams = Array.from(new Set([...finalTeams, ...parsedNums]));
    }

    scoutingAssignments.assignTeamsToScout(newScoutName.trim(), finalTeams, newScoutRole);
    setNewScoutName('');
    setSelectedTeamNums([]);
    setManualTeamInput('');
    setIsAddAssignmentOpen(false);
    loadData();
  };

  const handleDeleteAssignment = (scoutName: string) => {
    scoutingAssignments.deleteAssignment(scoutName);
    loadData();
  };

  const handleShowAssignmentQr = async (assignment: ScoutAssignment) => {
    const isPit = assignment.role === 'PIT_SCOUT' || assignment.scoutName.toLowerCase().includes('pit');
    const roleType = isPit ? 'PIT_SCOUT' : 'MATCH_SCOUT';
    const payloadStr = qrTransferEngine.generateAssignmentPayload(
      assignment.scoutName,
      roleType,
      assignment.assignedTeams
    );

    try {
      const url = await QRCode.toDataURL(payloadStr, { margin: 1, width: 280 });
      setActiveAssignmentQr({ scoutName: assignment.scoutName, qrUrl: url });
    } catch {
      setActiveAssignmentQr(null);
    }
  };

  const handleScoutDataScanResult = async (decodedText: string) => {
    setIsScanDataOpen(false);
    const res = await qrTransferEngine.importScoutDataQrPayload(decodedText);
    setScanResultMsg(res.message);
    loadData();
    setTimeout(() => setScanResultMsg(null), 5000);
  };

  const handleToggleTeamSelect = (num: number) => {
    if (selectedTeamNums.includes(num)) {
      setSelectedTeamNums(selectedTeamNums.filter((t) => t !== num));
    } else {
      setSelectedTeamNums([...selectedTeamNums, num]);
    }
  };

  return (
    <div className="max-w-md mx-auto px-2 sm:px-3 py-2 pb-24 flex flex-col gap-3 font-mono">
      {/* 1. PRIMARY ACTION BAR: SCAN SCOUT DATA */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsScanDataOpen(true)}
          className="flex-1 py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-100 font-bold border border-slate-700 text-xs uppercase tracking-wider cursor-pointer shadow transition-all active:scale-98 flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4 text-slate-300" />
          <span>Scan Scout Data QR</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddAssignmentOpen(true)}
          className="py-3 px-3 rounded-xl bg-slate-800/40 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1 shrink-0"
        >
          <Plus className="w-4 h-4 text-slate-300" />
          <span>Assign</span>
        </button>
      </div>

      {scanResultMsg && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-600/60 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{scanResultMsg}</span>
        </div>
      )}

      {/* 2. MAIN NAVIGATION CARDS */}
      <div className="flex flex-col gap-2.5">
        {/* RANKING */}
        <button
          type="button"
          onClick={() => onNavigate('picklist')}
          className="p-4 rounded-2xl bg-[#0F172A]/85 border border-slate-800 hover:border-slate-700 hover:shadow-[0_0_20px_rgba(148,163,184,0.1)] text-left cursor-pointer flex items-center justify-between shadow-sm transition-all group duration-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/80 text-slate-200 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-slate-200" />
            </div>
            <span className="text-base font-black text-slate-100 tracking-wider">
              RANKING
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* STRATEGY & WHITEBOARD */}
        <button
          type="button"
          onClick={() => onNavigate('strategy-field')}
          className="p-4 rounded-2xl bg-[#0F172A]/85 border border-slate-800 hover:border-slate-700 hover:shadow-[0_0_20px_rgba(148,163,184,0.1)] text-left cursor-pointer flex items-center justify-between shadow-sm transition-all group duration-200"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/80 text-slate-200 flex items-center justify-center shrink-0">
              <Map className="w-5 h-5 text-slate-200" />
            </div>
            <span className="text-base font-black text-slate-100 tracking-wider">
              STRATEGY & WHITEBOARD
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 5. TBA EVENT SETUP CARD */}
      <div className="p-4 rounded-2xl bg-[#0F172A]/85 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-4 h-4 text-slate-300" />
            <span>TBA Event Setup</span>
          </span>
          <span className="text-[10px] text-slate-400">{allTeams.length} Loaded</span>
        </div>

        <form onSubmit={handleFetchTba} className="space-y-2">
          <input
            type="text"
            placeholder="Event Code (e.g. 2026mifli1)"
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            className="w-full bg-[#0B132B] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono"
            required
          />

          <button
            type="submit"
            disabled={isFetchingTba}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700/60 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isFetchingTba ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>{isFetchingTba ? 'Fetching...' : 'Fetch Teams from TBA'}</span>
          </button>
        </form>

        {tbaStatusMsg && (
          <div className="p-2 rounded-xl bg-[#0B132B] text-xs text-slate-300">
            {tbaStatusMsg}
          </div>
        )}
      </div>

      {/* 4. DYNAMIC SCOUT ASSIGNMENTS CARD */}
      <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-300" />
            <span>Scout Assignments ({assignments.length})</span>
          </span>
          <button
            type="button"
            onClick={() => setIsAddAssignmentOpen(true)}
            className="text-xs text-slate-300 hover:text-slate-100 hover:underline font-bold cursor-pointer"
          >
            + Create New
          </button>
        </div>

        {assignments.length > 0 ? (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.scoutName}
                className="p-3 rounded-xl bg-[#0B132B] border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-100">{a.scoutName}</span>
                    {a.role ? (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                        a.role === 'PIT_SCOUT' 
                          ? 'bg-slate-800 text-slate-300 border border-slate-750' 
                          : 'bg-slate-800/60 text-slate-400 border border-slate-750/50'
                      }`}>
                        {a.role === 'PIT_SCOUT' ? 'Pit' : 'Match'}
                      </span>
                    ) : (
                      // Guess/fallback badge if role isn't explicitly set
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                        a.scoutName.toLowerCase().includes('pit')
                          ? 'bg-slate-800 text-slate-300 border border-slate-750'
                          : 'bg-slate-800/60 text-slate-400 border border-slate-750/50'
                      }`}>
                        {a.scoutName.toLowerCase().includes('pit') ? 'Pit' : 'Match'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">
                    Teams: {a.assignedTeams.length > 0 ? a.assignedTeams.join(', ') : 'All'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleShowAssignmentQr(a)}
                    className="py-1 px-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <QrCode className="w-3 h-3 text-slate-300" />
                    <span>QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteAssignment(a.scoutName)}
                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No scout assignments created yet. Tap + Create New above.</p>
        )}
      </div>

      {/* 3. RECENTLY SCOUTED TEAMS SECTION (EXACT MATCHING ATTACHED IMAGE) */}
      <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            RECENTLY SCOUTED TEAMS ({scoutedTeams.length})
          </span>
          <button
            type="button"
            onClick={() => onNavigate('teams')}
            className="text-slate-300 hover:text-slate-100 font-bold text-xs cursor-pointer"
          >
            View All →
          </button>
        </div>

        {scoutedTeams.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {scoutedTeams.slice(0, 10).map((t) => (
              <button
                key={t.teamNumber}
                type="button"
                onClick={() => onNavigate('team-profile', t.teamNumber)}
                className="px-3 py-1.5 rounded-xl bg-[#0B132B] border border-slate-800 text-slate-200 font-bold text-xs hover:border-slate-500 hover:text-slate-100 transition-colors cursor-pointer"
              >
                {t.teamNumber}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No teams scouted yet. Fill match or pit data to see recently scouted teams.</p>
        )}
      </div>

      {/* 6. BOTTOM TOOLBAR (EXACT MATCHING ATTACHED IMAGE) */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <button
          type="button"
          onClick={() => onNavigate('teams')}
          className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <Users className="w-4 h-4 text-slate-300" />
          <span>Teams</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('event-data')}
          className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <TrendingUp className="w-4 h-4 text-slate-300" />
          <span>Matches</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('import-export')}
          className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <FolderDown className="w-4 h-4 text-slate-300" />
          <span className="text-[10px] truncate max-w-full">Export/Sync</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <Sliders className="w-4 h-4 text-slate-300" />
          <span>Settings</span>
        </button>
      </div>

      {/* CREATE SCOUT ASSIGNMENT MODAL */}
      {isAddAssignmentOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 backdrop-blur-md">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 max-w-sm w-full space-y-3.5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-200 uppercase">
                Create Scout Assignment
              </span>
              <button
                type="button"
                onClick={() => setIsAddAssignmentOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Scout Name / Role Title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah, Pit Scout A, Match Scout 3"
                  value={newScoutName}
                  onChange={(e) => setNewScoutName(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Scouting Role:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewScoutRole('PIT_SCOUT')}
                    className={`py-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                      newScoutRole === 'PIT_SCOUT'
                        ? 'bg-slate-800 border-slate-600 text-slate-100'
                        : 'bg-[#0B132B] border-slate-800 text-slate-400'
                    }`}
                  >
                    Pit Scout
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewScoutRole('MATCH_SCOUT')}
                    className={`py-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                      newScoutRole === 'MATCH_SCOUT'
                        ? 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                        : 'bg-[#0B132B] border-slate-800 text-slate-400'
                    }`}
                  >
                    Match Scout
                  </button>
                </div>
              </div>

              {allTeams.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Select Assigned Teams ({selectedTeamNums.length} selected):
                  </label>
                  <div className="max-h-32 overflow-y-auto bg-[#0B132B] border border-slate-800 rounded-xl p-2 flex flex-wrap gap-1.5">
                    {allTeams.map((t) => {
                      const isSel = selectedTeamNums.includes(t.teamNumber);
                      return (
                        <button
                          key={t.teamNumber}
                          type="button"
                          onClick={() => handleToggleTeamSelect(t.teamNumber)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                            isSel
                              ? 'bg-slate-800 border-slate-600 text-slate-100'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          #{t.teamNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Manual Team Numbers (comma separated):
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27, 66, 1684"
                  value={manualTeamInput}
                  onChange={(e) => setManualTeamInput(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold border border-slate-600 text-xs uppercase cursor-pointer transition-transform active:scale-98 shadow"
              >
                Save & Create QR
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGNMENT QR DISPLAY MODAL */}
      {activeAssignmentQr && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-200 uppercase">
                Assignment QR: {activeAssignmentQr.scoutName}
              </span>
              <button
                type="button"
                onClick={() => setActiveAssignmentQr(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              Have <strong>{activeAssignmentQr.scoutName}</strong> scan this QR code on their device:
            </p>

            <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-lg">
              <img src={activeAssignmentQr.qrUrl} alt="Assignment QR" className="w-52 h-52 mx-auto" />
            </div>

            <button
              type="button"
              onClick={() => setActiveAssignmentQr(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* CAMERA SCANNER MODAL */}
      <QrScannerModal
        isOpen={isScanDataOpen}
        title="Scan Scout Data QR"
        onScanResult={handleScoutDataScanResult}
        onClose={() => setIsScanDataOpen(false)}
      />
    </div>
  );
};
