"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Users, Target, ChartBar, Funnel, MagnifyingGlass, FunnelSimple, X, Tag, NotePencil, CheckCircle, FloppyDisk } from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { dbClient as db, useLiveQuery } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SystemTelemetry } from "@/components/dashboard/SystemTelemetry";

const pipelineData = [
  { name: "Sourced", count: 450 },
  { name: "Screening", count: 320 },
  { name: "Technical", count: 150 },
  { name: "Onsite", count: 80 },
  { name: "Offer", count: 25 },
];

const roleDistribution = [
  { name: "Frontend Eng", value: 40 },
  { name: "Backend Eng", value: 30 },
  { name: "Product Manager", value: 15 },
  { name: "Data Scientist", value: 15 },
];

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#6366f1"];

const mockCandidates = [
  { id: "C-101", name: "Alex Chen", role: "Frontend Eng", score: 92, stage: "Technical", status: "Active" },
  { id: "C-102", name: "Sarah Jenkins", role: "Product Manager", score: 88, stage: "Onsite", status: "Active" },
  { id: "C-103", name: "Michael Chang", role: "Backend Eng", score: 75, stage: "Screening", status: "Rejected" },
  { id: "C-104", name: "Emily Rodriguez", role: "Data Scientist", score: 95, stage: "Offer", status: "Hired" },
  { id: "C-105", name: "David Kim", role: "Frontend Eng", score: 84, stage: "Technical", status: "Active" },
];

import { fadeUpVariant, staggerContainer } from "@/lib/motion";

