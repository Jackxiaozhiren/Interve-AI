"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

export interface TrendDataPoint {
  name: string;
  score: number;
  sessionId?: string;
}

interface GrowthTrendChartProps {
  trendData: TrendDataPoint[];
  isCalmMode?: boolean;
  onSessionClick?: (sessionId: string) => void;
}

export function GrowthTrendChart({ trendData, isCalmMode = false, onSessionClick }: GrowthTrendChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.sessionId && onSessionClick) {
      onSessionClick(data.activePayload[0].payload.sessionId);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart 
        data={trendData} 
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        onClick={handleClick}
        style={{ cursor: onSessionClick ? 'pointer' : 'default' }}
      >
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0284c7" stopOpacity={0.5}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
        <YAxis domain={['dataMin - 5', 100]} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
        <Tooltip 
          cursor={{ stroke: '#0284c7', strokeWidth: 1, strokeDasharray: '4 4' }}
          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)' }} 
          itemStyle={{ fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#0284c7' }}
          labelStyle={{ color: '#64748b', fontSize: '12px' }}
        />
        <Area type="monotone" dataKey="score" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" isAnimationActive={!isCalmMode} activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
