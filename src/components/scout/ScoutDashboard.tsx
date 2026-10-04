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

  const [manualTeamInput, setManualTeamInput] = useState<string>('');
  const [manualMatchInput, setManualMatchInput] = useState<string>('');

  // Scanner Modal state
  const [isScanAssignmentOpen, setIsScanAssignmentOpen] = useState<boolean>(false);
  const [scanAssignmentMsg, setScanAssignmentMsg] = useState<string | null>(null);

  // Individual task QR sync states
  const [activeTaskQrUrl, setActiveTaskQrUrl] = useState<string | null>(null);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);

  useEffect(() => {
    loadScoutData();
    const interval = setInterval(loadScoutData, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadScoutData = async () => {
    const prof = scoutingAssignments.getProfile();
    setScoutProfile(prof);

    const teams = scoutingAssignments.getMyTargetTeams();
    setMyTargetTeams(teams);

    const matchTargets = scoutingAssignments.getMyMatchTargets();
    setMyMatchTargets(matchTargets);

    const allTeamNums = Array.from(new Set([...teams, ...matchTargets.map((m) => m.teamNumber)]));

    const statuses: Record<number, { isPitScouted: boolean; matchCount: number; isMatchScouted: boolean }> = {};
    const schedMap: Record<number, EventScheduleMatch[]> = {};
    const scoutedMatchesMap: Record<number, number[]> = {};

    for (const t of allTeamNums) {
      const st = await scoutingAssignments.getTeamStatus(t);
      statuses[t] = {
        isPitScouted: st.isPitScouted,
        matchCount: st.matchCount,
        isMatchScouted: st.matchCount > 0,
      };
      schedMap[t] = await scoutingDB.getScheduleForTeam(t);
      const matches: MatchScoutingRecord[] = await scoutingDB.getMatchesForTeam(t);
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

  const handleAddManualTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(manualTeamInput.trim(), 10);
    const matchNum = parseInt(manualMatchInput.trim(), 10);

    if (num > 0) {
      if (!isPitMode && matchNum > 0) {
        const updated = [...myMatchTargets, { matchNumber: matchNum, teamNumber: num }];
        scoutingAssignments.setMyMatchTargets(updated);
      } else if (isPitMode || isNaN(matchNum)) {
        scoutingAssignments.addTeamToTarget(num);
      }
      setExpandedTeams((prev) => new Set(prev).add(num));
      setManualTeamInput('');
      setManualMatchInput('');
      loadScoutData();
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
          className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-100 border border-slate-800 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-2 transition-colors shadow-sm animate-pulse"
        >
          <Camera className="w-4 h-4 text-slate-300" />
          <span>Scan Assignment QR</span>
        </button>
      </div>

      {scanAssignmentMsg && (
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{scanAssignmentMsg}</span>
        </div>
      )}

      {/* 1. MATCH SCOUTING ASSIGNMENTS BLOCK */}
      {myMatchTargets.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-900/40 space-y-2.5 shadow-md">
          <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Match Scouting Assignments ({myMatchTargets.length})
            </span>
          </div>

          <div className="space-y-1.5">
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
                <div
                  key={`task-m${task.matchNumber}-t${task.teamNumber}`}
                  onClick={() => onNavigate('match-scout', task.teamNumber, task.matchNumber, taskAlliance)}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                    isMatchDone
                      ? 'bg-slate-950 border-emerald-600/40 text-emerald-200 hover:border-emerald-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap font-mono font-bold text-xs sm:text-sm">
                    <span className="text-white">Team #{task.teamNumber},</span>
                    <span className="text-slate-200">Match #{task.matchNumber}</span>
                    {taskAlliance === 'red' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-600 shadow-sm">
                        Red
                      </span>
                    ) : taskAlliance === 'blue' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-950 text-sky-300 border border-sky-600 shadow-sm">
                        Blue
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {isMatchDone && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </span>
                    )}

                    {isMatchDone ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateTaskQr({ type: 'MATCH', teamNumber: task.teamNumber, matchNumber: task.matchNumber });
                        }}
                        className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors shrink-0 font-mono"
                      >
                        <QrCode className="w-3.5 h-3.5 text-slate-300" />
                        <span>QR</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('match-scout', task.teamNumber, task.matchNumber, taskAlliance);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors font-mono shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow font-black"
                      >
                        Scout Match
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. PIT SCOUTING TARGETS BLOCK */}
      {myTargetTeams.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-blue-900/40 space-y-2.5 shadow-md">
          <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Pit Scouting Targets ({myTargetTeams.length})
            </span>
          </div>

          <div className="space-y-1.5 font-mono">
            {myTargetTeams.map((teamNum) => {
              const status = teamStatuses[teamNum];
              const isDone = status?.isPitScouted;

              return (
                <div
                  key={`pit-${teamNum}`}
                  onClick={() => onNavigate('pit-scout', teamNum)}
                  className={`rounded-xl border transition-all overflow-hidden cursor-pointer ${
                    isDone
                      ? 'bg-slate-950 border-emerald-600/40 hover:border-emerald-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <span className="text-slate-100">Team #{teamNum}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDone && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Done</span>
                        </span>
                      )}

                      {isDone ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateTaskQr({ type: 'PIT', teamNumber: teamNum });
                          }}
                          className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors shrink-0 font-mono"
                        >
                          <QrCode className="w-3.5 h-3.5 text-slate-300" />
                          <span>QR</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('pit-scout', teamNum);
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors bg-amber-500 hover:bg-amber-400 text-slate-950 shadow"
                        >
                          Scout Pit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. NO ASSIGNMENTS PLACEHOLDER */}
      {myMatchTargets.length === 0 && myTargetTeams.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs space-y-2">
          <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="font-bold text-white uppercase text-xs">No active assignments found</p>
          <p className="text-[11px] text-slate-500 leading-normal">
            Scan a Pit or Match assignment QR code from your team captain, or manually add targets below.
          </p>
        </div>
      )}

      {/* 4. MANUAL TARGET / MATCH ENROLLER */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-mono">
          Enroll Custom Team / Match Target
        </span>
        <form onSubmit={handleAddManualTeam} className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Team #"
            value={manualTeamInput}
            onChange={(e) => setManualTeamInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
            min={1}
            required
          />
          <input
            type="number"
            placeholder="Match # (Optional)"
            value={manualMatchInput}
            onChange={(e) => setManualMatchInput(e.target.value)}
            className="w-32 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
            min={1}
          />
          <button
            type="submit"
            className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-750 flex items-center gap-1 font-mono uppercase"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>

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
