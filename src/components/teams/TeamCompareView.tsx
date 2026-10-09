import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord, RobotIssuesType } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { ArrowLeft, Users, Plus, X, ChevronDown, ChevronUp, Scale, Trash2, Award } from 'lucide-react';

interface TeamCompareViewProps {
  initialSelectedTeams?: number[];
  onNavigate: (view: string, teamNumber?: number, extraParam?: any) => void;
  onBack: () => void;
}

export const TeamCompareView: React.FC<TeamCompareViewProps> = ({
  initialSelectedTeams = [],
  onNavigate,
  onBack,
}) => {
  const [allTeams, setAllTeams] = useState<TeamProfile[]>([]);
  const [allMatches, setAllMatches] = useState<MatchScoutingRecord[]>([]);
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>(
    initialSelectedTeams.length > 0 ? initialSelectedTeams.slice(0, 5) : []
  );
  const [showExtendedDetails, setShowExtendedDetails] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialSelectedTeams && initialSelectedTeams.length > 0) {
      setSelectedTeamNums(initialSelectedTeams.slice(0, 5));
    }
  }, [initialSelectedTeams]);

  const loadData = async () => {
    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    setAllTeams(teams);
    setAllMatches(matches);

    if (selectedTeamNums.length === 0 && teams.length > 0) {
      // Default to top 2-3 teams
      setSelectedTeamNums(teams.slice(0, 3).map((t) => t.teamNumber));
    }
  };

  const handleQuickAdd = (num: number) => {
    if (!selectedTeamNums.includes(num)) {
      if (selectedTeamNums.length >= 5) {
        setSelectedTeamNums([...selectedTeamNums.slice(1), num]);
      } else {
        setSelectedTeamNums([...selectedTeamNums, num]);
      }
    }
  };

  const handleRemoveTeam = (teamNum: number) => {
    setSelectedTeamNums(selectedTeamNums.filter((n) => n !== teamNum));
  };

  const handleClearAll = () => {
    setSelectedTeamNums([]);
  };

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

  const getTeamStats = (teamNum: number) => {
    const team = allTeams.find((t) => t.teamNumber === teamNum);
    const matches = allMatches.filter((m) => m.teamNumber === teamNum);
    const count = matches.length;

    // Auto & Teleop Scoring
    const autoScores = matches.map((m) => m.autoFuelScored ?? m.autoHighScored ?? 0);
    const teleopScores = matches.map((m) => m.teleopFuelScored ?? m.teleopHighScored ?? 0);

    const avgAutoFuelNum = count > 0 ? autoScores.reduce((sum, v) => sum + v, 0) / count : null;
    const avgTeleopFuelNum = count > 0 ? teleopScores.reduce((sum, v) => sum + v, 0) / count : null;
    const avgTotalScoreNum =
      avgAutoFuelNum !== null && avgTeleopFuelNum !== null
        ? avgAutoFuelNum + avgTeleopFuelNum
        : null;

    const totalScore = avgTotalScoreNum !== null ? avgTotalScoreNum.toFixed(1) : '—';
    const autoScore = avgAutoFuelNum !== null ? avgAutoFuelNum.toFixed(1) : '—';
    const teleopScore = avgTeleopFuelNum !== null ? avgTeleopFuelNum.toFixed(1) : '—';

    // Pit Data
    const pit = team?.pit;
    const hopperCapacityNum =
      typeof pit?.hopperCapacity === 'number' && !isNaN(pit.hopperCapacity)
        ? pit.hopperCapacity
        : null;
    const hopperCapacity = hopperCapacityNum !== null ? `${hopperCapacityNum}` : '—';

    // Shooting Accuracy: Match Scout takes precedence, falling back to Pit Scout
    const matchAccuracies = matches.map(
      (m) => m.shootingAccuracy || (typeof m.shooterAccuracy === 'string' ? m.shooterAccuracy : undefined)
    );
    const observedAccuracy = getObservedMatchValue(matchAccuracies);
    const shootingAccuracy = observedAccuracy || pit?.shootingAccuracy || '—';

    // Shooting Range: Match Scout takes precedence, falling back to Pit Scout
    const matchRanges = matches.map(
      (m) =>
        m.shootingRange ||
        (typeof m.canShootAnywhere === 'string'
          ? m.canShootAnywhere
          : m.canShootAnywhere
          ? 'ANYWHERE'
          : undefined)
    );
    const observedRange = getObservedMatchValue(matchRanges);
    const shootingRange =
      observedRange ||
      (typeof pit?.canShootAnywhere === 'string'
        ? pit.canShootAnywhere
        : pit?.canShootAnywhere
        ? 'ANYWHERE'
        : undefined) ||
      '—';

    // Shooter Type: Pit Scout
    const shooterType =
      pit?.shooter && pit.shooter.length > 0
        ? pit.shooter.join(', ')
        : pit?.shooterOther || '—';

    // Secondary / Extended Metrics
    const autoWorkedCount = matches.filter((m) => m.autoWorked !== false).length;
    const autoSuccessStr = count > 0 ? `${autoWorkedCount}/${count}` : '0/0';

    const majorIssuesCount = matches.filter(
      (m) => m.robotIssues === 'MAJOR' || m.robotIssues === 'DISABLED'
    ).length;
    const minorIssuesCount = matches.filter((m) => m.robotIssues === 'MINOR').length;

    let reliabilityLabel = '—';
    if (count > 0) {
      if (majorIssuesCount >= 2) {
        reliabilityLabel = 'LOW';
      } else if (majorIssuesCount === 1 || minorIssuesCount >= 2) {
        reliabilityLabel = 'MED';
      } else {
        reliabilityLabel = 'HIGH';
      }
    }

    const defenseMatches = matches.filter((m) => m.playedDefense);
    let defenseLabel = 'NONE';
    if (defenseMatches.length > 0) {
      const highDef = defenseMatches.filter((m) => m.defenseEffectiveness === 'HIGH').length;
      const medDef = defenseMatches.filter((m) => m.defenseEffectiveness === 'MEDIUM').length;
      if (highDef > 0) defenseLabel = 'HIGH';
      else if (medDef > 0) defenseLabel = 'MED';
      else defenseLabel = 'LOW';
    }

    const drivetrain = pit?.drivetrain || '—';

    return {
      team,
      teamNum,
      // The 7 primary metrics matching the matrix in the image:
      totalScore,
      totalScoreNum: avgTotalScoreNum,
      autoScore,
      autoScoreNum: avgAutoFuelNum,
      teleopScore,
      teleopScoreNum: avgTeleopFuelNum,
      hopperCapacity,
      hopperCapacityNum,
      shootingAccuracy,
      shootingRange,
      shooterType,
      // Extended details:
      matchesScouted: count,
      officialRank: team?.officialRank ? `Rank ${team.officialRank}` : '—',
      stateRank: team?.stateRank ? `Rank ${team.stateRank}` : '—',
      prefRank: team?.customPicklistRank ? `#${team.customPicklistRank}` : '—',
      isUnavailable: !!team?.isUnavailable,
      autoSuccessStr,
      reliabilityLabel,
      defenseLabel,
      drivetrain,
    };
  };

  const comparedStats = selectedTeamNums.map(getTeamStats);

  // Determine top values for visual callout
  const maxTotalScore = Math.max(
    ...comparedStats.map((s) => s.totalScoreNum ?? -1)
  );
  const maxAutoScore = Math.max(
    ...comparedStats.map((s) => s.autoScoreNum ?? -1)
  );
  const maxTeleopScore = Math.max(
    ...comparedStats.map((s) => s.teleopScoreNum ?? -1)
  );
  const maxHopperCapacity = Math.max(
    ...comparedStats.map((s) => s.hopperCapacityNum ?? -1)
  );

  // Available teams not yet in comparison
  const availableTeamsToAdd = allTeams
    .filter((t) => !selectedTeamNums.includes(t.teamNumber))
    .sort((a, b) => {
      const rankA = a.officialRank ?? 9999;
      const rankB = b.officialRank ?? 9999;
      return rankA - rankB;
    });

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 pb-32 flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-colors cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
                <span>Team Comparison</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                  {comparedStats.length} {comparedStats.length === 1 ? 'team' : 'teams'}
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Add Team Controls */}
        <div className="flex items-center gap-2">
          {availableTeamsToAdd.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handleQuickAdd(val);
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-700 cursor-pointer"
            >
              <option value="">+ Select Team...</option>
              {availableTeamsToAdd.slice(0, 30).map((t) => (
                <option key={t.teamNumber} value={t.teamNumber}>
                  #{t.teamNumber} {t.teamName}
                </option>
              ))}
            </select>
          )}

          {selectedTeamNums.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
              title="Clear all teams"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {comparedStats.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-slate-800/80 text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-slate-300 font-mono font-bold text-sm">No teams selected for comparison.</p>
          <p className="text-slate-500 text-xs max-w-sm">
            Select teams from the Ranking picklist, Team List, or add team numbers above to compare their performance matrix.
          </p>
          {allTeams.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-w-md">
              <span className="text-[11px] font-mono text-slate-500 w-full text-center">Quick Add Suggestions:</span>
              {allTeams.slice(0, 5).map((t) => (
                <button
                  key={t.teamNumber}
                  type="button"
                  onClick={() => handleQuickAdd(t.teamNumber)}
                  className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-mono font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  +# {t.teamNumber} {t.teamName}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Compare Matrix Table (Matching the image) */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <table className="w-full text-left border-collapse font-mono text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  <th className="p-3 sm:p-3.5 font-mono font-bold text-slate-400 uppercase text-xs w-44 sm:w-48 sticky left-0 bg-slate-900 z-20 border-r border-slate-800">
                    METRIC
                  </th>
                  {comparedStats.map((s) => (
                    <th
                      key={s.teamNum}
                      className="p-3 sm:p-3.5 text-left min-w-[170px] sm:min-w-[200px] border-r border-slate-800 last:border-r-0 bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-slate-850 border border-slate-750">
                        <button
                          type="button"
                          onClick={() => onNavigate('team-profile', s.teamNum)}
                          className="flex items-baseline gap-1.5 text-left group overflow-hidden cursor-pointer"
                          title={`View Team #${s.teamNum} Profile`}
                        >
                          <span className="font-mono font-black text-sm sm:text-[15px] text-amber-400 group-hover:text-amber-300">
                            #{s.teamNum}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-white truncate max-w-[100px] sm:max-w-[130px]">
                            {s.team?.teamName || `Team ${s.teamNum}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(s.teamNum)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                          title="Remove team"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && (
                    <th className="p-3 text-center min-w-[120px] bg-slate-900/50">
                      <select
                        value=""
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) handleQuickAdd(val);
                        }}
                        className="w-full bg-slate-850 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono py-1.5 px-2 rounded-xl cursor-pointer text-center"
                      >
                        <option value="">+ Add Team</option>
                        {availableTeamsToAdd.slice(0, 20).map((t) => (
                          <option key={t.teamNumber} value={t.teamNumber}>
                            #{t.teamNumber} {t.teamName}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80 font-mono">
                {/* 1. Total Score */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Total Score</div>
                    <div className="text-[10px] text-slate-500 font-normal">High / Low</div>
                  </td>
                  {comparedStats.map((s) => {
                    const isTop = s.totalScoreNum !== null && s.totalScoreNum === maxTotalScore && maxTotalScore > 0 && comparedStats.length > 1;
                    return (
                      <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                        <div className="inline-flex items-center justify-center gap-1">
                          <span className={`text-sm sm:text-base font-bold ${isTop ? 'text-emerald-400 font-black' : s.totalScore !== '—' ? 'text-slate-100' : 'text-slate-500'}`}>
                            {s.totalScore}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 2. Auto Score */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Auto Score</div>
                    <div className="text-[10px] text-slate-500 font-normal">High / Low</div>
                  </td>
                  {comparedStats.map((s) => {
                    const isTop = s.autoScoreNum !== null && s.autoScoreNum === maxAutoScore && maxAutoScore > 0 && comparedStats.length > 1;
                    return (
                      <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                        <span className={`text-sm sm:text-base font-bold ${isTop ? 'text-emerald-400 font-black' : s.autoScore !== '—' ? 'text-slate-100' : 'text-slate-500'}`}>
                          {s.autoScore}
                        </span>
                      </td>
                    );
                  })}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 3. Teleop Score */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Teleop Score</div>
                    <div className="text-[10px] text-slate-500 font-normal">High / Low</div>
                  </td>
                  {comparedStats.map((s) => {
                    const isTop = s.teleopScoreNum !== null && s.teleopScoreNum === maxTeleopScore && maxTeleopScore > 0 && comparedStats.length > 1;
                    return (
                      <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                        <span className={`text-sm sm:text-base font-bold ${isTop ? 'text-emerald-400 font-black' : s.teleopScore !== '—' ? 'text-slate-100' : 'text-slate-500'}`}>
                          {s.teleopScore}
                        </span>
                      </td>
                    );
                  })}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 4. Hopper Capacity */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Hopper Capacity</div>
                    <div className="text-[10px] text-slate-500 font-normal">(Fuel)</div>
                  </td>
                  {comparedStats.map((s) => (
                    <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                      <span className={`text-xs sm:text-sm font-bold ${s.hopperCapacity !== '—' ? 'text-slate-100' : 'text-slate-500'}`}>
                        {s.hopperCapacity}
                      </span>
                    </td>
                  ))}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 5. Shooting Accuracy */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Shooting Accuracy</div>
                    <div className="text-[10px] text-slate-500 font-normal">(Most Selected)</div>
                  </td>
                  {comparedStats.map((s) => (
                    <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                      <span className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded-lg border ${s.shootingAccuracy !== '—' ? 'bg-slate-900 text-slate-300 border-slate-750' : 'text-slate-500 border-transparent'}`}>
                        {s.shootingAccuracy}
                      </span>
                    </td>
                  ))}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 6. Shooting Range */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Shooting Range</div>
                    <div className="text-[10px] text-slate-500 font-normal">(Most Selected)</div>
                  </td>
                  {comparedStats.map((s) => (
                    <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                      <span className={`text-xs sm:text-sm font-semibold ${s.shootingRange !== '—' ? 'text-slate-200' : 'text-slate-500'}`}>
                        {s.shootingRange}
                      </span>
                    </td>
                  ))}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 7. Shooter Type */}
                <tr className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="font-bold text-slate-200">Shooter Type</div>
                    <div className="text-[10px] text-slate-500 font-normal">(Pit Scout)</div>
                  </td>
                  {comparedStats.map((s) => (
                    <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                      <span className={`text-xs sm:text-sm font-semibold ${s.shooterType !== '—' ? 'text-indigo-300 font-bold' : 'text-slate-500'}`}>
                        {s.shooterType}
                      </span>
                    </td>
                  ))}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>

                {/* 8. Failures */}
                <tr className="hover:bg-slate-900/40 transition-colors cursor-pointer" onClick={() => setShowExtendedDetails(!showExtendedDetails)}>
                  <td className="p-3 sm:p-3.5 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                    <div className="flex items-center gap-2">
                       <div className="font-bold text-slate-200">Failures</div>
                       {showExtendedDetails ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">(Matches · Severity)</div>
                  </td>
                  {comparedStats.map((s) => (
                    <td key={s.teamNum} className="p-3 sm:p-3.5 text-center border-r border-slate-800/80 last:border-r-0">
                      <span className={`px-2 py-0.5 rounded text-xs border font-bold ${
                            s.reliabilityLabel === 'HIGH'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : s.reliabilityLabel === 'MED'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : s.reliabilityLabel === 'LOW'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}>
                            {s.reliabilityLabel}
                          </span>
                    </td>
                  ))}
                  {comparedStats.length < 5 && availableTeamsToAdd.length > 0 && <td className="p-3"></td>}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Collapsible Additional Details Section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExtendedDetails(!showExtendedDetails)}
              className="w-full p-3.5 flex items-center justify-between text-left font-mono text-xs sm:text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-850/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-slate-400" />
                <span>Extended Scout & Alliance Info</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Ranks, Availability, Matches Scouted, Reliability, Defense, Drivetrain)
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-xs uppercase">{showExtendedDetails ? 'Hide' : 'Show'}</span>
                {showExtendedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showExtendedDetails && (
              <div className="border-t border-slate-800 overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs sm:text-sm">
                  <tbody className="divide-y divide-slate-800">
                    {/* Custom Rank */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 w-44 sm:w-48 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Custom Rank
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center font-bold text-slate-200 border-r border-slate-800 last:border-r-0">
                          {s.prefRank}
                        </td>
                      ))}
                    </tr>

                    {/* Availability */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Availability
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center border-r border-slate-800 last:border-r-0">
                          {s.isUnavailable ? (
                            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold text-xs">
                              PICKED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs">
                              AVAILABLE
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Event Rank */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Event Rank
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center font-bold text-slate-300 border-r border-slate-800 last:border-r-0">
                          {s.officialRank}
                        </td>
                      ))}
                    </tr>

                    {/* State Rank */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        State Rank
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center font-bold text-slate-300 border-r border-slate-800 last:border-r-0">
                          {s.stateRank}
                        </td>
                      ))}
                    </tr>

                    {/* Matches Scouted */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Matches Scouted
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center text-slate-200 border-r border-slate-800 last:border-r-0">
                          {s.matchesScouted}
                        </td>
                      ))}
                    </tr>

                    {/* Auto Success */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Auto Consistency
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center font-bold text-slate-200 border-r border-slate-800 last:border-r-0">
                          {s.autoSuccessStr}
                        </td>
                      ))}
                    </tr>

                    {/* Reliability */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Observed Reliability
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center border-r border-slate-800 last:border-r-0">
                          <span className={`px-2 py-0.5 rounded text-xs border font-bold ${
                            s.reliabilityLabel === 'HIGH'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : s.reliabilityLabel === 'MED'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : s.reliabilityLabel === 'LOW'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}>
                            {s.reliabilityLabel}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Defense */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Defense Played
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center text-xs text-slate-300 border-r border-slate-800 last:border-r-0">
                          {s.defenseLabel}
                        </td>
                      ))}
                    </tr>

                    {/* Drivetrain */}
                    <tr className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-slate-400 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                        Drivetrain
                      </td>
                      {comparedStats.map((s) => (
                        <td key={s.teamNum} className="p-3 text-center text-xs text-slate-300 border-r border-slate-800 last:border-r-0">
                          {s.drivetrain}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
