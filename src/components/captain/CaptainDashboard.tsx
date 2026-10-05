import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Trophy, 
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
import { scoutingAssignments, ScoutAssignment, MatchTarget } from '../../db/scoutingAssignments';
import { tbaApi } from '../../utils/tbaApi';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { QrScannerModal } from '../common/QrScannerModal';
import { TeamProfile, EventScheduleMatch } from '../../types/scouting';

interface CaptainDashboardProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const CaptainDashboard: React.FC<CaptainDashboardProps> = ({ onNavigate }) => {
  const [allTeams, setAllTeams] = useState<TeamProfile[]>([]);
  const [scoutedTeams, setScoutedTeams] = useState<TeamProfile[]>([]);
  const [assignments, setAssignments] = useState<ScoutAssignment[]>([]);
  const [teamSchedulesMap, setTeamSchedulesMap] = useState<Record<number, EventScheduleMatch[]>>({});

  // TBA Setup
  const [eventCode, setEventCode] = useState<string>(() => {
    const saved = localStorage.getItem('frc_active_event_code') || '';
    if (saved === '2025micmp') {
      localStorage.removeItem('frc_active_event_code');
      return '';
    }
    return saved;
  });
  const [isFetchingTba, setIsFetchingTba] = useState<boolean>(false);
  const [tbaStatusMsg, setTbaStatusMsg] = useState<string | null>(null);

