import { db, type Interview, type Achievement } from './db';
import { sessionScore, toEvaluationView } from './eval-compat';

export const ACHIEVEMENT_DEFINITIONS = [
  {
    code: 'first_interview',
    title: 'First Steps',
    description: 'Complete your first mock interview.',
    icon: 'Target'
  },
  {
    code: 'high_scorer',
    title: 'Top Performer',
    description: 'Achieve an overall average score of 90 or above.',
    icon: 'Star'
  },
  {
    code: 'excellent_communicator',
    title: 'Smooth Talker',
    description: 'Complete an interview with fewer than 5 filler words.',
    icon: 'MicrophoneStage'
  },
  {
    code: 'confident',
    title: 'Unshakable',
    // Phase 4: candidate-"confidence" scores are retired with the legacy
    // radar. The code is kept (stored unlocks); it now tracks top readiness.
    description: 'Reach Strongly Prepared interview readiness.',
    icon: 'ShieldCheck'
  },
  {
    code: 'strong_hire',
    title: 'Interview Ready',
    // Phase 4: hire verdicts are no longer produced. Code kept for stored
    // unlocks; now tracks Interview Ready readiness or above.
    description: 'Reach Interview Ready readiness or above.',
    icon: 'ShootingStar'
  },
  {
    code: 'the_analyst',
    title: 'The Analyst',
    description: 'Achieve a logic score of 90 or above.',
    icon: 'Brain'
  },
  {
    code: 'the_architect',
    title: 'The Architect',
    description: 'Achieve a system design score of 90 or above.',
    icon: 'Buildings'
  },
  {
    code: 'stress_tester',
    title: 'Pressure Cooker',
    description: 'Complete a stress test interview with a pressure score of 85 or above.',
    icon: 'Gauge'
  },
  {
    code: 'culture_champ',
    title: 'Culture Champ',
    // Phase 4: culture-fit scoring is retired. Code kept for stored unlocks;
    // now tracks strong role-relevant ownership/communication evidence.
    description: 'Demonstrate strong role-relevant ownership and communication.',
    icon: 'HandHeart'
  }
];

export async function checkAndUnlockAchievements(interview: Interview): Promise<Achievement[]> {
  if (interview.status !== 'completed') return [];

  const newlyUnlocked: Achievement[] = [];
  const existingAchievements = await db.achievements.toArray();
  const existingCodes = new Set(existingAchievements.map(a => a.code));

  const unlock = async (code: string) => {
    if (!existingCodes.has(code)) {
      const def = ACHIEVEMENT_DEFINITIONS.find(d => d.code === code);
      if (def) {
        const achievement: Achievement = {
          code: def.code,
          title: def.title,
          description: def.description,
          icon: def.icon,
          unlockedAt: new Date()
        };
        await db.achievements.add(achievement);
        newlyUnlocked.push(achievement);
        existingCodes.add(code);
      }
    }
  };

  // 1. First Interview
  const totalInterviews = await db.interviews.where('status').equals('completed').count();
  if (totalInterviews >= 1) {
    await unlock('first_interview');
  }

  // 2. High Scorer (Phase 4: unified V2/legacy score)
  const avg = sessionScore(interview);
  if (avg !== null && avg >= 90) {
    await unlock('high_scorer');
  }

  // Dimension-driven unlocks: V2 dimensions first, legacy radar as fallback.
  const view = toEvaluationView(interview);
  const dimScore = (...ids: string[]): number | null => {
    for (const id of ids) {
      const d = view.dimensions.find((x) => x.id === id);
      if (d) return d.score100;
    }
    return null;
  };

  if (interview.radarScores) {
    // 4. Confident (legacy radar grandfathered; V2 uses top readiness)
    if (interview.radarScores.confidence >= 90) {
      await unlock('confident');
    }

    // 6. The Analyst
    if (interview.radarScores.logic >= 90) {
      await unlock('the_analyst');
    }

    // 7. The Architect
    if (interview.radarScores.systemDesign && interview.radarScores.systemDesign >= 90) {
      await unlock('the_architect');
    }

    // 8. Pressure Cooker
    if (interview.stressTest && interview.radarScores.pressure >= 85) {
      await unlock('stress_tester');
    }
  }

  if (!interview.radarScores && view.kind === "v2") {
    const correctness = dimScore("correctness", "relevance", "framing", "clarification");
    if (correctness !== null && correctness >= 90) {
      await unlock('the_analyst');
    }
    const architecture = dimScore("architecture");
    if (architecture !== null && architecture >= 90) {
      await unlock('the_architect');
    }
  }

  // 3. Excellent Communicator
  if (interview.deliveryStats && interview.deliveryStats.fillerWords < 5) {
    await unlock('excellent_communicator');
  }

  // 5. Interview Ready (Phase 4: V2 readiness; legacy strong_hire grandfathered)
  if (view.kind === "v2") {
    if (view.readinessLabel === "interview_ready" || view.readinessLabel === "strongly_prepared") {
      await unlock('strong_hire');
    }
    if (view.readinessLabel === "strongly_prepared") {
      await unlock('confident');
    }
  } else if (interview.hireVerdict === 'strong_hire') {
    await unlock('strong_hire');
  }

  // 9. Role-relevant ownership & communication (Phase 4: V2 evidence;
  // legacy cultural-trait average grandfathered)
  if (view.kind === "v2") {
    const relevant = view.dimensions.filter((d) =>
      ["ownership", "collaboration", "communication"].includes(d.id)
    );
    if (relevant.length > 0 && relevant.every((d) => d.score100 >= 85)) {
      await unlock('culture_champ');
    }
  } else if (interview.culturalTraits && interview.culturalTraits.length > 0) {
    const avgCulture = interview.culturalTraits.reduce((acc, t) => acc + t.score, 0) / interview.culturalTraits.length;
    if (avgCulture >= 85) {
      await unlock('culture_champ');
    }
  }

  return newlyUnlocked;
}
