import React, { useState, useEffect } from 'react';
import { MatchScoutingRecord } from '../../types/scouting';
import { scoutingDB } from '../../db/indexedDB';
import { 
  Search, 
  Trash2, 
  Download, 
  ArrowLeft, 
  Plus, 
  Star, 
  ShieldAlert, 
  TrendingUp,
  Filter
} from 'lucide-react';

interface EventDataViewProps {
  onNavigate: (view: string, teamNumber?: number) => void;
  onBack: () => void;
}

export const EventDataView: React.FC<EventDataViewProps> = ({ onNavigate, onBack }) => {
  const [matches, setMatches] = useState<MatchScoutingRecord[]>([]);
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [filterAlliance, setFilterAlliance] = useState<'ALL' | 'RED' | 'BLUE'>('ALL');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    const list = await scoutingDB.getAllMatches();
    setMatches(list);
  };

  const handleDeleteMatch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await scoutingDB.deleteMatch(id);
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  const exportCSV = () => {
    if (matches.length === 0) return;
    const headers = [
      'Match',
      'Team',
      'AutoWorked',
      'AutoFuelScored',
      'TeleopFuelScored',
      'FieldRoute',
      'PlayedDefense',
      'DefenseEffectiveness',
      'RobotIssues',
      'WhatHappened',
      'QuickNote',
    ];

    const rows = matches.map((m) => [
      m.matchNumber,
      m.teamNumber,
      m.autoWorked !== false ? 'YES' : 'NO',
      m.autoFuelScored ?? m.autoHighScored ?? 0,
      m.teleopFuelScored ?? m.teleopHighScored ?? 0,
      `"${m.fieldRoute || 'NEITHER'}"`,
      m.playedDefense ? 'YES' : 'NO',
      `"${m.defenseEffectiveness || ''}"`,
      `"${m.robotIssues || 'NONE'}"`,
      `"${(m.whatHappenedNote || '').replace(/"/g, '""')}"`,
      `"${(m.quickNote || m.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `panther_match_observations_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = matches.filter((m) => {
    if (filterTeam && !m.teamNumber.toString().includes(filterTeam)) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28 flex flex-col gap-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2 font-mono">
            <span>Match Observations</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {matches.length}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time scouting records collected during the REBUILT event.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {matches.length > 0 && (
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('match-scout')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Scout Match</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="number"
            placeholder="Filter by Team #"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Alliance:</span>
          {(['ALL', 'BLUE', 'RED'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setFilterAlliance(a)}
              className={`px-2.5 py-1 rounded-lg font-bold ${
                filterAlliance === a
                  ? a === 'BLUE'
                    ? 'bg-blue-600 text-white'
                    : a === 'RED'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-700 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Match Table / List */}
      <div className="space-y-2.5">
        {filtered.length > 0 ? (
          filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => onNavigate('team-profile', m.teamNumber)}
              className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base text-white">
                    Match {m.matchNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold text-xs border border-slate-700">
                    Team {m.teamNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    m.autoWorked !== false ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {m.autoWorked !== false ? 'Auto Worked' : 'Auto Failed'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono">
                    Auto Fuel: <strong className="text-blue-400">{m.autoFuelScored ?? m.autoHighScored ?? 0}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono">
                    Teleop Fuel: <strong className="text-emerald-400">{m.teleopFuelScored ?? m.teleopHighScored ?? 0}</strong>
                  </span>
                  {m.fieldRoute && (
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-purple-300">
                      Route: {m.fieldRoute}
                    </span>
                  )}
                  {m.playedDefense && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                      Defense: {m.defenseEffectiveness || 'YES'}
                    </span>
                  )}
                  {m.robotIssues && m.robotIssues !== 'NONE' && (
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold font-mono">
                      Issues: {m.robotIssues}
                    </span>
                  )}
                </div>

                {(m.quickNote || m.notes) && (
                  <p className="text-xs text-slate-400 italic pt-1">"{m.quickNote || m.notes}"</p>
                )}
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <button
                  type="button"
                  onClick={(e) => handleDeleteMatch(m.id, e)}
                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-900/60 text-slate-500 hover:text-rose-300 transition-colors"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
            <p className="text-sm">No match scouting records found.</p>
            <button
              onClick={() => onNavigate('match-scout')}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase"
            >
              Start Real-Time Match Scouting
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
