"use client";

import { useEffect, useState } from "react";
import { db, type Achievement } from "@/lib/db";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Trophy, Medal, Star, ShieldCheck, Crown, Target, MicrophoneStage, ShootingStar, Brain, Buildings, Gauge, HandHeart, LockKey } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { bentoCardVariant, bentoContainerVariant } from "@/lib/motion";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements";

const iconMap: Record<string, React.ReactNode> = {
  "Trophy": <Trophy weight="duotone" className="w-8 h-8 text-amber-500" />,
  "Medal": <Medal weight="duotone" className="w-8 h-8 text-blue-500" />,
  "Star": <Star weight="duotone" className="w-8 h-8 text-yellow-400" />,
  "ShieldCheck": <ShieldCheck weight="duotone" className="w-8 h-8 text-emerald-500" />,
  "Crown": <Crown weight="duotone" className="w-8 h-8 text-purple-500" />,
  "Target": <Target weight="duotone" className="w-8 h-8 text-sky-500" />,
  "MicrophoneStage": <MicrophoneStage weight="duotone" className="w-8 h-8 text-indigo-500" />,
  "ShootingStar": <ShootingStar weight="duotone" className="w-8 h-8 text-fuchsia-500" />,
  "Brain": <Brain weight="duotone" className="w-8 h-8 text-pink-500" />,
  "Buildings": <Buildings weight="duotone" className="w-8 h-8 text-cyan-500" />,
  "Gauge": <Gauge weight="duotone" className="w-8 h-8 text-orange-500" />,
  "HandHeart": <HandHeart weight="duotone" className="w-8 h-8 text-rose-500" />
};

export function AchievementShowcase() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const data = await db.achievements.orderBy("unlockedAt").reverse().toArray();
        setAchievements(data);
      } catch (error) {
        console.error("Failed to load achievements:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAchievements();
  }, []);

  if (isLoading) {
    return (
      <SpotlightCard className="min-h-[200px] p-8 md:p-10 group bg-gradient-to-br from-white/60 to-amber-50/30">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-slate-200 h-10 w-10"></div>
          <div className="flex-1 space-y-6 py-1">
            <div className="h-2 bg-slate-200 rounded"></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                <div className="h-2 bg-slate-200 rounded col-span-1"></div>
              </div>
              <div className="h-2 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </SpotlightCard>
    );
  }

  if (achievements.length === 0) {
    return null; // Don't show the section if no achievements unlocked yet
  }

  // Get unachieved definitions
  const unlockedCodes = new Set(achievements.map((a) => a.code));
  const lockedAchievements = ACHIEVEMENT_DEFINITIONS.filter(def => !unlockedCodes.has(def.code));

  return (
    <SpotlightCard className="min-h-[200px] p-8 md:p-10 group bg-gradient-to-br from-white/60 to-amber-50/30">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[16px] bg-amber-500 text-white flex items-center justify-center shadow-[0_8px_16px_rgba(245,158,11,0.2)]">
              <Trophy weight="duotone" className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-serif text-[#111111] leading-none mb-1">Achievements</h3>
              <p className="text-slate-500 font-medium text-sm">Milestones you&apos;ve reached</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-bold font-mono text-amber-600 bg-amber-100/50 px-4 py-2 rounded-full border border-amber-200 shadow-sm">
              {achievements.length} UNLOCKED
            </div>
          </div>
        </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={bentoContainerVariant}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {/* Unlocked Achievements */}
            {achievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                variants={bentoCardVariant}
                className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm relative overflow-hidden group/achievement transform-gpu transition-all hover:shadow-md hover:scale-[1.02] hover:border-amber-200"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent opacity-0 group-hover/achievement:opacity-100 transition-opacity duration-500 will-change-opacity" />
                <div className="relative z-10 flex gap-4">
                  <div className="shrink-0 w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover/achievement:bg-amber-50 group-hover/achievement:border-amber-100 transition-colors">
                    {iconMap[achievement.icon] || <Trophy weight="duotone" className="w-8 h-8 text-amber-500" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#111111] text-[1.1rem] leading-tight mb-1">{achievement.title}</h4>
                    <p className="text-slate-500 text-[13px] leading-relaxed font-medium mb-3">{achievement.description}</p>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Locked Achievements (Preview) */}
            {lockedAchievements.map((achievement) => (
              <motion.div
                key={achievement.code}
                variants={bentoCardVariant}
                className="bg-slate-50/50 border border-slate-100 border-dashed rounded-[24px] p-6 shadow-sm relative overflow-hidden opacity-60 grayscale-[50%] transition-all hover:grayscale-0 hover:opacity-100"
              >
                <div className="relative z-10 flex gap-4">
                  <div className="shrink-0 w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center shadow-inner">
                    <LockKey weight="duotone" className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-600 text-[1.1rem] leading-tight mb-1">{achievement.title}</h4>
                    <p className="text-slate-400 text-[13px] leading-relaxed font-medium mb-3">{achievement.description}</p>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      LOCKED
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </SpotlightCard>
  );
}
