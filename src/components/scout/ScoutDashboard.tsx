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

  // Push Data QR Modal State
  const [isPushDataOpen, setIsPushDataOpen] = useState<boolean>(false);
  const [qrChunks, setQrChunks] = useState<string[]>([]);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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

  const handlePushData = async () => {
    const chunks = await qrTransferEngine.generateScoutDataQrChunks(scoutProfile.name || 'SCOUT');
    setQrChunks(chunks);
    setCurrentChunkIdx(0);
    setIsPushDataOpen(true);
    renderChunkQr(chunks[0]);
  };

  const renderChunkQr = async (chunkPayloadStr: string) => {
    try {
      const url = await QRCode.toDataURL(chunkPayloadStr, { margin: 1, width: 280 });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl(null);
    }
  };

  const handleNextChunk = () => {
    if (currentChunkIdx < qrChunks.length - 1) {
      const nextIdx = currentChunkIdx + 1;
      setCurrentChunkIdx(nextIdx);
      renderChunkQr(qrChunks[nextIdx]);
    }
  };

  const handlePrevChunk = () => {
    if (currentChunkIdx > 0) {
      const prevIdx = currentChunkIdx - 1;
      setCurrentChunkIdx(prevIdx);
      renderChunkQr(qrChunks[prevIdx]);
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
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsScanAssignmentOpen(true)}
          className="py-3 px-3 rounded-xl bg-slate-800/40 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
        >
          <Camera className="w-4 h-4 text-slate-300" />
          <span>Scan Assign QR</span>
        </button>

        <button
          type="button"
          onClick={handlePushData}
          className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold border border-slate-700 text-xs uppercase cursor-pointer transition-all active:scale-98 shadow flex items-center justify-center gap-1.5"
        >
          <QrCode className="w-4 h-4 text-slate-300" />
          <span>PUSH DATA QR</span>
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
                  onClick={() => onNavigate(isPitMode ? 'pit-scout' : 'match-scout', teamNum)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isDone
                      ? 'bg-[#0B132B] border-emerald-600/60 text-emerald-200'
                      : 'bg-[#0B132B] border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 font-bold text-sm">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>Team #{teamNum}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={isDone ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {isDone ? 'Done ✓' : 'Tap to Scout'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
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

      {/* QUICK LAUNCH FORMS */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNavigate('pit-scout')}
          className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer flex items-center justify-between"
        >
          <span className="text-xs font-bold text-slate-200">Pit Form</span>
          <ClipboardList className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('match-scout')}
          className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer flex items-center justify-between"
        >
          <span className="text-xs font-bold text-slate-200">Match Form</span>
          <Gamepad2 className="w-4 h-4 text-slate-400" />
        </button>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-emerald-400 font-mono uppercase">
                SHOW QR TO CAPTAIN ({currentChunkIdx + 1} / {qrChunks.length})
              </span>
              <button
                type="button"
                onClick={() => setIsPushDataOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              Have <strong>Captain</strong> scan this QR code with "Scan Data" camera:
            </p>

            {qrDataUrl && (
              <div className="p-3 bg-white rounded-xl inline-block mx-auto shadow-lg">
                <img src={qrDataUrl} alt="Scout Data QR" className="w-52 h-52 mx-auto" />
              </div>
            )}

            {/* Chunking Pagination */}
            {qrChunks.length > 1 && (
              <div className="flex items-center justify-between gap-2 pt-1 font-mono">
                <button
                  type="button"
                  onClick={handlePrevChunk}
                  disabled={currentChunkIdx === 0}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>
                <span className="text-xs text-slate-300 font-bold">
                  {currentChunkIdx + 1} of {qrChunks.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextChunk}
                  disabled={currentChunkIdx === qrChunks.length - 1}
                  className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsPushDataOpen(false)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
