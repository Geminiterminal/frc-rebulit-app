import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord, EventScheduleMatch } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  Gamepad2, 
  Edit3
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

  // Scoring metrics
  const autoFuelScores = matches.map((m) => m.autoFuelScored || m.autoHighScored || 0);
  const teleopFuelScores = matches.map((m) => m.teleopFuelScored || m.teleopHighScored || 0);

  const getMetrics = (scores: number[]) => {
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
    const high = scores.length > 0 ? Math.max(...scores) : '—';
    const low = scores.length > 0 ? Math.min(...scores) : '—';
    return { avg, high, low };
  };

  const autoMetrics = getMetrics(autoFuelScores);
  const teleopMetrics = getMetrics(teleopFuelScores);

  const avgAutoFuel = autoMetrics.avg;
  const avgTeleopFuel = teleopMetrics.avg;
  const hopperCapacity = pit?.hopperCapacity !== undefined ? pit.hopperCapacity : '—';
  const shootingRange = pit?.canShootAnywhere || (matches.some((m) => m.canShootAnywhere) ? 'Anywhere' : '—');
  const shootingAccuracy = pit?.shootingAccuracy || (matches.find((m) => m.shooterAccuracy)?.shooterAccuracy || '—');

  // Reliability metrics
  const autoWorkedCount = matches.filter((m) => m.autoWorked).length;
  const noIssueCount = matches.filter((m) => m.robotIssues === 'NONE').length;
  const minorCount = matches.filter((m) => m.robotIssues === 'MINOR').length;
  const majorCount = matches.filter((m) => m.robotIssues === 'MAJOR').length;
  const disabledCount = matches.filter((m) => m.robotIssues === 'DISABLED').length;

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
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs cursor-pointer"
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
          <p className="text-xs text-slate-400 mt-0.5">
            {matchCount} MATCH{matchCount === 1 ? '' : 'ES'} SCOUTED
          </p>
        </div>
        <div className="text-right flex flex-col gap-0.5 text-[11px] font-mono">
          <div><span className="text-slate-500">Event Rank:</span> <strong className="text-amber-400">{team.officialRank ? `#${team.officialRank}` : '—'}</strong></div>
          <div><span className="text-slate-500">FRC Rank:</span> <strong className="text-amber-400">{team.officialRank ? `#${team.officialRank}` : '—'}</strong></div>
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
            SCORING
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {scoringOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {scoringOpen && (
          <div className="p-4 space-y-4 text-xs font-mono">
            <div className="space-y-2">
              <div className="font-bold text-slate-400">TELEOP</div>
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

            <div className="space-y-2 pt-2 border-t border-slate-800/50">
              <div className="font-bold text-slate-400">AUTON</div>
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

            <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between text-xs font-bold text-slate-300">
              <div>RANGE: <span className="text-amber-400">{shootingRange}</span></div>
              <div>ACCURACY: <span className="text-emerald-400">{shootingAccuracy}</span></div>
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
            RELIABILITY
          </span>
          <button type="button" className="text-slate-400 hover:text-white">
            {reliabilityOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {reliabilityOpen && (
          <div className="p-4 space-y-3 text-xs font-mono">
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
              <div>BIGGEST ISSUE: <span className="text-rose-400 font-normal">{biggestIssue}</span></div>
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
              <span className="text-slate-400">Average Auto Fuel</span>
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
              <span className="text-slate-400">Shooting Range</span>
              <span className="font-bold text-slate-100">{shootingRange}</span>
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
    </div>
  );
};
