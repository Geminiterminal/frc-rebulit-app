import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  ClipboardList, 
  Gamepad2, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  Camera, 
  ChevronRight, 
  ChevronLeft,
  X,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { scoutingAssignments } from '../../db/scoutingAssignments';
import { scoutingDB } from '../../db/indexedDB';
import { qrTransferEngine } from '../../utils/qrTransferEngine';
import { QrScannerModal } from '../common/QrScannerModal';

interface ScoutDashboardProps {
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const ScoutDashboard: React.FC<ScoutDashboardProps> = ({ onNavigate }) => {
  const [scoutProfile, setScoutProfile] = useState(scoutingAssignments.getProfile());
  const [myTargetTeams, setMyTargetTeams] = useState<number[]>([]);
  const [teamStatuses, setTeamStatuses] = useState<Record<number, { isPitScouted: boolean; matchCount: number }>>({});
  
  // Custom manual team input fallback
  const [manualTeamInput, setManualTeamInput] = useState<string>('');

  // Scanner Modal state (Scan Assignment QR)
  const [isScanAssignmentOpen, setIsScanAssignmentOpen] = useState<boolean>(false);
  const [scanAssignmentMsg, setScanAssignmentMsg] = useState<string | null>(null);

  const [isPushDataOpen, setIsPushDataOpen] = useState<boolean>(false);

  // Individual task QR sync panel states
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
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

    const statuses: Record<number, { isPitScouted: boolean; matchCount: number }> = {};
    for (const t of teams) {
      statuses[t] = await scoutingAssignments.getTeamStatus(t);
    }
    setTeamStatuses(statuses);
  };

  const handleScanAssignmentResult = (decodedText: string) => {
    setIsScanAssignmentOpen(false);
    const res = qrTransferEngine.parseAssignmentPayload(decodedText);
    setScanAssignmentMsg(res.message);
    loadScoutData();
    setTimeout(() => setScanAssignmentMsg(null), 4000);
  };

