import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord, EventScheduleMatch, RobotIssuesType } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  Gamepad2, 
  Edit3,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Flame
} from 'lucide-react';

interface TeamProfileViewProps {
  teamNumber: number;
  onNavigate: (view: string, teamNumber?: number, extraParam?: any, allianceParam?: 'red' | 'blue') => void;
  onBack: () => void;
}

export const TeamProfileView: React.FC<TeamProfileViewProps> = ({
  teamNumber,
  onNavigate,
  onBack,
}) => {
  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [scheduledMatches, setScheduledMatches] = useState<EventScheduleMatch[]>([]);

  // Collapsible section states
  const [scoringOpen, setScoringOpen] = useState<boolean>(true);
  const [reliabilityOpen, setReliabilityOpen] = useState<boolean>(true);
  const [autoOpen, setAutoOpen] = useState<boolean>(true);
  const [robotOpen, setRobotOpen] = useState<boolean>(true);
  const [assessmentOpen, setAssessmentOpen] = useState<boolean>(true);
  const [notesOpen, setNotesOpen] = useState<boolean>(true);
  const [badMatchesOpen, setBadMatchesOpen] = useState<boolean>(true);

  useEffect(() => {
    loadTeamData();
  }, [teamNumber]);

  const loadTeamData = async () => {
    const profile = await scoutingDB.getTeam(teamNumber);
    if (profile) {
      setTeam(profile);
    } else {
      setTeam(null);
    }

    const teamMatches = await scoutingDB.getMatchesForTeam(teamNumber);
    setMatches(teamMatches);

    const sched = await scoutingDB.getScheduleForTeam(teamNumber);
    setScheduledMatches(sched);
  };

  if (!team) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-slate-400 font-mono">
        No scouting data found for team {teamNumber}.
      </div>
    );
  }

  const pit = team.pit;
  const matchCount = matches.length;

  // Helper to parse numeric score safely
  const parseScore = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
      const p = parseFloat(val);
      return isNaN(p) ? 0 : p;
    }
    return 0;
  };

  // Scoring metrics using valid match data
  const autoScores = matches.map((m) => parseScore(m.autoFuelScored ?? m.autoHighScored ?? 0));
  const teleopScores = matches.map((m) => parseScore(m.teleopFuelScored ?? m.teleopHighScored ?? 0));
  const totalScores = matches.map((m) => parseScore(m.autoFuelScored ?? m.autoHighScored ?? 0) + parseScore(m.teleopFuelScored ?? m.teleopHighScored ?? 0));

  const getMetrics = (scores: number[]) => {
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
    const high = scores.length > 0 ? Math.max(...scores) : '—';
    const low = scores.length > 0 ? Math.min(...scores) : '—';
    return { avg, high, low };
  };

  const autoMetrics = getMetrics(autoScores);
  const teleopMetrics = getMetrics(teleopScores);
  const totalMetrics = getMetrics(totalScores);

  const avgAutoFuel = autoMetrics.avg;
  const avgTeleopFuel = teleopMetrics.avg;
  const avgTotalScore = totalMetrics.avg;
  const hopperCapacity = pit?.hopperCapacity !== undefined ? pit.hopperCapacity : '—';

  // Helper to determine the observed value across matches (most frequent, latest on tie)
  const getObservedMatchValue = (values: (string | undefined)[]) => {
    const valid = values.filter((v): v is string => Boolean(v && v.trim() && v !== '—'));
    if (valid.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const v of valid) {
      counts[v] = (counts[v] || 0) + 1;
    }
    const sorted = [...valid].reverse().sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    return sorted[0] || null;
  };

  const matchRanges = matches.map((m) => 
    m.shootingRange || (typeof m.canShootAnywhere === 'string' ? m.canShootAnywhere : (m.canShootAnywhere ? 'ANYWHERE' : undefined))
  );
  const matchAccuracies = matches.map((m) => 
    m.shootingAccuracy || (typeof m.shooterAccuracy === 'string' ? m.shooterAccuracy : undefined)
  );

  const observedRange = getObservedMatchValue(matchRanges);
  const observedAccuracy = getObservedMatchValue(matchAccuracies);

  // Match scout data takes precedence in match/scoring analysis, falling back to pit scout data, or '—'
  const shootingRange = observedRange || pit?.canShootAnywhere || '—';
  const shootingAccuracy = observedAccuracy || pit?.shootingAccuracy || '—';

  // Reliability metrics
  const autoWorkedCount = matches.filter((m) => m.autoWorked).length;
  const noIssueCount = matches.filter((m) => m.robotIssues === 'NONE').length;
  const minorCount = matches.filter((m) => m.robotIssues === 'MINOR').length;
  const majorCount = matches.filter((m) => m.robotIssues === 'MAJOR').length;
  const disabledCount = matches.filter((m) => m.robotIssues === 'DISABLED').length;

  // Compact list of issues gathered from notes of every Match Scout submission
  interface MatchIssueItem {
    matchNumber: number;
    issueType: RobotIssuesType;
    note: string;
    alliance?: 'red' | 'blue';
  }

  const matchIssuesList: MatchIssueItem[] = matches
    .filter((m) => {
      const hasRobotIssue = m.robotIssues && m.robotIssues !== 'NONE';
      const hasWhatHappened = Boolean(m.whatHappenedNote && m.whatHappenedNote.trim());
      const hasQuickNote = Boolean(m.quickNote && m.quickNote.trim());
      const hasGeneralNotes = Boolean(m.notes && m.notes.trim());
      return hasRobotIssue || hasWhatHappened || hasQuickNote || hasGeneralNotes;
    })
    .map((m) => {
      const parts = [
        m.whatHappenedNote?.trim(),
        m.quickNote?.trim(),
        (m.notes && m.notes !== m.quickNote) ? m.notes.trim() : null
      ].filter(Boolean);
      const note = parts.join(' | ') || (m.robotIssues && m.robotIssues !== 'NONE' ? `${m.robotIssues} issue reported` : 'Note logged');
      return {
        matchNumber: m.matchNumber,
        issueType: m.robotIssues || 'NONE',
        note,
        alliance: m.alliance,
      };
    })
    .sort((a, b) => b.matchNumber - a.matchNumber);

  // Problematic / Bad Matches logic based on reliability problems, not just low scores
  interface BadMatchItem {
    match: MatchScoutingRecord;
    reasons: string[];
    severity: 'CRITICAL' | 'MAJOR' | 'MODERATE';
    totalScore: number;
    autoScore: number;
    teleopScore: number;
  }

  const badMatches: BadMatchItem[] = matches
    .map((m) => {
      const reasons: string[] = [];
      let severity: 'CRITICAL' | 'MAJOR' | 'MODERATE' = 'MODERATE';

      // 1. Robot issues
      if (m.robotIssues === 'DISABLED') {
        reasons.push('Robot Disabled / Died');
        severity = 'CRITICAL';
      } else if (m.robotIssues === 'MAJOR') {
        reasons.push('Major Mechanical/Electrical Issue');
        severity = 'MAJOR';
      } else if (m.robotIssues === 'MINOR') {
        reasons.push('Minor Robot Issue');
      }

      // 2. Auto worked failure
      if (m.autoWorked === false) {
        reasons.push('Autonomous Routine Failed');
      }

      // 3. Issue keywords in notes indicating reliability breakdown
      const textToScan = `${m.whatHappenedNote || ''} ${m.quickNote || ''} ${m.notes || ''}`.toLowerCase();
      if (/disconnect|lost comms|lost radio|brownout|no comms/.test(textToScan)) {
        reasons.push('Connection / Comms Failure');
        if ((severity as string) !== 'CRITICAL') severity = 'MAJOR';
      }
      if (/smoke|chain snapped|tipped|flip|broke|broken|motor burnt|dead battery/.test(textToScan)) {
        reasons.push('Hardware / Mechanical Breakdown');
        if ((severity as string) !== 'CRITICAL') severity = 'MAJOR';
      }
      if (/stuck|jammed|jam|intake issue|can't shoot|could not shoot/.test(textToScan)) {
        reasons.push('Mechanism Jammed / Inoperative');
      }

      // 4. Low ratings
      if (m.rateDriving && m.rateDriving <= 2) {
        reasons.push(`Low Drive Rating (${m.rateDriving}/5)`);
      }
      if (m.rateAuto && m.rateAuto === 1) {
        reasons.push('Auto Rated 1/5');
      }

      const autoScore = parseScore(m.autoFuelScored ?? m.autoHighScored ?? 0);
      const teleopScore = parseScore(m.teleopFuelScored ?? m.teleopHighScored ?? 0);
      const totalScore = autoScore + teleopScore;

      // Only flag based on reliability problems, not just low scores!
      if (reasons.length === 0) return null;

      return {
        match: m,
        reasons: Array.from(new Set(reasons)),
        severity,
        totalScore,
        autoScore,
        teleopScore,
      };
    })
    .filter((item): item is BadMatchItem => item !== null)
    .sort((a, b) => {
      const rank = { CRITICAL: 3, MAJOR: 2, MODERATE: 1 };
      if (rank[b.severity] !== rank[a.severity]) {
        return rank[b.severity] - rank[a.severity];
      }
      return b.match.matchNumber - a.match.matchNumber;
    });

  // Assessment averages
  const calcAvgRating = (vals: (number | undefined)[]) => {
    const valid = vals.filter((v): v is number => typeof v === 'number' && v > 0);
    if (valid.length === 0) return '—';
    const sum = valid.reduce((a, b) => a + b, 0);
    return (sum / valid.length).toFixed(1);
  };

  const autoRatings = matches.map((m) => m.rateAuto);
  const drivingRatings = matches.map((m) => m.rateDriving);
  const shootingRatings = matches.map((m) => m.rateShooting);
  const intakeRatings = matches.map((m) => m.rateIntake);
  const hopperRatings = matches.map((m) => m.rateHopper);

  const rankStr = team.customPicklistRank ? `RANK #${team.customPicklistRank}` : team.officialRank ? `RANK #${team.officialRank}` : 'RANK #—';

  const latestNote = [...matches].reverse().find((m) => m.quickNote || m.notes || m.whatHappenedNote);
  const noteText = latestNote ? (latestNote.quickNote || latestNote.notes || latestNote.whatHappenedNote) : (pit?.notes || 'No notes recorded.');
  const biggestIssue = pit?.biggestIssues && pit.biggestIssues.length > 0 ? pit.biggestIssues.join(', ') : '—';

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-32 flex flex-col gap-4 font-mono text-slate-100">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-bold cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← BACK</span>
        </button>

        <span className="text-xs font-bold text-slate-300 tracking-widest uppercase">
          TEAM PROFILE
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('pit-scout', teamNumber)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs cursor-pointer"
            title="Edit Pit Scout"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('match-scout', teamNumber)}
            className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs cursor-pointer"
            title="Add Match Scout"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TEAM BANNER */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between shadow">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            TEAM {team.teamNumber}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 text-xs">
            <span className="text-slate-400">
              {matchCount} MATCH{matchCount === 1 ? '' : 'ES'} SCOUTED
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-bold">
              AVG SCORE: {avgTotalScore}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col gap-0.5 text-[11px] font-mono">
          <div><span className="text-slate-500">Event Rank:</span> <strong className="text-amber-400">{team.officialRank ? `#${team.officialRank}` : '—'}</strong></div>
          <div><span className="text-slate-500">FRC Rank:</span> <strong className="text-amber-400">{team.stateRank ? `#${team.stateRank}` : '—'}</strong></div>
          <div><span className="text-slate-500">Our Rank:</span> <strong className="text-emerald-400">{team.customPicklistRank ? `#${team.customPicklistRank}` : '—'}</strong></div>
        </div>
      </div>

      {/* 1. SCORING */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setScoringOpen(!scoringOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            SCORING SUMMARY & AVERAGES
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {scoringOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {scoringOpen && (
          <div className="p-4 space-y-4 text-xs font-mono">
            {/* OVERALL AVERAGE SCORE */}
            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                  Average Score (Overall Match Total)
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {matchCount} match{matchCount === 1 ? '' : 'es'} calculated
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">AVG SCORE</div>
                  <div className="text-lg sm:text-xl font-black text-amber-300 mt-0.5">{totalMetrics.avg}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">HIGH SCORE</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">{totalMetrics.high}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">LOW SCORE</div>
                  <div className="text-lg sm:text-xl font-black text-sky-400 mt-0.5">{totalMetrics.low}</div>
                </div>
              </div>
            </div>

            {/* TELEOP SCORED */}
            <div className="space-y-2">
              <div className="font-bold text-slate-400">TELEOP SCORED</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">AVG</div>
                  <div className="text-base font-black text-purple-400 mt-0.5">{teleopMetrics.avg}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">HIGH</div>
                  <div className="text-base font-black text-emerald-400 mt-0.5">{teleopMetrics.high}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">LOW</div>
                  <div className="text-base font-black text-sky-400 mt-0.5">{teleopMetrics.low}</div>
                </div>
              </div>
            </div>

            {/* AUTO SCORED */}
            <div className="space-y-2 pt-2 border-t border-slate-800/50">
              <div className="font-bold text-slate-400">AUTO SCORED</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">AVG</div>
                  <div className="text-base font-black text-blue-400 mt-0.5">{autoMetrics.avg}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">HIGH</div>
                  <div className="text-base font-black text-emerald-400 mt-0.5">{autoMetrics.high}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">LOW</div>
                  <div className="text-base font-black text-sky-400 mt-0.5">{autoMetrics.low}</div>
                </div>
              </div>
            </div>

            {/* SHOOTING CAPABILITY LABELS */}
            <div className="pt-2 border-t border-slate-800/50 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-300">
              <div>
                <span>CAN SHOOT FROM…: </span>
                <span className="text-amber-400">{shootingRange}</span>
                {observedRange && pit?.canShootAnywhere && observedRange !== pit.canShootAnywhere && (
                  <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Pit: {pit.canShootAnywhere})</span>
                )}
              </div>
              <div>
                <span>SHOOTING ACCURACY OF THE ROBOT: </span>
                <span className="text-emerald-400">{shootingAccuracy}</span>
                {observedAccuracy && pit?.shootingAccuracy && observedAccuracy !== pit.shootingAccuracy && (
                  <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Pit: {pit.shootingAccuracy})</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. RELIABILITY */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setReliabilityOpen(!reliabilityOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            RELIABILITY & ISSUE LOG
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {reliabilityOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {reliabilityOpen && (
          <div className="p-4 space-y-3.5 text-xs font-mono">
            {/* Reported Pit Reliability */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold uppercase">Reported Reliability:</span>
              <span className={`text-xs sm:text-sm font-black uppercase ${
                pit?.reliability === 'UNRELIABLE' ? 'text-rose-400' :
                pit?.reliability === 'SOMEWHAT RELIABLE' ? 'text-amber-400' :
                pit?.reliability === 'MOSTLY RELIABLE' ? 'text-blue-400' :
                pit?.reliability === 'VERY RELIABLE' ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {pit?.reliability || '—'}
              </span>
            </div>

            {/* Match Issues Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-500 text-[10px] uppercase font-bold">AUTO WORKED</div>
                <div className="text-base sm:text-lg font-black text-blue-400 mt-0.5">
                  {matchCount > 0 ? `${autoWorkedCount} / ${matchCount}` : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-500 text-[10px] uppercase font-bold">NO ISSUE</div>
                <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                  {matchCount > 0 ? `${noIssueCount} / ${matchCount}` : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-500 text-[10px] uppercase font-bold">MINOR</div>
                <div className="text-base sm:text-lg font-black text-yellow-400 mt-0.5">
                  {matchCount > 0 ? minorCount : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850">
                <div className="text-slate-500 text-[10px] uppercase font-bold">MAJOR</div>
                <div className="text-base sm:text-lg font-black text-rose-400 mt-0.5">
                  {matchCount > 0 ? majorCount : '—'}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-slate-300 font-bold">
              <div>DISABLED: <span className="text-rose-400">{matchCount > 0 ? disabledCount : '—'}</span></div>
              <div>PIT BIGGEST ISSUE: <span className="text-rose-400 font-normal">{biggestIssue}</span></div>
            </div>

            {/* COMPACT LIST OF ISSUES GATHERED FROM NOTES OF EVERY MATCH SCOUT SUBMISSION */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>RELIABILITY — BIGGEST ISSUES (MATCH NOTES):</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">{matchIssuesList.length} notes found</span>
              </div>

              {matchIssuesList.length > 0 ? (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {matchIssuesList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-850 flex items-start gap-2 text-[11px] leading-relaxed"
                    >
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 font-bold font-mono">
                          Qual {item.matchNumber}
                        </span>
                        {item.issueType && item.issueType !== 'NONE' && (
                          <span className={`px-1.5 py-0.5 rounded font-black font-mono text-[9px] uppercase border ${
                            item.issueType === 'DISABLED' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                            item.issueType === 'MAJOR' ? 'bg-rose-950/70 text-rose-300 border-rose-900' :
                            'bg-yellow-950 text-yellow-300 border-yellow-800'
                          }`}>
                            {item.issueType}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-300 break-words flex-1 font-mono">
                        "{item.note}"
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-850 text-[11px] text-slate-400 font-mono italic text-center">
                  No issues or problem notes recorded across match scout submissions.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. AUTONOMOUS */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setAutoOpen(!autoOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            AUTONOMOUS
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {autoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {autoOpen && (
          <div className="p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Average Auto Scored</span>
              <span className="font-bold text-slate-100">{matchCount > 0 ? avgAutoFuel : '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Auto Consistency</span>
              <span className="font-bold text-slate-100">{pit?.autoConsistency || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">Has Autonomous</span>
              <span className="font-bold text-slate-100">{pit?.hasAutonomous || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. ROBOT */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setRobotOpen(!robotOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            ROBOT
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {robotOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {robotOpen && (
          <div className="p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Drivetrain</span>
              <span className="font-bold text-slate-100">
                {pit?.drivetrain ? (pit.drivetrain === 'OTHER' && pit.drivetrainOther ? pit.drivetrainOther : pit.drivetrain) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Shooter</span>
              <span className="font-bold text-slate-100">
                {pit?.shooter && pit.shooter.length > 0 
                  ? pit.shooter.map((s) => (s === 'OTHER' && pit.shooterOther ? pit.shooterOther : s)).join(', ') 
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Can Shoot From…</span>
              <span className="font-bold text-slate-100">
                {shootingRange}
                {observedRange && pit?.canShootAnywhere && observedRange !== pit.canShootAnywhere && (
                  <span className="text-xs text-slate-400 font-normal ml-1.5">(Pit: {pit.canShootAnywhere})</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Shooting Accuracy of the Robot</span>
              <span className="font-bold text-slate-100">
                {shootingAccuracy}
                {observedAccuracy && pit?.shootingAccuracy && observedAccuracy !== pit.shootingAccuracy && (
                  <span className="text-xs text-slate-400 font-normal ml-1.5">(Pit: {pit.shootingAccuracy})</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">Hopper Capacity</span>
              <span className="font-bold text-slate-100">{hopperCapacity}</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. SCOUT ASSESSMENT */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setAssessmentOpen(!assessmentOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            SCOUT ASSESSMENT
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {assessmentOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {assessmentOpen && (
          <div className="p-4 space-y-2 text-xs font-mono">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Auto</span>
                <span className="font-bold text-amber-400">{calcAvgRating(autoRatings)} / 5</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Driving</span>
                <span className="font-bold text-amber-400">{calcAvgRating(drivingRatings)} / 5</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Shooting</span>
                <span className="font-bold text-amber-400">{calcAvgRating(shootingRatings)} / 5</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Intake</span>
                <span className="font-bold text-amber-400">{calcAvgRating(intakeRatings)} / 5</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1 pt-1">
              <span className="text-slate-400">Hopper</span>
              <span className="font-bold text-amber-400">{calcAvgRating(hopperRatings)} / 5</span>
            </div>
          </div>
        )}
      </div>

      {/* 6. NOTES */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setNotesOpen(!notesOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            NOTES
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {notesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {notesOpen && (
          <div className="p-4 space-y-3 text-xs font-mono">
            <div className="text-slate-300 font-bold">
              Biggest Issue: <span className="text-rose-400 font-normal">{biggestIssue}</span>
            </div>
            <p className="text-slate-300 leading-relaxed italic">
              "{noteText}"
            </p>
          </div>
        )}
      </div>

      {/* 7. BAD MATCHES (HIGHLIGHTING PROBLEMATIC MATCHES BASED ON RELIABILITY PROBLEMS) */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow">
        <div 
          onClick={() => setBadMatchesOpen(!badMatchesOpen)}
          className="p-3.5 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-850"
        >
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              BAD MATCHES & RELIABILITY WARNINGS
            </span>
            {badMatches.length > 0 && (
              <span className="px-2 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-black">
                {badMatches.length} flagged
              </span>
            )}
          </div>
          <button type="button" className="text-slate-400 hover:text-white">
            {badMatchesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {badMatchesOpen && (
          <div className="p-4 space-y-3 text-xs font-mono">
            {badMatches.length > 0 ? (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400">
                  Matches flagged for reliability issues, robot breakdown, auto failures, or driver problems:
                </div>

                {badMatches.map(({ match: m, reasons, severity, totalScore, autoScore, teleopScore }) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      severity === 'CRITICAL'
                        ? 'bg-rose-950/20 border-rose-700/80 shadow-sm'
                        : severity === 'MAJOR'
                        ? 'bg-amber-950/20 border-amber-600/70'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">
                          Qual {m.matchNumber}
                        </span>
                        {m.alliance && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            m.alliance === 'red'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : 'bg-sky-950 text-sky-300 border-sky-800'
                          }`}>
                            {m.alliance}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                          severity === 'CRITICAL'
                            ? 'bg-rose-900 text-rose-100 border-rose-500 animate-pulse'
                            : severity === 'MAJOR'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-slate-850 text-slate-300 border-slate-700'
                        }`}>
                          {severity}
                        </span>
                      </div>

                      {/* Score in this problematic match */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400">Score:</span>
                        <strong className="text-white font-mono">{totalScore} PTS</strong>
                        <span className="text-[10px] text-slate-500">
                          (Auto: {autoScore} / Teleop: {teleopScore})
                        </span>
                      </div>
                    </div>

                    {/* Reliability reasons */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {reasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/80 text-rose-200 text-[10px] font-bold"
                        >
                          ⚠️ {r}
                        </span>
                      ))}
                    </div>

                    {/* Scout Notes / What happened */}
                    {(m.whatHappenedNote || m.quickNote || m.notes) && (
                      <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-850 text-[11px] text-slate-300 italic">
                        "{m.whatHappenedNote || m.quickNote || m.notes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/60 flex items-center gap-3 text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-xs uppercase">No Problematic Matches Flagged</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Zero breakdowns, disconnections, or reliability failures logged across scouted matches.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
