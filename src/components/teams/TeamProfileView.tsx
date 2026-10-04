import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord, PitData, EventScheduleMatch, FieldRouteType, DefenseEffectivenessType, RobotIssuesType } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  ArrowLeft, 
  Edit3, 
  Gamepad2, 
  Camera, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2,
  X,
  Calendar,
  ChevronRight,
  TrendingUp,
  Cpu,
  Activity,
  Award,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Eye,
  Settings,
  Shield,
  Wrench,
  Check
} from 'lucide-react';

interface TeamProfileViewProps {
  teamNumber: number;
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
}

export const TeamProfileView: React.FC<TeamProfileViewProps> = ({
  teamNumber,
  onNavigate,
}) => {
  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [scheduledMatches, setScheduledMatches] = useState<EventScheduleMatch[]>([]);
  const [showMatchPicker, setShowMatchPicker] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Dropdown collapse states for captain control
  const [showKpis, setShowKpis] = useState<boolean>(true);
  const [showPitAndAverages, setShowPitAndAverages] = useState<boolean>(true);
  const [showMatchObs, setShowMatchObs] = useState<boolean>(true);

  useEffect(() => {
    loadTeamData();
  }, [teamNumber]);

  const loadTeamData = async () => {
    const profile = await scoutingDB.getTeam(teamNumber);
    if (profile) {
      setTeam(profile);
    } else {
      setTeam({
        teamNumber,
        teamName: `Team ${teamNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const teamMatches = await scoutingDB.getMatchesForTeam(teamNumber);
    setMatches(teamMatches);

    const sched = await scoutingDB.getScheduleForTeam(teamNumber);
    setScheduledMatches(sched);
  };

  const handleMatchScoutClick = async () => {
    const sched = await scoutingDB.getScheduleForTeam(teamNumber);
    if (sched && sched.length > 0) {
      setScheduledMatches(sched);
      setShowMatchPicker(true);
    } else {
      onNavigate('match-scout', teamNumber);
    }
  };

  if (!team) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-slate-400 font-mono">
        Loading Team {teamNumber}...
      </div>
    );
  }

  const pit = team.pit;

  // CALCULATE STATS
  const matchCount = matches.length;
  
  const autoFuelValues = matches.map((m) => m.autoFuelScored ?? m.autoHighScored ?? 0);
  const teleopFuelValues = matches.map((m) => m.teleopFuelScored ?? m.teleopHighScored ?? 0);
  const totalFuelValues = matches.map((m, idx) => autoFuelValues[idx] + teleopFuelValues[idx]);

  const avgAutoFuelNum = matchCount ? autoFuelValues.reduce((a, b) => a + b, 0) / matchCount : 0;
  const avgAutoFuel = avgAutoFuelNum.toFixed(1);

  const avgTeleopFuelNum = matchCount ? teleopFuelValues.reduce((a, b) => a + b, 0) / matchCount : 0;
  const avgTeleopFuel = avgTeleopFuelNum.toFixed(1);

  const avgTotalFuelNum = matchCount ? totalFuelValues.reduce((a, b) => a + b, 0) / matchCount : 0;
  const avgTotalFuel = avgTotalFuelNum.toFixed(1);

  const minTotal = matchCount ? Math.min(...totalFuelValues) : 0;
  const maxTotal = matchCount ? Math.max(...totalFuelValues) : 0;
  const maxTeleop = matchCount ? Math.max(...teleopFuelValues) : 0;

  const autoWorkedCount = matches.filter((m) => m.autoWorked === true || String(m.autoWorked) === 'true').length;

  // Route breakdown
  const routeBumpCount = matches.filter((m) => m.fieldRoute === 'BUMP').length;
  const routeTrenchCount = matches.filter((m) => m.fieldRoute === 'TRENCH').length;
  const routeBothCount = matches.filter((m) => m.fieldRoute === 'BOTH').length;
  const routeNeitherCount = matches.filter((m) => m.fieldRoute === 'NEITHER' || !m.fieldRoute).length;

  let predominantRoute = '—';
  if (routeBothCount >= routeBumpCount && routeBothCount >= routeTrenchCount && routeBothCount > 0) predominantRoute = 'Both';
  else if (routeBumpCount >= routeTrenchCount && routeBumpCount > 0) predominantRoute = 'Bump';
  else if (routeTrenchCount > 0) predominantRoute = 'Trench';

  // Defense
  const playedDefenseCount = matches.filter((m) => m.playedDefense).length;
  let avgDefenseEff = 'Medium';
  const defMatches = matches.filter((m) => m.playedDefense && m.defenseEffectiveness);
  if (defMatches.length > 0) {
    const high = defMatches.filter((m) => m.defenseEffectiveness === 'HIGH').length;
    const low = defMatches.filter((m) => m.defenseEffectiveness === 'LOW').length;
    if (high >= defMatches.length / 2) avgDefenseEff = 'High';
    else if (low >= defMatches.length / 2) avgDefenseEff = 'Low';
  }

  // Issues
  const issueDisabledCount = matches.filter((m) => m.robotIssues === 'DISABLED').length;
  const issueCleanCount = matches.filter((m) => m.robotIssues === 'NONE' || !m.robotIssues).length;

  const latestMatchWithNote = [...matches].reverse().find((m) => m.quickNote || m.notes || m.whatHappenedNote);
  const latestNoteText = latestMatchWithNote ? (latestMatchWithNote.quickNote || latestMatchWithNote.notes || latestMatchWithNote.whatHappenedNote) : 'No recent notes.';

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-28 flex flex-col gap-5 font-mono text-slate-100">
      {/* HEADER NAVIGATION */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('teams')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>&lt; All Teams</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('pit-scout', teamNumber)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span>[Edit Pit]</span>
          </button>
          <button
            type="button"
            onClick={handleMatchScoutClick}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>[+ Scout Match]</span>
          </button>
        </div>
      </div>

      {/* TEAM IDENTITY BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              TEAM {team.teamNumber}
            </span>
            <span className="text-sm font-bold text-slate-400">
              "{team.teamName || `Team ${team.teamNumber}`}"
            </span>
          </div>

          {team.customPicklistRank && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-right">
              <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-bold">PREFERENCE RANK</span>
              <span className="text-lg font-black text-amber-400 font-mono">#{team.customPicklistRank}</span>
            </div>
          )}
        </div>

        {/* Quick Badges */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="px-2.5 py-1 rounded-md bg-slate-950 text-emerald-400 border border-emerald-900/40 text-[11px] font-bold">
            [{pit?.drivetrain || 'SWERVE'}]
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-950 text-sky-400 border border-sky-900/40 text-[11px] font-bold">
            [{pit?.bumpTrench ? `${pit.bumpTrench}` : 'BUMP & TRENCH'}]
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-950 text-amber-400 border border-amber-900/40 text-[11px] font-bold">
            [HOPPER: {pit?.hopperCapacity !== undefined ? pit.hopperCapacity : '25'}]
          </span>
        </div>
      </div>

      {/* SECTION 1: HEADER & KPI BAR (COLLAPSIBLE) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer select-none" onClick={() => setShowKpis(!showKpis)}>
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>SUMMARY METRICS (KPIs)</span>
          </span>
          <button type="button" className="text-slate-400 hover:text-white p-1">
            {showKpis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showKpis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">AVG TOTAL FUEL</div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{avgTotalFuel}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Range: {minTotal} - {maxTotal}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">AUTO WORKED</div>
              <div className="text-xl sm:text-2xl font-black text-blue-400 mt-1">{autoWorkedCount} / {matchCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Avg Fuel: {avgAutoFuel}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">AVG TELEOP FUEL</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{avgTeleopFuel}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Max Teleop: {maxTeleop}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">MATCHES</div>
              <div className="text-xl sm:text-2xl font-black text-slate-200 mt-1">{matchCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Scouted Matches</div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: PIT SCOUT vs MATCH AVERAGES (COLLAPSIBLE 2-COLUMN GRID) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer select-none" onClick={() => setShowPitAndAverages(!showPitAndAverages)}>
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>PIT CLAIMS & VERIFIED MATCH AVERAGES</span>
          </span>
          <button type="button" className="text-slate-400 hover:text-white p-1">
            {showPitAndAverages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showPitAndAverages && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Left Column — Pit Scout */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-b border-slate-900 pb-1.5">
                  PIT SCOUT
                </h4>

                <ul className="space-y-2 text-xs text-slate-300 font-mono">
                  <li>• <strong className="text-slate-400">Drivetrain:</strong> {pit?.drivetrain || 'Swerve'} {pit?.drivetrainOther && `(${pit.drivetrainOther})`}</li>
                  <li>• <strong className="text-slate-400">Shooter:</strong> {pit?.shooter && pit.shooter.length > 0 ? pit.shooter.join(', ') : 'Fixed, Dumper'}</li>
                  <li>• <strong className="text-slate-400">Accuracy:</strong> {pit?.shootingAccuracy || '85-94%'}</li>
                  <li>• <strong className="text-slate-400">Autonomous:</strong> {pit?.hasAutonomous === 'YES' ? `${pit.autoRoutinesCount || '3'} Routines (${pit.autoConsistency || 'Very Consistent'})` : '3 Routines (Very Consistent)'}</li>
                  <li>• <strong className="text-slate-400">Reliability:</strong> {pit?.reliability || 'Mostly Reliable'}</li>
                  <li>• <strong className="text-slate-400">Known Issues:</strong> {pit?.biggestIssues && pit.biggestIssues.length > 0 ? pit.biggestIssues.join(', ') : 'Electrical'}</li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-900 text-xs text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">Notes:</span>
                <p className="italic text-slate-300">"{pit?.notes || 'Aligns to fender, fast 2s cycle.'}"</p>
              </div>
            </div>

            {/* Right Column — Match Averages */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-1.5">
                  MATCH AVERAGES
                </h4>

                <ul className="space-y-2 text-xs text-slate-300 font-mono">
                  <li>• <strong className="text-slate-400">Auto Fuel:</strong> <span className="text-blue-400 font-bold">{avgAutoFuel} Avg</span></li>
                  <li>• <strong className="text-slate-400">Teleop Fuel:</strong> <span className="text-emerald-400 font-bold">{avgTeleopFuel} Avg</span> (Max: {maxTeleop || 160})</li>
                  <li>• <strong className="text-slate-400">Field Route:</strong> {predominantRoute} ({matchCount} matches)</li>
                  <li>• <strong className="text-slate-400">Defense:</strong> Played {playedDefenseCount}/{matchCount} ({avgDefenseEff})</li>
                  <li>• <strong className="text-slate-400">Issues Tally:</strong> <span className="text-emerald-300">{issueCleanCount} Clean</span> | <span className="text-rose-300">{issueDisabledCount} Disabled</span></li>
                </ul>
              </div>

              <div className="pt-2 border-t border-slate-900 text-xs text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">Latest Scout Note:</span>
                <p className="italic text-slate-300">"{latestNoteText}"</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: MATCH OBSERVATIONS FEED (COLLAPSIBLE) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer select-none" onClick={() => setShowMatchObs(!showMatchObs)}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>MATCH OBSERVATIONS ({matchCount} Matches)</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('match-scout', teamNumber);
              }}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 uppercase cursor-pointer"
            >
              [+ ADD MATCH]
            </button>
            <button type="button" className="text-slate-400 hover:text-white p-1">
              {showMatchObs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showMatchObs && (
          <div className="space-y-3 pt-1">
            {matchCount > 0 ? (
              matches.map((m) => {
                const totalFuel = (m.autoFuelScored ?? m.autoHighScored ?? 0) + (m.teleopFuelScored ?? m.teleopHighScored ?? 0);
                
                let statusLabel = 'NO ISSUES / CLEAN';
                let statusBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
                if (m.robotIssues === 'DISABLED') {
                  statusLabel = 'DISABLED - STOPPED MOVING';
                  statusBg = 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse';
                } else if (m.robotIssues === 'MAJOR') {
                  statusLabel = 'MAJOR ISSUE';
                  statusBg = 'bg-amber-950 text-amber-300 border-amber-600';
                } else if (m.robotIssues === 'MINOR') {
                  statusLabel = 'MINOR ISSUE';
                  statusBg = 'bg-yellow-950 text-yellow-300 border-yellow-800';
                }

                const defLabel = m.playedDefense ? (m.defenseEffectiveness === 'HIGH' ? 'DEF: HIGH' : m.defenseEffectiveness === 'LOW' ? 'DEF: LOW' : 'DEF: MED') : 'DEF: NO';

                return (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2.5 text-xs text-slate-300 font-mono shadow"
                  >
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm">
                          MATCH {m.matchNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-950 text-sky-300 border border-sky-800">
                          {m.alliance ? `${m.alliance} alliance` : 'BLUE ALLIANCE'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-slate-300 pt-0.5">
                      <span>Auto: <strong className="text-blue-400">{m.autoFuelScored ?? m.autoHighScored ?? 0}</strong></span>
                      <span>Teleop: <strong className="text-emerald-400">{m.teleopFuelScored ?? m.teleopHighScored ?? 0}</strong></span>
                      <span>Total: <strong className="text-amber-400 font-black">{totalFuel}</strong></span>
                      <span>Route: <strong className="text-purple-300">{m.fieldRoute || 'Both'}</strong></span>
                      <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-800 font-bold">
                        [{defLabel}]
                      </span>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-slate-900/80">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusBg}`}>
                          [{statusLabel}]
                        </span>
                      </div>
                      {(m.quickNote || m.notes || m.whatHappenedNote) && (
                        <p className="text-slate-300 italic pt-0.5">
                          Note: "{m.quickNote || m.notes || m.whatHappenedNote}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                No match observations recorded for Team {teamNumber} yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox photo preview */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img src={selectedPhoto} alt="Full view" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/80 text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
