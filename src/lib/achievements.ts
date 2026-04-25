import { db, type Interview, type Achievement } from './db';

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
    description: 'Achieve a confidence score of 90 or above.',
    icon: 'ShieldCheck'
  },
  {
    code: 'strong_hire',
    title: 'The Unicorn',
    description: 'Receive a "Strong Hire" verdict from the AI council.',
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
    description: 'Demonstrate strong alignment with company cultural traits.',
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

  // 2. High Scorer
  if (interview.radarScores) {
    const avgScore = (
      interview.radarScores.logic +
      interview.radarScores.expression +
      interview.radarScores.professionalism +
      interview.radarScores.confidence +
      interview.radarScores.pressure +
      (interview.radarScores.bodyLanguage || 85)
    ) / 6;

    if (avgScore >= 90) {
      await unlock('high_scorer');
    }

    // 4. Confident
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

  // 3. Excellent Communicator
  if (interview.deliveryStats && interview.deliveryStats.fillerWords < 5) {
    await unlock('excellent_communicator');
  }

  // 5. Strong Hire
  if (interview.hireVerdict === 'strong_hire') {
    await unlock('strong_hire');
  }

  // 9. Culture Champ
  if (interview.culturalTraits && interview.culturalTraits.length > 0) {
    const avgCulture = interview.culturalTraits.reduce((acc, t) => acc + t.score, 0) / interview.culturalTraits.length;
    if (avgCulture >= 85) {
      await unlock('culture_champ');
    }
  }

  return newlyUnlocked;
}
