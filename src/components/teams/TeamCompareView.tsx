import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { ArrowLeft, Users, Trophy, Plus, X } from 'lucide-react';

interface TeamCompareViewProps {
  initialSelectedTeams?: number[];
  onNavigate: (view: string, teamNumber?: number) => void;
}

export const TeamCompareView: React.FC<TeamCompareViewProps> = ({
  initialSelectedTeams = [],
  onNavigate,
}) => {
  const [allTeams, setAllTeams] = useState<TeamProfile[]>([]);
  const [allMatches, setAllMatches] = useState<MatchScoutingRecord[]>([]);
  const [selectedTeamNums, setSelectedTeamNums] = useState<number[]>(
    initialSelectedTeams.length > 0 ? initialSelectedTeams.slice(0, 4) : []
  );
  const [addTeamInput, setAddTeamInput] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const teams = await scoutingDB.getAllTeams();
    const matches = await scoutingDB.getAllMatches();
    setAllTeams(teams);
    setAllMatches(matches);

    if (selectedTeamNums.length === 0 && teams.length > 0) {
      setSelectedTeamNums(teams.slice(0, 3).map((t) => t.teamNumber));
    }
  };

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(addTeamInput, 10);
    if (!isNaN(num) && !selectedTeamNums.includes(num)) {
      if (selectedTeamNums.length >= 4) {
        setSelectedTeamNums([...selectedTeamNums.slice(1), num]);
      } else {
        setSelectedTeamNums([...selectedTeamNums, num]);
      }
      setAddTeamInput('');
    }
  };

  const handleRemoveTeam = (teamNum: number) => {
    setSelectedTeamNums(selectedTeamNums.filter((n) => n !== teamNum));
  };

  const getTeamStats = (teamNum: number) => {
    const team = allTeams.find((t) => t.teamNumber === teamNum);
    const matches = allMatches.filter((m) => m.teamNumber === teamNum);
    const count = matches.length;

    const autoWorkedCount = matches.filter((m) => m.autoWorked !== false).length;
    const autoSuccessStr = count > 0 ? `${autoWorkedCount}/${count}` : '0/0';

    const avgAutoFuel = count
      ? (matches.reduce((sum, m) => sum + (m.autoFuelScored ?? m.autoHighScored ?? 0), 0) / count)
      : 0;

    const avgTeleopFuel = count
      ? (matches.reduce((sum, m) => sum + (m.teleopFuelScored ?? m.teleopHighScored ?? 0), 0) / count)
      : 0;

    const avgTotalFuel = avgAutoFuel + avgTeleopFuel;

    const majorIssuesCount = matches.filter((m) => m.robotIssues === 'MAJOR' || m.robotIssues === 'DISABLED').length;
    const minorIssuesCount = matches.filter((m) => m.robotIssues === 'MINOR').length;

    let reliabilityLabel = 'HIGH';
    if (majorIssuesCount >= 2) reliabilityLabel = 'LOW';
    else if (majorIssuesCount === 1 || minorIssuesCount >= 2) reliabilityLabel = 'MED';

    const defenseMatches = matches.filter((m) => m.playedDefense);
    let defenseLabel = 'NONE';
    if (defenseMatches.length > 0) {
      const highDef = defenseMatches.filter((m) => m.defenseEffectiveness === 'HIGH').length;
      const medDef = defenseMatches.filter((m) => m.defenseEffectiveness === 'MEDIUM').length;
      if (highDef > 0) defenseLabel = 'HIGH';
      else if (medDef > 0) defenseLabel = 'MED';
      else defenseLabel = 'LOW';
    }

    const usedBump = matches.some((m) => m.fieldRoute === 'BUMP' || m.fieldRoute === 'BOTH');
    const usedTrench = matches.some((m) => m.fieldRoute === 'TRENCH' || m.fieldRoute === 'BOTH');
    let routeLabel = 'NEITHER';
    if (usedBump && usedTrench) routeLabel = 'BOTH';
    else if (usedTrench) routeLabel = 'TRENCH';
    else if (usedBump) routeLabel = 'BUMP';

    const pit = team?.pit;
    const drivetrain = pit?.drivetrain || 'Unknown';
    const shooter = pit?.shooter?.join(', ') || 'Unknown';
    const hopper = pit?.hopperCapacity ? `${pit.hopperCapacity}` : 'N/A';
    const accuracy = pit?.shootingAccuracy || 'N/A';
    const autoRoutines = pit?.autoRoutinesCount || (pit?.hasAutonomous === 'YES' ? '1+' : '0');

    return {
      team,
      teamNum,
      officialRank: team?.officialRank ? `Rank ${team.officialRank}` : '—',
      stateRank: team?.stateRank ? `Rank ${team.stateRank}` : '—',
      prefRank: team?.customPicklistRank ? `#${team.customPicklistRank}` : '—',
      isUnavailable: !!team?.isUnavailable,
      matchesScouted: count,
      autoSuccessStr,
      avgAutoFuel: avgAutoFuel.toFixed(1),
      avgTeleopFuel: avgTeleopFuel.toFixed(1),
      avgTotalFuel: avgTotalFuel.toFixed(1),
      reliabilityLabel,
      defenseLabel,
      routeLabel,
      drivetrain,
      shooter,
      hopper,
      accuracy,
      autoRoutines,
    };
  };

  const comparedStats = selectedTeamNums.map(getTeamStats);

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-4 pb-32 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('picklist')}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-lg font-bold font-mono text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span>Team Comparison</span>
          </h1>
        </div>

        <form onSubmit={handleAddTeam} className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Team #"
            value={addTeamInput}
            onChange={(e) => setAddTeamInput(e.target.value)}
            className="w-24 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono text-xs uppercase cursor-pointer border border-slate-700 font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {comparedStats.length === 0 ? (
        <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-xs">No teams selected for comparison.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="p-3 font-mono font-bold text-slate-400 uppercase text-xs w-40">
                  METRIC
                </th>
                {comparedStats.map((s) => (
                  <th key={s.teamNum} className="p-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center justify-center gap-1">
                        <span 
                          onClick={() => onNavigate('team-profile', s.teamNum)}
                          className="font-mono font-bold text-sm text-slate-200 hover:underline cursor-pointer"
                        >
                          #{s.teamNum}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(s.teamNum)}
                          className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[110px]">
                        {s.team?.teamName || `Team ${s.teamNum}`}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-850 font-mono">
              <tr className="bg-slate-900/40">
                <td className="p-3 font-bold text-slate-300 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Custom Rank</span>
                </td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-bold text-slate-200">
                    {s.prefRank}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Availability</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center text-xs">
                    {s.isUnavailable ? (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                        PICKED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-750 font-bold">
                        AVAILABLE
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Event Rank</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-bold text-slate-300">
                    {s.officialRank}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">State Rank</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-bold text-slate-300">
                    {s.stateRank}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Matches Scouted</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center text-slate-200">
                    {s.matchesScouted}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Auto Success</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-bold text-slate-200">
                    {s.autoSuccessStr}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Avg Total Fuel</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-bold text-slate-100 text-sm">
                    {s.avgTotalFuel}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Reliability</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-900 border border-slate-800 text-slate-300">
                      {s.reliabilityLabel}
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Defense</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center text-xs text-slate-300">
                    {s.defenseLabel}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Drivetrain</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center text-slate-300">
                    {s.drivetrain}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3 font-semibold text-slate-400">Shooter</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center text-slate-300">
                    {s.shooter}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