  const handleOpenTasksDone = async () => {
    const list: any[] = [];

    // 1. Fetch completed pit scouting profiles
    const allTeams = await scoutingDB.getAllTeams();
    for (const team of allTeams) {
      if (team.pit && Object.keys(team.pit).length > 0) {
        list.push({
          teamNumber: team.teamNumber,
          type: 'PIT',
          data: team.pit,
        });
      }
    }

    // 2. Fetch completed match scouting records
    const allMatches = await scoutingDB.getAllMatches();
    for (const match of allMatches) {
      list.push({
        teamNumber: match.teamNumber,
        type: 'MATCH',
        matchNumber: match.matchNumber,
        data: match,
      });
    }

    // Sort by type then team number
    setCompletedTasks(list.sort((a, b) => a.teamNumber - b.teamNumber));
    setIsPushDataOpen(true);
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
      setActiveTaskTitle(`Team ${task.teamNumber} (${task.type === 'PIT' ? 'Pit Scout' : `Match ${task.matchNumber}`})`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddManualTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(manualTeamInput.trim(), 10);
    if (num > 0 && !myTargetTeams.includes(num)) {
      scoutingAssignments.addTeamToTarget(num);
      setManualTeamInput('');
      loadScoutData();
    }
  };

  const isPitMode = scoutProfile.position.includes('PIT');

  return (
    <div className="max-w-md mx-auto px-2 sm:px-3 py-2 pb-24 flex flex-col gap-3 font-mono">
      {/* Top Main Action Bar */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setIsScanAssignmentOpen(true)}
          className="w-full py-3 px-3 rounded-xl bg-slate-800/40 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
        >
          <Camera className="w-4 h-4 text-slate-300" />
          <span>Scan Assign QR</span>
        </button>
      </div>

      {scanAssignmentMsg && (
        <div className="p-2.5 rounded-xl bg-[#0F172A] border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center gap-2 shadow">
          <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
          <span>{scanAssignmentMsg}</span>
        </div>
      )}

      {/* MY ASSIGNMENTS */}
      <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
        <div className="border-b border-slate-800/80 pb-2">
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            MY ASSIGNMENTS ({myTargetTeams.length})
          </div>
        </div>

        {/* Assignments List */}
        {myTargetTeams.length > 0 ? (
          <div className="space-y-2">
            {myTargetTeams.map((teamNum) => {
              const status = teamStatuses[teamNum];
              const isDone = isPitMode ? status?.isPitScouted : (status?.matchCount || 0) > 0;

              return (
                <div
                  key={teamNum}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isDone
                      ? 'bg-[#0B132B] border-emerald-600/60 text-emerald-200'
                      : 'bg-[#0B132B] border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div
                    onClick={() => onNavigate(isPitMode ? 'pit-scout' : 'match-scout', teamNum)}
                    className="flex items-center gap-2.5 font-bold text-sm flex-1"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>Team #{teamNum}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => onNavigate(isPitMode ? 'pit-scout' : 'match-scout', teamNum)}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span className={isDone ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {isDone ? 'Done ✓' : 'Tap to Scout'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>

                    {isDone && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (isPitMode) {
                            const teamData = await scoutingDB.getTeam(teamNum);
                            if (teamData?.pit) {
                              handleGenerateTaskQr({ type: 'PIT', teamNumber: teamNum, data: teamData.pit });
                            }
                          } else {
                            const matchData = await scoutingDB.getMatchesForTeam(teamNum);
                            if (matchData && matchData.length > 0) {
                              // Generate QR for the most recent match for now
                              handleGenerateTaskQr({ type: 'MATCH', teamNumber: teamNum, data: matchData[0], matchNumber: matchData[0].matchNumber });
                            }
                          }
                        }}
                        className="py-1 px-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-800/50 border border-emerald-800 text-emerald-300 text-[10px] font-bold cursor-pointer"
                      >
                        QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 text-center rounded-xl bg-[#0B132B] text-xs text-slate-400">
            No assignments loaded yet. Scan Assignment QR from Captain or add team # below.
          </div>
        )}

        {/* Manual Add Team Fallback */}
        <form onSubmit={handleAddManualTeam} className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <input
            type="number"
            placeholder="+ Team #"
            value={manualTeamInput}
            onChange={(e) => setManualTeamInput(e.target.value)}
            className="flex-1 bg-[#0B132B] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500"
            min={1}
          />
          <button
            type="submit"
            className="py-2 px-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Add
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

      {/* PUSH DATA QR GENERATOR MODAL */}
      {isPushDataOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-200 font-mono uppercase tracking-wider">
                COMPLETED TASKS ({completedTasks.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsPushDataOpen(false);
                  setActiveTaskQrUrl(null);
                  setActiveTaskTitle(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-left font-mono">
              Select a completed team below to generate its single-record QR. Have Captain scan with "Scan Scout Data QR":
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto text-left pr-1 scrollbar-thin">
              {completedTasks.length > 0 ? (
                completedTasks.map((task, idx) => (
                  <div
                    key={`${task.type}-${task.teamNumber}-${task.matchNumber || idx}`}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span>Team #{task.teamNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          task.type === 'PIT'
                            ? 'bg-slate-800 text-slate-300 border border-slate-750'
                            : 'bg-slate-800/60 text-slate-400 border border-slate-750/50'
                        }`}>
                          {task.type === 'PIT' ? 'Pit' : `Match ${task.matchNumber}`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateTaskQr(task)}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer transition-colors active:scale-95"
                    >
                      GENERATE QR
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No completed scout data found. Start scouting first!</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsPushDataOpen(false);
                setActiveTaskQrUrl(null);
                setActiveTaskTitle(null);
              }}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* INDIVIDUAL TASK QR OVERLAY MODAL */}
      {activeTaskQrUrl && activeTaskTitle && (
        <div className="fixed inset-0 z-55 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-200 font-mono uppercase tracking-wider">
                Sync QR: {activeTaskTitle}
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

            <p className="text-xs text-slate-300 font-mono">
              Have <strong>Captain</strong> scan this low-density QR code to import:
            </p>

            <div className="p-3 bg-white rounded-2xl inline-block mx-auto shadow-lg">
              <img src={activeTaskQrUrl} alt="Task QR" className="w-52 h-52 mx-auto" />
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTaskQrUrl(null);
                setActiveTaskTitle(null);
              }}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
