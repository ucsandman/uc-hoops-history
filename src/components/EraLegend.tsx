"use client";

export function EraLegend() {
  const eras = [
    {
      label: "Championship Era",
      years: "1960-1963",
      color: "bg-gradient-to-r from-amber-500 to-yellow-500",
      borderColor: "border-amber-500/50"
    },
    {
      label: "Huggins Era",
      years: "1989-2004",
      color: "bg-gradient-to-r from-red-500 to-red-600",
      borderColor: "border-red-500/40"
    },
    {
      label: "Cronin Era",
      years: "2006-2018",
      color: "bg-gradient-to-r from-blue-500 to-blue-600",
      borderColor: "border-blue-500/40"
    },
    {
      label: "Modern Era",
      years: "2019-Now",
      color: "bg-gradient-to-r from-purple-500 to-purple-600",
      borderColor: "border-purple-500/40"
    }
  ];

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-lg font-bold tracking-tight mb-3">Era Guide</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {eras.map((era, idx) => (
          <div 
            key={idx}
            className={`rounded-lg border p-3 ${era.borderColor} bg-black/20`}
          >
            <div className={`h-1.5 w-full rounded-full mb-2 ${era.color}`} />
            <div className="text-sm font-semibold text-white">{era.label}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{era.years}</div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="text-lg">🏆</span>
          <span>= National Championship</span>
        </div>
      </div>
    </section>
  );
}
