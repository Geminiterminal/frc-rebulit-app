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
  HelpCircle
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

  // 1. CALCULATE KPI STATS
  const matchCount = matches.length;
  
  const avgAutoFuelNum = matchCount 
    ? (matches.reduce((acc, m) => acc + (m.autoFuelScored ?? m.autoHighScored ?? 0), 0) / matchCount) 
    : 0;
  const avgAutoFuel = avgAutoFuelNum.toFixed(1);

  const avgTeleopFuelNum = matchCount 
    ? (matches.reduce((acc, m) => acc + (m.teleopFuelScored ?? m.teleopHighScored ?? 0), 0) / matchCount) 
    : 0;
  const avgTeleopFuel = avgTeleopFuelNum.toFixed(1);

  const avgTotalFuel = (avgAutoFuelNum + avgTeleopFuelNum).toFixed(1);

  const autoWorkedCount = matches.filter((m) => m.autoWorked === true || String(m.autoWorked) === 'true').length;
  const autoSuccessRate = matchCount ? Math.round((autoWorkedCount / matchCount) * 100) : 0;

  const uptimeCount = matches.filter((m) => m.robotIssues === 'NONE' || m.robotIssues === 'MINOR' || !m.robotIssues).length;
  const uptimeRate = matchCount ? Math.round((uptimeCount / matchCount) * 100) : 100;

  // 2. CALC OBSERVED PERFORMANCE TRENDS
  const maxTeleopFuel = matchCount ? Math.max(...matches.map((m) => m.teleopFuelScored ?? m.teleopHighScored ?? 0)) : 0;
  const maxAutoFuel = matchCount ? Math.max(...matches.map((m) => m.autoFuelScored ?? m.autoHighScored ?? 0)) : 0;

  // Route breakdown
  const routeBumpCount = matches.filter((m) => m.fieldRoute === 'BUMP').length;
  const routeTrenchCount = matches.filter((m) => m.fieldRoute === 'TRENCH').length;
  const routeBothCount = matches.filter((m) => m.fieldRoute === 'BOTH').length;
  const routeNeitherCount = matches.filter((m) => m.fieldRoute === 'NEITHER' || !m.fieldRoute).length;

  let preferredRouteStr = '—';
  if (matchCount > 0) {
    const percentages: string[] = [];
    if (routeBothCount) percentages.push(`${Math.round((routeBothCount / matchCount) * 100)}% Both`);
    if (routeBumpCount) percentages.push(`${Math.round((routeBumpCount / matchCount) * 100)}% Bump`);
    if (routeTrenchCount) percentages.push(`${Math.round((routeTrenchCount / matchCount) * 100)}% Trench`);
    if (routeNeitherCount && percentages.length === 0) percentages.push('100% Neither');
    preferredRouteStr = percentages.join(', ');
  }

  // Defense breakdown
  const playedDefenseCount = matches.filter((m) => m.playedDefense).length;
  const defensePercentage = matchCount ? Math.round((playedDefenseCount / matchCount) * 100) : 0;

  let avgDefenseEffectiveness = '—';
  if (playedDefenseCount > 0) {
    const defenseMatches = matches.filter((m) => m.playedDefense && m.defenseEffectiveness);
    const high = defenseMatches.filter((m) => m.defenseEffectiveness === 'HIGH').length;
    const med = defenseMatches.filter((m) => m.defenseEffectiveness === 'MEDIUM').length;
    const low = defenseMatches.filter((m) => m.defenseEffectiveness === 'LOW').length;

    if (high >= med && high >= low && high > 0) avgDefenseEffectiveness = 'High';
    else if (med >= high && med >= low && med > 0) avgDefenseEffectiveness = 'Medium';
    else if (low > 0) avgDefenseEffectiveness = 'Low';
    else avgDefenseEffectiveness = 'Medium';
  }

  // Issues Breakdown
  const issueDisabledCount = matches.filter((m) => m.robotIssues === 'DISABLED').length;
  const issueMajorCount = matches.filter((m) => m.robotIssues === 'MAJOR').length;
  const issueMinorCount = matches.filter((m) => m.robotIssues === 'MINOR').length;
  const issueCleanCount = matches.filter((m) => m.robotIssues === 'NONE' || !m.robotIssues).length;

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

      {/* A. HEADER IDENTITY & KPI BAR */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3.5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                TEAM {team.teamNumber}
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-400">
                "{team.teamName || `Team ${team.teamNumber}`}"
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-bold">
                [{pit?.drivetrain || 'No Pit Data'}]
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 text-sky-400 border border-slate-800 text-[10px] font-bold">
                [{pit?.bumpTrench ? `${pit.bumpTrench}: BUMP/TRENCH` : 'No Clearance Spec'}]
              </span>
              {team.officialRank && (
                <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/80 text-[10px] font-bold">
                  Rank #{team.officialRank}
                </span>
              )}
            </div>
          </div>

          {team.customPicklistRank && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-right">
              <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-bold">PREFERENCE RANK</span>
              <span className="text-lg font-black text-amber-400 font-mono">#{team.customPicklistRank}</span>
            </div>
          )}
        </div>

        {/* 5 KPI Metric Cards in 1 Row */}
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="p-2 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider truncate">MATCHES</div>
            <div className="text-base sm:text-xl font-black text-slate-200 mt-1">{matchCount}</div>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider truncate">AVG TOTAL</div>
            <div className="text-base sm:text-xl font-black text-amber-400 mt-1">{avgTotalFuel}</div>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider truncate">AVG AUTO</div>
            <div className="text-base sm:text-xl font-black text-blue-400 mt-1">{avgAutoFuel}</div>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider truncate">AUTO SUCCESS</div>
            <div className="text-base sm:text-xl font-black text-emerald-400 mt-1">{autoSuccessRate}%</div>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider truncate">RELIABLE</div>
            <div className="text-base sm:text-xl font-black text-purple-400 mt-1">{uptimeRate}%</div>
          </div>
        </div>
      </div>

      {/* B. MIDDLE SECTION: PIT CLAIMS vs OBSERVED TRENDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column — Pit Scout Specs & Claims */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-3.5">
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              PIT SPECS & CLAIMS (Team Profile)
            </h3>

            <ul className="space-y-2.5 text-xs text-slate-300 font-mono">
              <li className="flex items-start gap-1.5">
                <span className="text-slate-500">•</span>
                <span><strong className="text-slate-400 font-bold">Drivetrain:</strong> {pit?.drivetrain || '—'} {pit?.drivetrainOther && `(${pit.drivetrainOther})`}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-500">•</span>
                <span><strong className="text-slate-400 font-bold">Shooter:</strong> {pit?.shooter && pit.shooter.length > 0 ? pit.shooter.join(', ') : '—'} {pit?.shooterOther && `Other: (${pit.shooterOther})`}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-500">•</span>
                <span><strong className="text-slate-400 font-bold">Hopper Capacity:</strong> {pit?.hopperCapacity !== undefined ? `${pit.hopperCapacity} balls` : '—'}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-500">•</span>
                <span><strong className="text-slate-400 font-bold">Claimed Accuracy:</strong> {pit?.shootingAccuracy || '—'}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-500">•</span>
                <span>
                  <strong className="text-slate-400 font-bold">Auto Routines:</strong> {pit?.hasAutonomous === 'YES' ? `${pit.autoRoutinesCount || '1'} routines` : 'None'} {pit?.autoConsistency && `(${pit.autoConsistency})`}
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-slate-500">•</span>
                <span><strong className="text-slate-400 font-bold font-mono">Known Issues (Pit):</strong> {pit?.biggestIssues && pit.biggestIssues.length > 0 ? pit.biggestIssues.join(', ') : 'None'} {pit?.biggestIssueOther && `(${pit.biggestIssueOther})`}</span>
              </li>
            </ul>
          </div>

          {/* Robot Photo Preview */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">[ Robot Photo Preview / Thumbnail ]</span>
            {pit?.photos && pit.photos.length > 0 ? (
              <div 
                onClick={() => setSelectedPhoto(pit.photos![0].dataUrl)}
                className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video max-h-40 cursor-pointer group shrink-0"
              >
                <img 
                  src={pit.photos[0].dataUrl} 
                  alt="Robot thumbnail" 
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs gap-1 font-bold">
                  <Maximize2 className="w-4 h-4 text-slate-200" />
                  <span>View Larger</span>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl border border-dashed border-slate-800 bg-slate-950/60 text-center text-[11px] text-slate-500 font-mono">
                No photo uploaded in pit scouting questionnaire.
              </div>
            )}
          </div>

          {pit?.notes && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs mt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-1">Notes:</span>
              <p className="text-slate-300 italic">"{pit.notes}"</p>
            </div>
          )}
        </div>

        {/* Right Column — Real Match Averages (Verified Empirical Data) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
          <div className="space-y-3.5">
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <span>OBSERVED PERFORMANCE TRENDS</span>
            </h3>

            {matchCount > 0 ? (
              <ul className="space-y-3 text-xs text-slate-300 font-mono">
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-500">•</span>
                  <span>
                    <strong className="text-slate-400">Avg Teleop Fuel:</strong> <span className="text-emerald-400 font-bold">{avgTeleopFuel}</span> (Max: <span className="text-slate-400 font-bold">{maxTeleopFuel}</span>)
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-500">•</span>
                  <span>
                    <strong className="text-slate-400 font-bold">Avg Auto Fuel:</strong> <span className="text-blue-400 font-bold">{avgAutoFuel}</span> (Max: <span className="text-slate-400 font-bold">{maxAutoFuel}</span>)
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-500">•</span>
                  <span>
                    <strong className="text-slate-400 font-bold">Route Usage:</strong> <span className="text-amber-400 font-bold">{preferredRouteStr}</span>
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-slate-500">•</span>
                  <span>
                    <strong className="text-slate-400 font-bold">Defense:</strong> Played in <span className="text-purple-300 font-bold">{defensePercentage}%</span> of matches {playedDefenseCount > 0 && `(Effectiveness: ${avgDefenseEffectiveness})`}
                  </span>
                </li>
                <li className="flex flex-col gap-1.5 pt-1">
                  <span className="text-slate-400 font-bold font-mono uppercase text-[10px] tracking-wider">Issue Breakdown:</span>
                  <div className="grid grid-cols-2 gap-1.5 text-center text-[10px] font-bold">
                    <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-900 text-rose-300">
                      {issueDisabledCount} Disabled
                    </div>
                    <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-900 text-amber-300">
                      {issueMajorCount} Major
                    </div>
                    <div className="p-1.5 rounded-lg bg-yellow-950/40 border border-yellow-800/60 text-yellow-200">
                      {issueMinorCount} Minor
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-200">
                      {issueCleanCount} Clean
                    </div>
                  </div>
                </li>
              </ul>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 border border-slate-800 bg-slate-950 rounded-xl space-y-1">
                <p>No verified matches scouted for Team {teamNumber} yet.</p>
                <p className="text-[10px] text-slate-600">Scout a match to compare claims vs reality.</p>
              </div>
            )}
          </div>

          {matchCount > 0 && (
            <div className="mt-auto p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Real-time averages calculated from verified match sheets.</span>
            </div>
          )}
        </div>
      </div>

      {/* C. BOTTOM SECTION: MATCH HISTORY */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>MATCH HISTORY ({matchCount} Matches Scouted)</span>
          </h3>
          <button
            onClick={() => onNavigate('match-scout', teamNumber)}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
          >
            [+ ADD MATCH]
          </button>
        </div>

        {matchCount > 0 ? (
          <div className="space-y-3">
            {matches.map((m) => {
              const isAutoWorked = m.autoWorked === true || String(m.autoWorked) === 'true';
              const totalFuel = (m.autoFuelScored ?? m.autoHighScored ?? 0) + (m.teleopFuelScored ?? m.teleopHighScored ?? 0);
              
              // Issue status badge
              let statusBadge = (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  CLEAN
                </span>
              );
              if (m.robotIssues === 'DISABLED') {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-950 text-rose-300 border border-rose-600 animate-pulse">
                    DISABLED
                  </span>
                );
              } else if (m.robotIssues === 'MAJOR') {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-600">
                    MAJOR ISSUE
                  </span>
                );
              } else if (m.robotIssues === 'MINOR') {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-yellow-950/70 text-yellow-300 border border-yellow-800">
                    MINOR ISSUE
                  </span>
                );
              }

              // Defense status badge
              let defenseBadge = (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-950/60 text-slate-500 border border-slate-850">
                  Def: No
                </span>
              );
              if (m.playedDefense) {
                const effLabel = m.defenseEffectiveness === 'HIGH' ? 'High' : (m.defenseEffectiveness === 'LOW' ? 'Low' : 'Med');
                defenseBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                    Def: {effLabel}
                  </span>
                );
              }

              // Route badge
              const routeLabel = m.fieldRoute || 'NEITHER';

              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 space-y-2.5 text-xs text-slate-300 font-mono transition-all hover:border-slate-700"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-900 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        [M{m.matchNumber}]
                      </span>
                      {m.alliance && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${
                          m.alliance === 'red'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-900/60'
                            : 'bg-sky-950/80 text-sky-300 border-sky-900/60'
                        }`}>
                          {m.alliance}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {statusBadge}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      isAutoWorked 
                        ? 'bg-blue-950/60 text-blue-300 border-blue-900/60' 
                        : 'bg-rose-950/60 text-rose-300 border-rose-900/60'
                    }`}>
                      Auto: {isAutoWorked ? 'Yes' : 'No'}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-[10px] text-slate-300">
                      Auto: <strong className="text-blue-400 font-bold">{m.autoFuelScored ?? m.autoHighScored ?? 0}</strong> | Teleop: <strong className="text-emerald-400 font-bold">{m.teleopFuelScored ?? m.teleopHighScored ?? 0}</strong> (Total: <strong className="text-amber-400 font-black">{totalFuel}</strong>)
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-[10px] text-slate-400">
                      Route: <strong className="text-amber-400">{routeLabel}</strong>
                    </span>

                    {defenseBadge}
                  </div>

                  {/* Surface notes text directly! No clicking required to read */}
                  {(m.quickNote || m.notes) && (
                    <div className="p-2 rounded bg-slate-900/50 text-[11px] text-slate-300 leading-relaxed border-l-2 border-slate-700 italic">
                      Notes: "{m.quickNote || m.notes}"
                    </div>
                  )}

                  {m.robotIssues && m.robotIssues !== 'NONE' && m.whatHappenedNote && (
                    <div className="p-2 rounded bg-rose-950/20 text-[11px] text-rose-300 leading-relaxed border-l-2 border-rose-800">
                      Issue Detail: "{m.whatHappenedNote}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 border border-slate-800 bg-slate-950 rounded-xl">
            No match observations recorded for Team {teamNumber} yet.
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

      {/* Match Schedule Picker Modal */}
      {showMatchPicker && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 backdrop-blur-md font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Select Match for Team {teamNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMatchPicker(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 shrink-0">
              Pick a scheduled match to prefill and scout Team {teamNumber}:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {scheduledMatches.map((m) => {
                const isRed = m.redTeams.includes(teamNumber);
                const allianceColor = isRed ? 'text-rose-400' : 'text-sky-400';
                const badgeBg = isRed ? 'bg-rose-950/70 border-rose-900/80 text-rose-300' : 'bg-sky-950/70 border-sky-900/80 text-sky-300';
                const partnerTeams = (isRed ? m.redTeams : m.blueTeams).filter((t) => t !== teamNumber);
                const opposingTeams = isRed ? m.blueTeams : m.redTeams;

                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setShowMatchPicker(false);
                      onNavigate('match-scout', teamNumber, m.matchNumber);
                    }}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase">
                          {m.compLevel === 'qm' ? `Qual ${m.matchNumber}` : `Match ${m.matchNumber}`}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeBg}`}>
                          {isRed ? 'Red Alliance' : 'Blue Alliance'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        <span>Partners: {partnerTeams.length ? partnerTeams.join(', ') : 'None'}</span>
                        <span className="mx-1.5">•</span>
                        <span>Opponents: {opposingTeams.join(', ')}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowMatchPicker(false);
                  onNavigate('match-scout', teamNumber);
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs uppercase cursor-pointer transition-colors border border-slate-750 text-center"
              >
                + Custom Match Number
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
