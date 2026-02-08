"use client";

import { useState } from "react";

interface FilterState {
  coach: string;
  era: string;
  tournamentOnly: boolean;
  winningOnly: boolean;
}

interface SeasonFiltersProps {
  coaches: string[];
  eras: Array<{ id: string; label: string }>;
  onFilterChange: (filters: FilterState) => void;
}

export function SeasonFilters({ coaches, eras, onFilterChange }: SeasonFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    coach: "all",
    era: "all",
    tournamentOnly: false,
    winningOnly: false
  });

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      coach: "all",
      era: "all",
      tournamentOnly: false,
      winningOnly: false
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const hasActiveFilters = 
    filters.coach !== "all" || 
    filters.era !== "all" || 
    filters.tournamentOnly || 
    filters.winningOnly;

  return (
    <section className="sb-card relative overflow-hidden rounded-xl p-4 border border-white/10 bg-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-tight">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Reset All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Coach Filter */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Coach</label>
          <select
            value={filters.coach}
            onChange={(e) => updateFilter("coach", e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All Coaches</option>
            {coaches.map(coach => (
              <option key={coach} value={coach}>{coach}</option>
            ))}
          </select>
        </div>

        {/* Era Filter */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Era / Decade</label>
          <select
            value={filters.era}
            onChange={(e) => updateFilter("era", e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All Eras</option>
            {eras.map(era => (
              <option key={era.id} value={era.id}>{era.label}</option>
            ))}
          </select>
        </div>

        {/* Toggle Filters */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.tournamentOnly}
              onChange={(e) => updateFilter("tournamentOnly", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-500 focus:ring-offset-0"
            />
            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
              Tournament appearances only
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.winningOnly}
              onChange={(e) => updateFilter("winningOnly", e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-500 focus:ring-offset-0"
            />
            <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
              Winning seasons only (&gt;50%)
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
