import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  CheckCircle2, 
  Camera, 
  QrCode, 
  X,
  ChevronDown,
  ChevronUp,
  Target,
  Gamepad2,
  Plus,
  HelpCircle
} from 'lucide-react';
import { scoutingAssignments, MatchTarget } from '../../db/scoutingAssignments';
import { scoutingDB } from '../../db/indexedDB';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { QrScannerModal } from '../common/QrScannerModal';
import { EventScheduleMatch, MatchScoutingRecord } from '../../types/scouting';

interface ScoutDashboardProps {
  onNavigate: (view: string, teamNumber?: number, extraParam?: any, allianceParam?: 'red' | 'blue') => void;
}

export const ScoutDashboard: React.FC<ScoutDashboardProps> = ({ onNavigate }) => {
  const [scoutProfile, setScoutProfile] = useState(scoutingAssignments.getProfile());
  const [myTargetTeams, setMyTargetTeams] = useState<number[]>([]);
  const [myMatchTargets, setMyMatchTargets] = useState<MatchTarget[]>([]);
  const [teamStatuses, setTeamStatuses] = useState<Record<number, { isPitScouted: boolean; matchCount: number; isMatchScouted: boolean }>>({});
  const [teamSchedulesMap, setTeamSchedulesMap] = useState<Record<number, EventScheduleMatch[]>>({});
  const [teamScoutedMatchesMap, setTeamScoutedMatchesMap] = useState<Record<number, number[]>>({});
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  const [isScanAssignmentOpen, setIsScanAssignmentOpen] = useState<boolean>(false);
  const [scanAssignmentMsg, setScanAssignmentMsg] = useState<string | null>(null);

  // Individual task QR sync states
  const [activeTaskQrUrl, setActiveTaskQrUrl] = useState<string | null>(null);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);

  useEffect(() => {
    loadScoutData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadScoutData();
      }
    };

    window.addEventListener('focus', loadScoutData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Efficient interval that only runs when document is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadScoutData();
      }
    }, 10000);

    return () => {
      window.removeEventListener('focus', loadScoutData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const loadScoutData = async () => {
    const prof = scoutingAssignments.getProfile();
    setScoutProfile(prof);

    const teams = scoutingAssignments.getMyTargetTeams();
    setMyTargetTeams(teams);

    const matchTargets = scoutingAssignments.getMyMatchTargets();
    setMyMatchTargets(matchTargets);

    const allTeamNums = Array.from(new Set([...teams, ...matchTargets.map((m) => m.teamNumber)]));

    // Batch query IndexedDB in parallel once to eliminate repeated per-team DB lookups
    const [allDbTeams, allDbMatches, fullSchedule] = await Promise.all([
      scoutingDB.getAllTeams(),
      scoutingDB.getAllMatches(),
      scoutingDB.getSchedule(),
    ]);

    const statuses: Record<number, { isPitScouted: boolean; matchCount: number; isMatchScouted: boolean }> = {};
    const schedMap: Record<number, EventScheduleMatch[]> = {};
    const scoutedMatchesMap: Record<number, number[]> = {};

    for (const t of allTeamNums) {
      const teamProfile = allDbTeams.find((tm) => tm.teamNumber === t);
      const matches = allDbMatches.filter((m) => m.teamNumber === t);
      const isPitScouted = Boolean(
        teamProfile && (
          teamProfile.pit?.drivetrain || 
          teamProfile.pit?.shooter?.length || 
          teamProfile.pit?.notes || 
          teamProfile.pit?.photos?.length ||
          teamProfile.pit?.lastUpdated
        )
      );

      statuses[t] = {
        isPitScouted,
        matchCount: matches.length,
        isMatchScouted: matches.length > 0,
      };

      const teamMatches = fullSchedule.filter((m) => m.redTeams.includes(t) || m.blueTeams.includes(t));
      const map = new Map<number, EventScheduleMatch>();
      for (const m of teamMatches) {
        if (!map.has(m.matchNumber) || m.compLevel === 'qm') {
          map.set(m.matchNumber, m);
        }
      }
      schedMap[t] = Array.from(map.values()).sort((a, b) => a.matchNumber - b.matchNumber);
      scoutedMatchesMap[t] = matches.map((m) => m.matchNumber);
    }

    setTeamStatuses(statuses);
    setTeamSchedulesMap(schedMap);
    setTeamScoutedMatchesMap(scoutedMatchesMap);
  };

  const toggleExpandTeam = (teamNum: number) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamNum)) {
        next.delete(teamNum);
      } else {
        next.add(teamNum);
      }
      return next;
    });
  };

  const handleScanAssignmentResult = (decodedText: string) => {
    setIsScanAssignmentOpen(false);
    const res = qrTransferEngine.parseAssignmentPayload(decodedText);
    setScanAssignmentMsg(res.message);
    loadScoutData();
    setTimeout(() => setScanAssignmentMsg(null), 4000);
  };

  const handleGenerateTaskQr = async (task: { type: 'PIT' | 'MATCH'; teamNumber: number; matchNumber?: number; data?: any }) => {
    const scoutName = scoutProfile.name || 'Scout';
    let payloadStr = '';
    let recordData = task.data;

    if (task.type === 'PIT') {
      if (!recordData) {
        const teamProfile = await scoutingDB.getTeam(task.teamNumber);
        recordData = teamProfile?.pit;
      }
      if (recordData) {
        payloadStr = qrTransferEngine.generateSinglePitQr(scoutName, task.teamNumber, recordData);
      }
    } else {
      if (!recordData) {
        const matches = await scoutingDB.getMatchesForTeam(task.teamNumber);
        if (task.matchNumber) {
          recordData = matches.find((m) => m.matchNumber === task.matchNumber);
        } else {
          recordData = matches[0];
        }
      }
      if (recordData) {
        payloadStr = qrTransferEngine.generateSingleMatchQr(scoutName, recordData);
      }
    }

    if (payloadStr) {
      try {
        const url = await QRCode.toDataURL(payloadStr, { errorCorrectionLevel: 'L', margin: 1, width: 280 });
        setActiveTaskQrUrl(url);
        setActiveTaskTitle(`Team ${task.teamNumber} (${task.type === 'PIT' ? 'Pit' : `Match ${recordData?.matchNumber || task.matchNumber || 1}`})`);
      } catch (e) {
        console.error(e);
      }
    }
  };


  const isPitMode = scoutProfile.position === 'PIT_SCOUT' || (!scoutProfile.position.includes('MATCH') && !scoutProfile.name.toLowerCase().includes('match'));

  return (
    <div className="max-w-md mx-auto px-2 sm:px-3 py-2 pb-24 flex flex-col gap-3 font-mono">
      {/* Top Action: Scan Assignment */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setIsScanAssignmentOpen(true)}
          className="w-full py-4 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 border-2 border-amber-500 font-black text-sm uppercase cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg ring-2 ring-amber-500/30"
        >
          <Camera className="w-5 h-5 text-amber-400" />
          <span>Scan Assignment QR</span>
        </button>
      </div>

      {scanAssignmentMsg && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{scanAssignmentMsg}</span>
        </div>
      )}

      {/* 1. MATCH ASSIGNMENT TABLE/BLOCK */}
      {myMatchTargets.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
                match assignment
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              {myMatchTargets.length} {myMatchTargets.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-3 pl-4">team#</th>
                  <th className="p-3">match #</th>
                  <th className="p-3 pr-4 text-right">scout match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {myMatchTargets.map((task) => {
                  const scoutedMatches = teamScoutedMatchesMap[task.teamNumber] || [];
                  const isMatchDone = scoutedMatches.includes(task.matchNumber);

                  // Determine alliance
                  let taskAlliance = task.alliance;
                  if (!taskAlliance) {
                    const sched = teamSchedulesMap[task.teamNumber] || [];
                    const m = sched.find((s) => s.matchNumber === task.matchNumber);
                    if (m) {
                      if (m.redTeams.includes(task.teamNumber)) taskAlliance = 'red';
                      else if (m.blueTeams.includes(task.teamNumber)) taskAlliance = 'blue';
                    }
                  }

                  return (
                    <tr
                      key={`task-m${task.matchNumber}-t${task.teamNumber}`}
                      className="hover:bg-slate-850/50 transition-colors"
                    >
                      <td className="p-3 pl-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{task.teamNumber}</span>
                          {taskAlliance === 'red' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase">
                              R
                            </span>
                          )}
                          {taskAlliance === 'blue' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-bold uppercase">
                              B
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-200">
                        {task.matchNumber}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isMatchDone && (
                            <button
                              type="button"
                              onClick={() => handleGenerateTaskQr({ type: 'MATCH', teamNumber: task.teamNumber, matchNumber: task.matchNumber })}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                              title="Show QR"
                            >
                              <QrCode className="w-3 h-3 text-slate-300" />
                              <span>QR</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigate('match-scout', task.teamNumber, task.matchNumber, taskAlliance)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              isMatchDone
                                ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-sm'
                            }`}
                          >
                            {isMatchDone ? 'Edit Match' : 'scout match'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. PIT ASSIGNMENT TABLE/BLOCK */}
      {myTargetTeams.length > 0 && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
                pit assignment
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {myTargetTeams.length} {myTargetTeams.length === 1 ? 'team' : 'teams'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-3 pl-4">team#</th>
                  <th className="p-3 pr-4 text-right">scout pit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {myTargetTeams.map((teamNum) => {
                  const status = teamStatuses[teamNum];
                  const isDone = status?.isPitScouted;

                  return (
                    <tr
                      key={`pit-${teamNum}`}
                      className="hover:bg-slate-850/50 transition-colors"
                    >
                      <td className="p-3 pl-4 font-bold text-white whitespace-nowrap">
                        {teamNum}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDone && (
                            <button
                              type="button"
                              onClick={() => handleGenerateTaskQr({ type: 'PIT', teamNumber: teamNum })}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                              title="Show QR"
                            >
                              <QrCode className="w-3 h-3 text-slate-300" />
                              <span>QR</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigate('pit-scout', teamNum)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              isDone
                                ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                                : 'bg-blue-600 hover:bg-blue-500 text-white font-black shadow-sm'
                            }`}
                          >
                            {isDone ? 'Edit Pit' : 'scout pit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. NO ASSIGNMENTS PLACEHOLDER */}
      {myMatchTargets.length === 0 && myTargetTeams.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs space-y-2">
          <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="font-bold text-white uppercase text-xs">No active assignments found</p>
          <p className="text-[11px] text-slate-500 leading-normal">
            Scan a Pit or Match assignment QR code from your team captain to get started.
          </p>
        </div>
      )}

      {/* SCAN ASSIGNMENT QR MODAL */}
      <QrScannerModal
        isOpen={isScanAssignmentOpen}
        title="Scan Assignment QR"
        onScanResult={handleScanAssignmentResult}
        onClose={() => setIsScanAssignmentOpen(false)}
      />

      {/* TASK QR OVERLAY MODAL */}
      {activeTaskQrUrl && activeTaskTitle && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase">
                {activeTaskTitle}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTaskQrUrl(null);
                  setActiveTaskTitle(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-lg">
              <img src={activeTaskQrUrl} alt="Task QR" className="w-52 h-52 mx-auto" />
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTaskQrUrl(null);
                setActiveTaskTitle(null);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer border border-slate-750"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