export default function RecruiterDashboard() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<typeof mockCandidates[0] | null>(null);

  const kpiData = [
    { label: t.recruiter.totalCandidates, value: "1,284", icon: Users, color: "text-sky-500", bg: "bg-sky-50" },
    { label: t.recruiter.avgMatchScore, value: "86%", icon: Target, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: t.recruiter.interviewsThisWeek, value: "42", icon: ChartBar, color: "text-amber-500", bg: "bg-amber-50" },
  ];

  const filteredCandidates = mockCandidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const evaluation = useLiveQuery(
    () => selectedCandidate ? db.evaluations.where('candidateId').equals(selectedCandidate.id).first() : undefined,
    [selectedCandidate]
  );

  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (evaluation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(evaluation.notes || "");
       
      setTags(evaluation.tags || []);
    } else {
       
      setNotes("");
       
      setTags([]);
    }
  }, [evaluation, selectedCandidate]);

  const handleSaveEvaluation = async () => {
    if (!selectedCandidate) return;
    setIsSaving(true);
    try {
      if (evaluation?.id) {
        await db.evaluations.update(evaluation.id, {
          notes,
          tags,
          updatedAt: new Date()
        });
      } else {
        await db.evaluations.add({
          candidateId: selectedCandidate.id,
          notes,
          tags,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-sky-100/40 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[60%] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="max-w-7xl mx-auto relative z-10 flex flex-col gap-8"
      >
        {/* Header */}
        <motion.div variants={fadeUpVariant} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif text-slate-900 tracking-tight">{t.recruiter.commandCenter}</h1>
            <p className="text-slate-500 mt-2 text-lg">{t.recruiter.commandCenterDesc}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link href="/recruiter/assessments">
              <Button variant="outline" className="rounded-full px-6 h-12 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all">
                {t.recruiter.smartParser}
              </Button>
            </Link>
            <Button className="bg-slate-900 text-white rounded-full px-6 h-12 shadow-md hover:bg-slate-800 transition-all">
              <Funnel className="w-4 h-4 mr-2" /> {t.common.generateReport}
            </Button>
          </div>
        </motion.div>

        {/* KPIs */}
        <motion.div variants={fadeUpVariant} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {kpiData.map((kpi, idx) => (
            <SpotlightCard key={idx} className="p-6 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon weight="duotone" className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                  <p className="text-3xl font-light text-slate-900 mt-1">{kpi.value}</p>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </motion.div>

        {/* Charts Row */}
        <motion.div variants={fadeUpVariant} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Chart */}
          <SpotlightCard className="p-8 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl min-h-[400px] flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t.recruiter.pipelineConversion}</h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={280}>
                <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SpotlightCard>

          {/* Role Distribution Chart */}
          <SpotlightCard className="p-8 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl min-h-[400px] flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">{t.recruiter.activeRoles}</h3>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={280}>
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {roleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {roleDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm text-slate-600 font-medium">{entry.name}</span>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Data Table */}
        <motion.div variants={fadeUpVariant}>
          <SpotlightCard className="p-8 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <h3 className="text-xl font-serif text-slate-900">{t.recruiter.recentCandidates}</h3>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input 
                    placeholder={t.common.search} 
                    className="pl-9 bg-white/50 border-slate-200 rounded-full h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="rounded-full h-10 px-4 bg-white/50">
                  <FunnelSimple className="w-4 h-4 mr-2" /> {t.common.filter}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-widest font-bold">
                    <th className="pb-4 font-sans px-4">Candidate ID</th>
                    <th className="pb-4 font-sans px-4">Name</th>
                    <th className="pb-4 font-sans px-4">Role</th>
                    <th className="pb-4 font-sans px-4 text-center">Match Score</th>
                    <th className="pb-4 font-sans px-4">Stage</th>
                    <th className="pb-4 font-sans px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700">
                  {filteredCandidates.map((candidate) => (
                    <tr 
                      key={candidate.id} 
                      onClick={() => setSelectedCandidate(candidate)}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-4 text-slate-500 font-mono">{candidate.id}</td>
                      <td className="py-4 px-4 text-slate-900 font-semibold">{candidate.name}</td>
                      <td className="py-4 px-4 text-slate-600">{candidate.role}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${candidate.score >= 90 ? 'bg-emerald-100 text-emerald-700' : candidate.score >= 80 ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                          {candidate.score}
                        </span>
                      </td>
                      <td className="py-4 px-4">{candidate.stage}</td>
                      <td className="py-4 px-4">
                        <Badge 
                          variant="secondary" 
                          className={
                            candidate.status === 'Active' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                            candidate.status === 'Hired' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }
                        >
                          {candidate.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">{t.recruiter.noCandidates}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Telemetry Dashboard */}
        <motion.div variants={fadeUpVariant}>
          <SystemTelemetry />
        </motion.div>
      </motion.div>

      {/* Sliding Drawer */}
      <AnimatePresence>
        {selectedCandidate && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCandidate(null)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-serif text-slate-900">{selectedCandidate.name}</h2>
                  <p className="text-slate-500 text-sm mt-1">{selectedCandidate.role} • ID: {selectedCandidate.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedCandidate(null)}
                  className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                {/* Score & Stage Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Match Score</p>
                    <div className="text-3xl font-light text-slate-900">{selectedCandidate.score}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Stage</p>
                    <div className="text-lg font-medium text-slate-900 mt-1">{selectedCandidate.stage}</div>
                  </div>
                </div>

                {/* Tags Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-5 h-5 text-sky-500" />
                    <h3 className="text-sm font-semibold text-slate-900">Candidate Tags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="bg-sky-50 text-sky-700 border border-sky-100 px-3 py-1 flex items-center gap-1">
                        {tag}
                        <X className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100" onClick={() => removeTag(tag)} />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add a tag..." 
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                      className="bg-slate-50 border-slate-200"
                    />
                    <Button variant="secondary" onClick={handleAddTag}>Add</Button>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <NotePencil className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-slate-900">Recruiter Notes</h3>
                  </div>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Enter your evaluation notes here..."
                    className="flex-1 w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none min-h-[200px]"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white">
                <Button 
                  onClick={handleSaveEvaluation}
                  className="w-full bg-slate-900 text-white rounded-full h-12 shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      Saved Successfully
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="w-5 h-5" />
                      Save Evaluation
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
