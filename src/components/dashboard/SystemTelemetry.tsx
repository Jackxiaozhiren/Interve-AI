"use client";

import React from "react";
import { dbClient as db, useLiveQuery } from "@/lib/api-client";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Pulse, Clock, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export function SystemTelemetry() {
  const telemetryData = useLiveQuery(() => db.telemetry.orderBy('timestamp').toArray()) || [];

  const avgLatency = telemetryData.length 
    ? Math.round(telemetryData.reduce((acc, curr) => acc + curr.latencyMs, 0) / telemetryData.length) 
    : 0;

  const successCount = telemetryData.filter(d => d.status === 'success').length;
  const successRate = telemetryData.length 
    ? Math.round((successCount / telemetryData.length) * 100) 
    : 100;

  // Format data for chart
  const chartData = telemetryData.slice(-20).map(d => ({
    time: format(new Date(d.timestamp), 'HH:mm:ss'),
    latency: d.latencyMs,
    endpoint: d.endpoint
  }));

  return (
    <SpotlightCard className="p-8 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl flex flex-col mt-6">
      <div className="flex items-center gap-2 mb-6">
        <Pulse className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-semibold text-slate-900">System Edge Telemetry</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Avg Latency</span>
          </div>
          <span className="text-2xl font-light text-slate-900">{avgLatency} <span className="text-sm font-bold text-slate-400">ms</span></span>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Success Rate</span>
          </div>
          <span className="text-2xl font-light text-slate-900">{successRate} <span className="text-sm font-bold text-slate-400">%</span></span>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-amber-500">
            <WarningCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Total Events</span>
          </div>
          <span className="text-2xl font-light text-slate-900">{telemetryData.length}</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[200px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#64748b', fontSize: '12px' }}
                itemStyle={{ color: '#0ea5e9', fontSize: '14px', fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            No telemetry data available yet
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
