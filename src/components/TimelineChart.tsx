"use client";

import { seasons } from "@/lib/ucData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DecadeData {
  decade: string;
  wins: number;
  losses: number;
  winPct: number;
  games: number;
  color: string;
}

export function TimelineChart() {
  // Group seasons by decade and calculate win percentages
  const decadeMap = new Map<string, { wins: number; losses: number }>();
  
  seasons.forEach(season => {
    const decade = Math.floor(season.year / 10) * 10;
    const key = `${decade}s`;
    const current = decadeMap.get(key) || { wins: 0, losses: 0 };
    decadeMap.set(key, {
      wins: current.wins + (season.wins || 0),
      losses: current.losses + (season.losses || 0)
    });
  });

  // Convert to array and calculate percentages
  const decadeData: DecadeData[] = Array.from(decadeMap.entries())
    .map(([decade, stats]) => {
      const games = stats.wins + stats.losses;
      const winPct = games > 0 ? (stats.wins / games) * 100 : 0;
      
      // Color based on win percentage
      let color = "#ef4444"; // red-500
      if (winPct >= 70) color = "#22c55e"; // green-500
      else if (winPct >= 60) color = "#eab308"; // yellow-500
      else if (winPct >= 50) color = "#f97316"; // orange-500
      
      return {
        decade,
        wins: stats.wins,
        losses: stats.losses,
        winPct: parseFloat(winPct.toFixed(1)),
        games,
        color
      };
    })
    .sort((a, b) => a.decade.localeCompare(b.decade));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-white/20 bg-black/90 p-3 shadow-xl backdrop-blur-sm">
          <div className="text-sm font-bold text-white">{data.decade}</div>
          <div className="mt-1 text-xs text-zinc-300">
            <div>Win %: <span className="font-semibold">{data.winPct}%</span></div>
            <div>Record: {data.wins}-{data.losses}</div>
            <div className="text-zinc-500">({data.games} games)</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="sb-card relative overflow-hidden rounded-2xl p-6 border border-white/10 bg-white/5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-500/70 via-red-500/15 to-transparent" />
      
      <div className="relative">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Win % by Decade</h2>
          <p className="text-sm text-black mt-1 font-bold">UC Basketball performance across the decades</p>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={decadeData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <XAxis 
                dataKey="decade" 
                stroke="#71717a" 
                style={{ fontSize: '15px', fontWeight: '500' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#71717a" 
                style={{ fontSize: '14px' }}
                label={{ value: 'Win %', angle: -90, position: 'insideLeft', style: { fill: '#71717a', fontSize: '14px' } }}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
              <Bar 
                dataKey="winPct" 
                radius={[8, 8, 0, 0]}
              >
                {decadeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-green-500" />
            <span className="text-zinc-400">70%+ Elite</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-yellow-500" />
            <span className="text-zinc-400">60-69% Strong</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-orange-500" />
            <span className="text-zinc-400">50-59% Above .500</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-red-500" />
            <span className="text-zinc-400">&lt;50% Below .500</span>
          </div>
        </div>
      </div>
    </section>
  );
}
