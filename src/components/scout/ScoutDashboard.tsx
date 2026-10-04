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
  Plus
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

  const handleGenerateTaskQr = async (task: any) => {
    const scoutName = scoutProfile.name || 'Scout';
    let payloadStr = '';

    if (task.type === 'PIT') {
      payloadStr = qrTransferEngine.generateSinglePitQr(scoutName, task.teamNumber, task.data);
    } else {
      payloadStr = qrTransferEngine.generateSingleMatchQr(scoutName, task.data);
    }

    try {
      const url = await QRCode.toDataURL(payloadStr, { errorCorrectionLevel: 'L', margin: 1, width: 280 });
      setActiveTaskQrUrl(url);
      setActiveTaskTitle(`Team ${task.teamNumber} (${task.type === 'PIT' ? 'Pit' : `Match ${task.matchNumber}`})`);
    } catch (e) {
      console.error(e);
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
      }
      scoutingAssignments.addTeamToTarget(num);
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
          className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-100 border border-slate-800 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-2 transition-colors shadow-sm"
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

      {/* ASSIGNMENTS CARD */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div className="border-b border-slate-800/80 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPitMode ? (
              <Target className="w-4 h-4 text-blue-400" />
            ) : (
              <Gamepad2 className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Assignments ({myTargetTeams.length})
            </span>
          </div>
          <span className="text-[10px] text-slate-400 uppercase font-mono">
            {isPitMode ? 'Pit Mode' : 'Match Mode'}
          </span>
        </div>

        {/* MATCH SCOUT SPECIFIC TASKS LIST */}
        {myMatchTargets.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center justify-between">
              <span>Match Scouting Assignments ({myMatchTargets.length})</span>
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
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      isMatchDone
                        ? 'bg-slate-950 border-emerald-600/40 text-emerald-200'
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

                      <button
                        type="button"
                        onClick={() => onNavigate('match-scout', task.teamNumber, task.matchNumber, taskAlliance)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors font-mono shrink-0 ${
                          isMatchDone
                            ? 'bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow font-black'
                        }`}
                      >
                        {isMatchDone ? 'Review Match' : 'Scout Match'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Queue Items */}
        {myTargetTeams.length > 0 ? (
          <div className="space-y-1.5">
            {myTargetTeams.map((teamNum) => {
              const status = teamStatuses[teamNum];
              const schedMatches = teamSchedulesMap[teamNum] || [];
              const scoutedMatches = teamScoutedMatchesMap[teamNum] || [];
              const isExpanded = expandedTeams.has(teamNum);
              const isDone = isPitMode ? status?.isPitScouted : (scoutedMatches.length > 0);

              return (
                <div
                  key={teamNum}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isDone
                      ? 'bg-slate-950 border-slate-800'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Primary Team Header Row */}
                  <div
                    onClick={() => {
                      if (isPitMode) {
                        onNavigate('pit-scout', teamNum);
                      } else {
                        toggleExpandTeam(teamNum);
                      }
                    }}
                    className="p-3 flex items-center justify-between cursor-pointer select-none text-xs"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-slate-100">
                        Team #{teamNum}
                      </span>
                      {!isPitMode && schedMatches.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({schedMatches.length} {schedMatches.length === 1 ? 'match' : 'matches'})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isDone && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Done</span>
                        </span>
                      )}

                      {isPitMode ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('pit-scout', teamNum);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
                          }`}
                        >
                          {isDone ? 'Review' : 'Scout'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-400 hover:text-white text-xs">
                          <span className="text-[10px] font-bold">
                            {isExpanded ? 'Hide Schedule' : 'Schedule'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Extended Match Schedule Dropdown */}
                  {!isPitMode && isExpanded && (
                    <div className="p-2.5 bg-slate-900 border-t border-slate-800/80 space-y-1.5">
                      <div className="text-[10px] text-slate-400 font-mono font-bold uppercase flex items-center justify-between">
                        <span>Team {teamNum} Matches:</span>
                        <span>{schedMatches.length} Scheduled</span>
                      </div>

                      {schedMatches.length > 0 ? (
                        <div className="space-y-1">
                          {schedMatches.map((m) => {
                            const isMatchDone = scoutedMatches.includes(m.matchNumber);
                            const isRed = m.redTeams.includes(teamNum);
                            const badgeBg = isRed
                              ? 'bg-rose-950/80 border-rose-900 text-rose-300'
                              : 'bg-sky-950/80 border-sky-900 text-sky-300';

                            return (
                              <div
                                key={m.key}
                                className={`p-2 rounded-lg border flex items-center justify-between text-xs transition-all ${
                                  isMatchDone
                                    ? 'bg-slate-950 border-emerald-600/40 text-emerald-200'
                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white uppercase text-xs">
                                    {m.compLevel === 'qm' ? `Qual ${m.matchNumber}` : `Match ${m.matchNumber}`}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${badgeBg}`}>
                                    {isRed ? 'Red' : 'Blue'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {isMatchDone && (
                                    <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => onNavigate('match-scout', teamNum, m.matchNumber)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                      isMatchDone
                                        ? 'bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750'
                                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow font-black'
                                    }`}
                                  >
                                    {isMatchDone ? 'Review' : 'Scout'}
                                  </button>

                                  {isMatchDone && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const matches = await scoutingDB.getMatchesForTeam(teamNum);
                                        const matched = matches.find((rc) => rc.matchNumber === m.matchNumber) || matches[0];
                                        if (matched) {
                                          handleGenerateTaskQr({ type: 'MATCH', teamNumber: teamNum, data: matched, matchNumber: m.matchNumber });
                                        }
                                      }}
                                      className="py-1 px-2 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-100 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                      title="Show QR"
                                    >
                                      <QrCode className="w-3 h-3 text-slate-300" />
                                      <span>QR</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-1.5">
                          <p className="text-[11px] text-slate-400">
                            No match schedule imported yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => onNavigate('match-scout', teamNum)}
                            className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-750 text-white text-[11px] font-bold border border-slate-700 cursor-pointer"
                          >
                            + Scout Match Directly
                          </button>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onNavigate('match-scout', teamNum)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer underline"
                        >
                          + Scout Custom Match #
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center rounded-xl bg-slate-950 text-xs text-slate-400">
            No assignments loaded yet. Scan QR or add team # below.
          </div>
        )}

        {/* Manual Add Queue */}
        <form onSubmit={handleAddManualTeam} className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <input
            type="number"
            placeholder="+ Team #"
            value={manualTeamInput}
            onChange={(e) => setManualTeamInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
            min={1}
          />
          {!isPitMode && (
            <input
              type="number"
              placeholder="Match #"
              value={manualMatchInput}
              onChange={(e) => setManualMatchInput(e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
              min={1}
            />
          )}
          <button
            type="submit"
            className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-750 flex items-center gap-1"
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
