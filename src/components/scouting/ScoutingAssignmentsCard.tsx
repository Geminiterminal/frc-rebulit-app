import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Plus, 
  CheckCircle2, 
  Clock, 
  UploadCloud, 
  DownloadCloud, 
  UserCheck, 
  Crown,
  RefreshCw,
  X
} from 'lucide-react';
import { 
  scoutingAssignments, 
  ScoutAssignment, 
  ScoutProfile 
} from '../../db/scoutingAssignments';
import { cloudSync } from '../../db/cloudSync';
import { p2pSync } from '../../db/p2pSync';
import { bluetoothSync } from '../../db/bluetoothSync';
import { Bluetooth } from 'lucide-react';

interface ScoutingAssignmentsCardProps {
  onSelectTeam?: (teamNumber: number) => void;
  onNavigate?: (view: string, teamNumber?: number) => void;
  compact?: boolean;
}

export function ScoutingAssignmentsCard({ onSelectTeam, onNavigate, compact = false }: ScoutingAssignmentsCardProps) {
  const [profile, setProfile] = useState<ScoutProfile>(scoutingAssignments.getProfile());
  const [assignedTeams, setAssignedTeams] = useState<number[]>([]);
  const [teamStatuses, setTeamStatuses] = useState<Record<number, { isPitScouted: boolean; matchCount: number }>>({});
  const [newTeamInput, setNewTeamInput] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [allAssignments, setAllAssignments] = useState<ScoutAssignment[]>([]);
  
  // Assign modal state
  const [targetScout, setTargetScout] = useState<string>('');
  const [teamsCsvInput, setTeamsCsvInput] = useState<string>('');
  
  // Sync state
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const isLead = profile.position === 'LEAD_SCOUT';

  const loadData = async () => {
    const currentProf = scoutingAssignments.getProfile();
    setProfile(currentProf);
    const teams = scoutingAssignments.getMyTargetTeams();
    setAssignedTeams(teams);

    const statuses: Record<number, { isPitScouted: boolean; matchCount: number }> = {};
    for (const t of teams) {
      statuses[t] = await scoutingAssignments.getTeamStatus(t);
    }
    setTeamStatuses(statuses);
    setAllAssignments(scoutingAssignments.getAllAssignments());
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newTeamInput.trim(), 10);
    if (num > 0 && !assignedTeams.includes(num)) {
      scoutingAssignments.addTeamToTarget(num);
      setNewTeamInput('');
      loadData();
    }
  };

  const handleRemoveTeam = (teamNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    scoutingAssignments.removeTeamFromTarget(teamNumber);
    loadData();
  };

  const handleTeamClick = (teamNumber: number) => {
    if (onSelectTeam) {
      onSelectTeam(teamNumber);
    } else if (onNavigate) {
      onNavigate('pit-scout', teamNumber);
    }
  };

  const handleSaveScoutAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetScout.trim()) return;
    const nums = teamsCsvInput
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    scoutingAssignments.assignTeamsToScout(targetScout.trim(), nums);
    setIsAssignModalOpen(false);
    setTargetScout('');
    setTeamsCsvInput('');
    loadData();
  };

  const handlePushData = async () => {
    setIsPushing(true);
    setSyncFeedback(null);
    try {
      await cloudSync.pushLocalDataToCloud().catch(() => null);
      await p2pSync.pushLocalData().catch(() => null);
      setSyncFeedback('✅ Pushed');
      loadData();
    } catch {
      setSyncFeedback('Saved locally');
    } finally {
      setIsPushing(false);
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const handlePullData = async () => {
    setIsPulling(true);
    setSyncFeedback(null);
    try {
      await cloudSync.pullRemoteUpdates().catch(() => null);
      await p2pSync.pullRemoteData().catch(() => null);
      setSyncFeedback('⬇️ Pulled');
      loadData();
    } catch {
      setSyncFeedback('Up to date');
    } finally {
      setIsPulling(false);
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const completedCount = assignedTeams.filter((t) => teamStatuses[t]?.isPitScouted).length;
  const progressPercent = assignedTeams.length > 0 ? Math.round((completedCount / assignedTeams.length) * 100) : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
            Pit Duty
          </h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 ${
            isLead ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80' : 'bg-slate-800 text-slate-300'
          }`}>
            {isLead && <Crown className="w-2.5 h-2.5 text-amber-400" />}
            <span>{profile.name}</span>
          </span>
        </div>

        {/* Sync Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              const res = await bluetoothSync.shareDataViaBluetooth();
              setSyncFeedback(res.message);
              setTimeout(() => setSyncFeedback(null), 3000);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900 text-[11px] font-semibold cursor-pointer"
            title="1-Click Bluetooth / Quick Share to nearby scouts"
          >
            <Bluetooth className="w-3 h-3 text-cyan-400" />
            <span>Bluetooth</span>
          </button>

          <button
            type="button"
            onClick={handlePushData}
            disabled={isPushing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
          >
            {isPushing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
            <span>Push</span>
          </button>

          <button
            type="button"
            onClick={handlePullData}
            disabled={isPulling}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 hover:bg-indigo-900 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
          >
            {isPulling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DownloadCloud className="w-3 h-3" />}
            <span>Pull</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200">
          {syncFeedback}
        </div>
      )}

      {/* Progress Bar (Only when teams exist) */}
      {assignedTeams.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Progress</span>
            <span>{completedCount} / {assignedTeams.length} Scouted</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
            <div 
              className="bg-cyan-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Assigned Team Chips */}
      {assignedTeams.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {assignedTeams.map((teamNum) => {
            const isScouted = teamStatuses[teamNum]?.isPitScouted;

            return (
              <div
                key={teamNum}
                onClick={() => handleTeamClick(teamNum)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                  isScouted
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200 hover:bg-emerald-900/60'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-200 hover:bg-amber-900/60'
                }`}
              >
                {isScouted ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                )}
                <span className="font-mono font-bold text-xs">{teamNum}</span>
                {isLead && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTeam(teamNum, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity p-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            {isLead ? 'No target teams added yet.' : 'No pit teams assigned yet.'}
          </p>
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {isLead ? (
          <form onSubmit={handleAddTeam} className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="+ Team #"
              value={newTeamInput}
              onChange={(e) => setNewTeamInput(e.target.value)}
              className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              min={1}
            />
            <button
              type="submit"
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs cursor-pointer transition-colors"
              title="Add team"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <span className="text-[10px] text-slate-500 font-mono">
            Assigned by Lead Scout
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsAssignModalOpen(true)}
          className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer ml-auto"
        >
          <UserCheck className="w-3 h-3 text-cyan-400" />
          <span>{isLead ? 'Assign Scouts' : 'Scout Roster'}</span>
        </button>
      </div>

      {/* Scout Assignment Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-sm w-full space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isLead ? 'Assign Teams to Scouts' : 'Scout Roster'}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Existing Assignments */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {allAssignments.length > 0 ? (
                allAssignments.map((a) => (
                  <div key={a.scoutName} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs flex justify-between items-center">
                    <span className="font-semibold text-slate-200">{a.scoutName}</span>
                    <span className="text-cyan-400 font-mono text-[11px]">
                      {a.assignedTeams.length > 0 ? a.assignedTeams.join(', ') : 'None'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-500 text-center py-2">No assignments configured.</p>
              )}
            </div>

            {/* Assign Form (ONLY for Lead Scout) */}
            {isLead && (
              <form onSubmit={handleSaveScoutAssignment} className="space-y-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Scout Name"
                  value={targetScout}
                  onChange={(e) => setTargetScout(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Teams"
                  value={teamsCsvInput}
                  onChange={(e) => setTeamsCsvInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Save & Distribute
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
