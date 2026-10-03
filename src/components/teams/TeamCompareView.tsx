import React, { useState, useEffect } from 'react';
import { TeamProfile, MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { ArrowLeft, Users, Zap, Shield, Wrench, Trophy, Check, Plus, X } from 'lucide-react';

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

  // Helper to calculate comparison stats for a team
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

    // Reliability & Defense
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

    // Routes
    const usedBump = matches.some((m) => m.fieldRoute === 'BUMP' || m.fieldRoute === 'BOTH');
    const usedTrench = matches.some((m) => m.fieldRoute === 'TRENCH' || m.fieldRoute === 'BOTH');
    let routeLabel = 'NEITHER';
    if (usedBump && usedTrench) routeLabel = 'BOTH';
    else if (usedTrench) routeLabel = 'TRENCH';
    else if (usedBump) routeLabel = 'BUMP';

    // Pit Data
    const pit = team?.pit;
    const drivetrain = pit?.drivetrain || 'Unknown';
    const shooter = pit?.shooter?.join(', ') || 'Unknown';
    const hopper = pit?.hopperCapacity ? `${pit.hopperCapacity}` : 'N/A';
    const accuracy = pit?.shootingAccuracy || 'N/A';
    const autoRoutines = pit?.autoRoutinesCount || (pit?.hasAutonomous === 'YES' ? '1+' : '0');

    return {
      team,
      teamNum,
      officialRank: team?.officialRank ? `Rank ${team.officialRank}` : 'N/A',
      stateRank: team?.stateRank ? `Rank ${team.stateRank}` : 'N/A',
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
    <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-5 pb-32 flex flex-col gap-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('picklist')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black font-mono text-slate-100 uppercase tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>TEAM COMPARISON</span>
            </h1>
            <p className="text-xs text-slate-400">
              Side-by-side performance matrix for alliance selection
            </p>
          </div>
        </div>

        {/* Add Team Input */}
        <form onSubmit={handleAddTeam} className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Add Team #"
            value={addTeamInput}
            onChange={(e) => setAddTeamInput(e.target.value)}
            className="w-28 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-mono text-xs uppercase cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>

      {comparedStats.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-bold">No teams selected for comparison</p>
          <p className="text-slate-500 text-xs mt-1">Select 2 to 4 teams from the Picklist or enter a team number above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            {/* Table Header: Team Badges */}
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="p-3 font-mono font-bold text-slate-400 uppercase text-xs w-40">
                  METRIC
                </th>
                {comparedStats.map((s) => (
                  <th key={s.teamNum} className="p-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center justify-center gap-1">
                        <span 
                          onClick={() => onNavigate('team-profile', s.teamNum)}
                          className="font-mono font-black text-base text-amber-400 hover:underline cursor-pointer"
                        >
                          #{s.teamNum}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(s.teamNum)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 cursor-pointer"
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

            <tbody className="divide-y divide-slate-850">
              {/* OFFICIAL EVENT RANK */}
              <tr className="bg-slate-900/50 font-bold">
                <td className="p-3 font-mono uppercase text-amber-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" />
                  <span>Event Rank</span>
                </td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-black text-amber-300">
                    {s.officialRank}
                  </td>
                ))}
              </tr>

              {/* STATE RANK */}
              <tr className="bg-slate-900/50 font-bold border-b border-slate-800">
                <td className="p-3 font-mono uppercase text-blue-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-blue-400" />
                  <span>State Rank</span>
                </td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-black text-blue-300">
                    {s.stateRank}
                  </td>
                ))}
              </tr>

              {/* SECTION: MATCH DATA */}
              <tr className="bg-slate-900/80">
                <td colSpan={comparedStats.length + 1} className="p-2 px-3 font-mono font-bold text-[11px] text-blue-400 uppercase tracking-wider">
                  MATCH OBSERVATION DATA
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Matches Scouted</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono text-slate-200">
                    {s.matchesScouted}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Auto Success</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-bold text-blue-400">
                    {s.autoSuccessStr}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Avg Auto Fuel</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-bold text-blue-300">
                    {s.avgAutoFuel}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Avg Teleop Fuel</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-bold text-emerald-400">
                    {s.avgTeleopFuel}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-900/40 font-bold">
                <td className="p-3 font-semibold text-white">Avg Total Fuel</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-black text-amber-400 text-base">
                    {s.avgTotalFuel}
                  </td>
                ))}
              </tr>

              {/* SECTION: RELIABILITY & DEFENSE */}
              <tr className="bg-slate-900/80">
                <td colSpan={comparedStats.length + 1} className="p-2 px-3 font-mono font-bold text-[11px] text-purple-400 uppercase tracking-wider">
                  RELIABILITY & FIELD ROUTE
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Robot Issues / Reliability</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      s.reliabilityLabel === 'HIGH' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      s.reliabilityLabel === 'MED' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {s.reliabilityLabel}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Defense Capability</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      s.defenseLabel === 'HIGH' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                      s.defenseLabel === 'MED' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                      'bg-slate-900 text-slate-400'
                    }`}>
                      {s.defenseLabel}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Field Routes Used</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-semibold text-slate-200">
                    {s.routeLabel}
                  </td>
                ))}
              </tr>

              {/* SECTION: PIT DATA */}
              <tr className="bg-slate-900/80">
                <td colSpan={comparedStats.length + 1} className="p-2 px-3 font-mono font-bold text-[11px] text-emerald-400 uppercase tracking-wider">
                  PIT SCOUT CLAIMS
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Drivetrain</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono text-slate-200">
                    {s.drivetrain}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Shooter Type</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono text-slate-200">
                    {s.shooter}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Hopper Capacity</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono text-slate-200">
                    {s.hopper}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Shooting Accuracy</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono font-semibold text-emerald-300">
                    {s.accuracy}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-300">Auto Routines Count</td>
                {comparedStats.map((s) => (
                  <td key={s.teamNum} className="p-3 text-center font-mono text-slate-200">
                    {s.autoRoutines}
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