  // New Assignment Modal
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [newScoutName, setNewScoutName] = useState('');
  const [newScoutRole, setNewScoutRole] = useState<'PIT_SCOUT' | 'MATCH_SCOUT'>('MATCH_SCOUT');
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>([]);
  const [selectedMatchTargets, setSelectedMatchTargets] = useState<MatchTarget[]>([]);
  const [expandedAssignmentTeams, setExpandedAssignmentTeams] = useState<Set<number>>(new Set());
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
        (t.pit.photos && t.pit.photos.length > 0)
      );
      const hasMatch = teamNumsWithMatches.has(t.teamNumber);
      return hasPit || hasMatch;
    });
    setScoutedTeams(filtered);

    const schedMap: Record<number, EventScheduleMatch[]> = {};
    for (const t of teams) {
      schedMap[t.teamNumber] = await scoutingDB.getScheduleForTeam(t.teamNumber);
    }
    setTeamSchedulesMap(schedMap);

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
    setTimeout(() => {
      setTbaStatusMsg(null);
    }, 3000);
  };

  const handleToggleMatchTarget = (teamNumber: number, matchNumber: number, forcedAlliance?: 'red' | 'blue') => {
    setSelectedMatchTargets((prev) => {
      const exists = prev.some((mt) => mt.teamNumber === teamNumber && mt.matchNumber === matchNumber);
      if (exists) {
        return prev.filter((mt) => !(mt.teamNumber === teamNumber && mt.matchNumber === matchNumber));
      } else {
        let alliance = forcedAlliance;
        if (!alliance) {
          const sched = teamSchedulesMap[teamNumber] || [];
          const m = sched.find((s) => s.matchNumber === matchNumber);
          if (m) {
            if (m.redTeams.includes(teamNumber)) alliance = 'red';
            else if (m.blueTeams.includes(teamNumber)) alliance = 'blue';
          }
        }
        return [...prev, { teamNumber, matchNumber, alliance }];
      }
    });
  };

  const handleToggleAssignmentTeamExpand = (teamNumber: number) => {
    setExpandedAssignmentTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamNumber)) {
        next.delete(teamNumber);
      } else {
        next.add(teamNumber);
      }
      return next;
    });
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScoutName.trim()) return;

    let finalTeams: number[] = [];
    let finalTargets: MatchTarget[] = [];

    if (newScoutRole === 'PIT_SCOUT') {
      finalTeams = [...selectedTeamNums];
      if (manualTeamInput.trim()) {
        const parsedNums = manualTeamInput
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n) && n > 0);
        finalTeams = Array.from(new Set([...finalTeams, ...parsedNums]));
      }
    } else {
      // Match Scout: only match targets, no pit teams
      finalTargets = [...selectedMatchTargets];
      finalTeams = [];
    }

    scoutingAssignments.assignTeamsToScout(
      newScoutName.trim(), 
      finalTeams, 
      newScoutRole,
      undefined,
      finalTargets.length > 0 ? finalTargets : undefined
    );

    setNewScoutName('');
    setSelectedTeamNums([]);
    setSelectedMatchTargets([]);
    setExpandedAssignmentTeams(new Set());
    setManualTeamInput('');
    setIsAddAssignmentOpen(false);
    loadData();
  };

  const handleDeleteAssignment = (scoutName: string, role?: 'PIT_SCOUT' | 'MATCH_SCOUT', id?: string) => {
    scoutingAssignments.deleteAssignment(scoutName, role, id);
    loadData();
  };

  const handleShowAssignmentQr = async (assignment: ScoutAssignment) => {
    const isPit = assignment.role === 'PIT_SCOUT' || assignment.scoutName.toLowerCase().includes('pit');
    const roleType = isPit ? 'PIT_SCOUT' : 'MATCH_SCOUT';
    const payloadStr = qrTransferEngine.generateAssignmentPayload(
      assignment.scoutName,
      roleType,
      isPit ? (assignment.assignedTeams || []) : [],
      isPit ? undefined : assignment.matchNumber,
      isPit ? undefined : (assignment.matchTargets || assignment.matchTasks)
    );

    try {
      const url = await QRCode.toDataURL(payloadStr, { errorCorrectionLevel: 'L', margin: 1, width: 280 });
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
      {/* 1. PRIMARY TOP ACTIONS */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsScanDataOpen(true)}
          className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold border border-slate-800 text-xs uppercase tracking-wider cursor-pointer shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4 text-slate-300" />
          <span>SCAN DATA QR</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddAssignmentOpen(true)}
          className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold border border-slate-800 text-xs uppercase tracking-wider cursor-pointer shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4 text-slate-300" />
          <span>ASSIGN</span>
        </button>
      </div>

      {scanResultMsg && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{scanResultMsg}</span>
        </div>
      )}

      {/* 2. MAIN CARDS: RANKING & STRATEGY */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => onNavigate('picklist')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left cursor-pointer flex items-center justify-between shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-850 border border-slate-800 text-slate-200 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-slate-200" />
            </div>
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              RANKING
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('strategy-field')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left cursor-pointer flex items-center justify-between shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-850 border border-slate-800 text-slate-200 flex items-center justify-center shrink-0">
              <Map className="w-5 h-5 text-slate-200" />
            </div>
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              STRATEGY
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 3. EVENT SETUP CARD */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-300" />
            <span>EVENT SETUP</span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">{allTeams.length} Loaded</span>
        </div>

        <form onSubmit={handleFetchTba} className="space-y-2 pt-1">
          <input
            type="text"
            placeholder="Event code"
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
            required
          />

          <button
            type="submit"
            disabled={isFetchingTba}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-white font-bold text-xs border border-slate-800 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {isFetchingTba ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>{isFetchingTba ? 'Fetching...' : 'Fetch Teams'}</span>
          </button>
        </form>

        {tbaStatusMsg && (
          <div className="p-2 rounded-xl bg-slate-950 text-xs text-slate-300 border border-slate-800">
            {tbaStatusMsg}
          </div>
        )}
      </div>

      {/* 4. ASSIGNMENTS CARD */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-300" />
            <span>ASSIGNMENTS ({assignments.length})</span>
          </span>
          <button
            type="button"
            onClick={() => setIsAddAssignmentOpen(true)}
            className="text-xs text-slate-300 hover:text-white font-bold cursor-pointer"
          >
            + New
          </button>
        </div>

        {assignments.length > 0 ? (
          <div className="space-y-2 pt-1">
            {assignments.map((a) => {
              const targetsList = (a.matchTargets && a.matchTargets.length > 0)
                ? a.matchTargets
                : (a.matchTasks && a.matchTasks.length > 0 ? a.matchTasks : []);

              const allAssignedTeamNums = Array.from(
                new Set([
                  ...(a.assignedTeams || []),
                  ...targetsList.map((mt) => mt.teamNumber),
                ])
              )
                .filter((t) => Number.isInteger(t) && t > 0)
                .sort((x, y) => Number(x) - Number(y));

              const teamMatchRows = allAssignedTeamNums.map((teamNum) => {
                const targets = targetsList.filter((mt) => mt.teamNumber === teamNum);
                const uniqueMatches = Array.from(
                  new Set(targets.map((mt) => mt.matchNumber))
                )
                  .filter((m) => Boolean(m) && m > 0)
                  .sort((x, y) => Number(x) - Number(y));
                return { teamNum, matches: uniqueMatches, targets };
              });

              return (
                <div
                  key={a.id || `${a.scoutName}-${a.role}-${a.updatedAt}`}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{a.scoutName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-850 text-slate-300 border border-slate-800">
                        {a.role === 'PIT_SCOUT' ? 'PIT' : 'MATCH'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleShowAssignmentQr(a)}
                        className="py-1 px-2 rounded-lg bg-slate-850 border border-slate-800 text-slate-200 hover:bg-slate-800 text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <QrCode className="w-3 h-3 text-slate-300" />
                        <span>QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(a.scoutName, a.role, a.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {a.role === 'MATCH_SCOUT' && teamMatchRows.length > 0 ? (
                    <div className="rounded-lg border border-slate-850 bg-[#0a0f1d] overflow-hidden">
                      <div className="grid grid-cols-[80px_1fr] bg-[#101728] px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <span>Team</span>
                        <span>Matches</span>
                      </div>
                      <div className="divide-y divide-slate-850/60 font-mono text-[11px]">
                        {teamMatchRows.map(({ teamNum, matches, targets }) => (
                          <div key={teamNum} className="grid grid-cols-[80px_1fr] px-2.5 py-1.5 items-center">
                            <span className="font-bold text-slate-200">#{teamNum}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {matches.map((mn, idx) => (
                                <span key={mn} className="inline-flex items-center gap-1">
                                  <span className="text-white font-bold">Qual {mn}</span>
                                  {idx < matches.length - 1 && <span className="text-slate-500">,</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span className="text-slate-400 font-bold">Teams: </span>
                      <span className="text-slate-200">
                        {a.assignedTeams && a.assignedTeams.length > 0
                          ? a.assignedTeams.join(', ')
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 pt-1">No scout assignments yet.</p>
        )}
      </div>

      {/* 5. RECENTLY SCOUTED TEAMS */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            RECENTLY SCOUTED TEAMS ({scoutedTeams.length})
          </span>
          <button
            type="button"
            onClick={() => onNavigate('teams')}
            className="text-slate-300 hover:text-white font-bold text-xs cursor-pointer"
          >
            View All →
          </button>
        </div>

        {scoutedTeams.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {scoutedTeams.slice(0, 10).map((t) => (
              <button
                key={t.teamNumber}
                type="button"
                onClick={() => onNavigate('team-profile', t.teamNumber)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-xs hover:border-slate-700 transition-colors cursor-pointer"
              >
                {t.teamNumber}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 pt-1">No scouted teams yet</p>
        )}
      </div>

      {/* 6. BOTTOM 4 SHORTCUTS */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <button
          type="button"
          onClick={() => onNavigate('teams')}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Users className="w-4 h-4 text-slate-400" />
          <span>Teams</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('event-data')}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <span>Matches</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('import-export')}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <FolderDown className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] truncate max-w-full">Export/Sy_</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Sliders className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>
      </div>

      {/* CREATE ASSIGNMENT MODAL */}
      {isAddAssignmentOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md font-mono">
          <div className="bg-[#0e1422] border border-[#1a2438] rounded-2xl p-5 sm:p-6 max-w-md sm:max-w-lg w-full space-y-4 shadow-2xl text-slate-100 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1a2438] pb-3 shrink-0">
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                CREATE SCOUT ASSIGNMENT
              </span>
              <button
                type="button"
                onClick={() => setIsAddAssignmentOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ASSIGNMENT TYPE
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewScoutRole('PIT_SCOUT')}
                    className={`py-2.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      newScoutRole === 'PIT_SCOUT'
                        ? 'bg-[#141d2f] text-white border-[#1a2438] shadow-sm font-black'
                        : 'bg-[#080d16] text-slate-400 border-[#1a2438]'
                    }`}
                  >
                    Pit Scout
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewScoutRole('MATCH_SCOUT')}
                    className={`py-2.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      newScoutRole === 'MATCH_SCOUT'
                        ? 'bg-[#141d2f] text-white border-[#1a2438] shadow-sm font-black'
                        : 'bg-[#080d16] text-slate-400 border-[#1a2438]'
                    }`}
                  >
                    Match Scout
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  SCOUT NAME
                </label>
                <input
                  type="text"
                  placeholder="Scout name"
                  value={newScoutName}
                  onChange={(e) => setNewScoutName(e.target.value)}
                  className="w-full bg-[#080d16] border border-[#1a2438] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  SELECT TEAMS FROM EVENT ({newScoutRole === 'MATCH_SCOUT' ? (selectedMatchTargets.length > 0 ? `${selectedMatchTargets.length} MATCHES` : `${selectedTeamNums.length} TEAMS`) : `${selectedTeamNums.length} TEAMS`} SELECTED)
                </label>

                <div className="max-h-60 overflow-y-auto p-2 bg-[#080d16] border border-[#1a2438] rounded-xl">
                  {allTeams.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        {allTeams.map((t) => {
                          const teamNum = t.teamNumber;
                          const isTeamSelected = selectedTeamNums.includes(teamNum);
                          const isTargeted = selectedMatchTargets.some((mt) => mt.teamNumber === teamNum);
                          const isSelected = isTeamSelected || isTargeted;

                          return (
                            <button
                              key={teamNum}
                              type="button"
                              onClick={() => {
                                handleToggleTeamSelect(teamNum);
                                if (newScoutRole === 'MATCH_SCOUT') {
                                  handleToggleAssignmentTeamExpand(teamNum);
                                }
                              }}
                              className={`py-2 px-1 rounded-xl border text-center font-mono font-bold text-xs cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#1a253d] border-slate-500 text-white font-black shadow-sm'
                                  : 'bg-[#141d2f] border-[#1a2438] text-slate-200 hover:text-white'
                              }`}
                            >
                              {teamNum}
                            </button>
                          );
                        })}
                      </div>

                      {newScoutRole === 'MATCH_SCOUT' && expandedAssignmentTeams.size > 0 && (
                        <div className="pt-2 border-t border-[#1a2438] space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            SELECT MATCH NUMBERS FOR EXPANDED TEAMS:
                          </span>
                          {Array.from(expandedAssignmentTeams).map((teamNum) => {
                            const sched = teamSchedulesMap[teamNum] || [];
                            return (
                              <div key={`exp-${teamNum}`} className="p-2.5 bg-[#0e1422] border border-[#1a2438] rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold text-white">
                                  <span>Team #{teamNum}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleAssignmentTeamExpand(teamNum)}
                                    className="text-slate-400 hover:text-white text-[9px] uppercase cursor-pointer"
                                  >
                                    Close
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {sched.length > 0 ? (
                                    sched.map((m) => {
                                      const isTargeted = selectedMatchTargets.some(
                                        (mt) => mt.teamNumber === teamNum && mt.matchNumber === m.matchNumber
                                      );
                                      return (
                                        <button
                                          key={m.key}
                                          type="button"
                                          onClick={() => handleToggleMatchTarget(teamNum, m.matchNumber)}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                                            isTargeted
                                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                                              : 'bg-[#080d16] text-slate-300 border-[#1a2438] hover:border-slate-600'
                                          }`}
                                        >
                                          Qual {m.matchNumber}
                                        </button>
                                      );
                                    })
                                  ) : (
                                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((mn) => {
                                      const isTargeted = selectedMatchTargets.some(
                                        (mt) => mt.teamNumber === teamNum && mt.matchNumber === mn
                                      );
                                      return (
                                        <button
                                          key={mn}
                                          type="button"
                                          onClick={() => handleToggleMatchTarget(teamNum, mn)}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                                            isTargeted
                                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                                              : 'bg-[#080d16] text-slate-300 border-[#1a2438] hover:border-slate-600'
                                          }`}
                                        >
                                          Match {mn}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-500 font-mono">
                      No event teams loaded yet.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#141d2f] hover:bg-[#1a253d] border border-[#1a2438] text-white font-mono font-bold text-xs uppercase tracking-wider cursor-pointer shadow transition-all active:scale-98 mt-1"
              >
                SAVE ASSIGNMENT
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGNMENT QR DISPLAY MODAL */}
      {activeAssignmentQr && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xs w-full text-center space-y-3.5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase">
                {activeAssignmentQr.scoutName}'s QR
              </span>
              <button
                type="button"
                onClick={() => setActiveAssignmentQr(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-white rounded-xl inline-block shadow-inner mx-auto">
              <img src={activeAssignmentQr.qrUrl} alt="Assignment QR" className="w-48 h-48 mx-auto" />
            </div>

            <p className="text-[11px] text-slate-400">
              Have the scout scan this code on their device to load assignments.
            </p>
          </div>
        </div>
      )}

      {/* SCAN SCOUT DATA MODAL */}
      <QrScannerModal
        isOpen={isScanDataOpen}
        onClose={() => setIsScanDataOpen(false)}
        onScanResult={handleScoutDataScanResult}
        title="Scan Scout Data QR"
      />
    </div>
  );
};