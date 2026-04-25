"use client";

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from "recharts";

export interface RadarDataPoint {
  subject: string;
  A: number;
  B?: number;
}

interface SkillBreakdownChartProps {
  radarData: RadarDataPoint[];
  showFirst: boolean;
  isCalmMode?: boolean;
}

export function SkillBreakdownChart({ radarData, showFirst, isCalmMode = false }: SkillBreakdownChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity={0.6}/>
            <stop offset="100%" stopColor="#059669" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <PolarGrid stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)' }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        
        <Tooltip 
          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)' }}
          itemStyle={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}/100`, name === 'A' ? 'Latest Session' : 'First Session']}
        />
        <Legend 
          wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, paddingTop: '10px' }} 
          formatter={(value) => <span className="text-slate-600 font-medium">{value === 'A' ? 'Latest Session' : (value === 'B' ? 'First Session' : value)}</span>} 
        />
        
        {showFirst && <Radar name="B" dataKey="B" stroke="#94a3b8" strokeWidth={2} fill="#f1f5f9" fillOpacity={0.5} strokeDasharray="4 4" isAnimationActive={!isCalmMode} />}
        <Radar name="A" dataKey="A" stroke="#0284c7" strokeWidth={3} fill="url(#radarGradient)" fillOpacity={1} isAnimationActive={!isCalmMode} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
