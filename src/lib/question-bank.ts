import { create, insertMultiple, search, type AnyOrama } from '@orama/orama';

export interface InterviewQuestion {
  id: string;
  category: 'Behavioral' | 'Technical' | 'System Design' | 'Leadership';
  title: string;
  description: string;
  tags: string[];
}

export const mockQuestionBank: InterviewQuestion[] = [
  {
    id: 'q1',
    category: 'Behavioral',
    title: 'Tell me about a time you failed',
    description: 'Describe a situation where a project or initiative you led failed. What did you learn and how did you recover?',
    tags: ['Failure', 'Resilience', 'Growth'],
  },
  {
    id: 'q2',
    category: 'Behavioral',
    title: 'Handling a difficult stakeholder',
    description: 'How do you manage a stakeholder who constantly changes requirements mid-sprint?',
    tags: ['Communication', 'Conflict Resolution', 'Stakeholder Management'],
  },
  {
    id: 'q3',
    category: 'Leadership',
    title: 'Leading a team through a crisis',
    description: 'Can you provide an example of when you had to lead a team through a difficult period or a critical production incident?',
    tags: ['Leadership', 'Crisis Management'],
  },
  {
    id: 'q4',
    category: 'System Design',
    title: 'Design a URL Shortener',
    description: 'Design a highly available and scalable URL shortening service like bit.ly.',
    tags: ['Scalability', 'System Design', 'Backend'],
  },
  {
    id: 'q5',
    category: 'Technical',
    title: 'Explain Event Loop in Node.js',
    description: 'How does the Node.js event loop work under the hood? Explain phases like timers, IO callbacks, and microtask queues.',
    tags: ['JavaScript', 'Node.js', 'Core Concepts'],
  },
  {
    id: 'q6',
    category: 'Technical',
    title: 'React Performance Optimization',
    description: 'What are the most effective ways to optimize a slow React application?',
    tags: ['React', 'Frontend', 'Performance'],
  },
  {
    id: 'q7',
    category: 'Behavioral',
    title: 'Cross-functional collaboration',
    description: 'Tell me about a successful project that required deep collaboration across multiple distinct teams.',
    tags: ['Collaboration', 'Teamwork'],
  },
  {
    id: 'q8',
    category: 'System Design',
    title: 'Design a Rate Limiter',
    description: 'Design a distributed API rate limiter for a high-traffic microservices architecture.',
    tags: ['System Design', 'API', 'Distributed Systems'],
  },
  {
    id: 'q9',
    category: 'Leadership',
    title: 'Mentoring a junior developer',
    description: 'Describe your approach to mentoring an underperforming or junior team member.',
    tags: ['Mentorship', 'Leadership', 'Empathy'],
  },
  {
    id: 'q10',
    category: 'Technical',
    title: 'ACID Properties',
    description: 'Explain the ACID properties of a relational database and how they guarantee data integrity.',
    tags: ['Database', 'SQL', 'Fundamentals'],
  },
  {
    id: 'q11',
    category: 'Behavioral',
    title: 'Navigating Ambiguity',
    description: 'Tell me about a time you had to deliver a project with extremely vague or undefined requirements. How did you proceed?',
    tags: ['Ambiguity', 'Execution', 'Problem Solving'],
  },
  {
    id: 'q12',
    category: 'Behavioral',
    title: 'Pushing Back on Leadership',
    description: 'Describe a situation where you fundamentally disagreed with a decision made by a senior manager or executive. How did you handle it?',
    tags: ['Conflict Resolution', 'Courage', 'Communication'],
  },
  {
    id: 'q13',
    category: 'Leadership',
    title: 'Driving Technical Vision',
    description: 'Tell me about a time you had to convince your engineering team to adopt a new technology or architecture that they were resistant to.',
    tags: ['Leadership', 'Influence', 'Architecture'],
  },
  {
    id: 'q14',
    category: 'Behavioral',
    title: 'Balancing Tech Debt and Product Delivery',
    description: 'How do you balance the need to ship features quickly with the need to maintain code quality and manage technical debt? Provide a specific example.',
    tags: ['Prioritization', 'Technical Debt', 'Delivery'],
  },
  {
    id: 'q15',
    category: 'Leadership',
    title: 'Managing Up & Strategic Alignment',
    description: 'Tell me about a time you identified a major strategic misstep or risk planned by senior leadership. How did you communicate this and influence the outcome?',
    tags: ['Leadership', 'Influence', 'Courage'],
  },
  {
    id: 'q16',
    category: 'Behavioral',
    title: 'Prioritizing Under Extreme Pressure',
    description: 'Describe a situation where multiple critical systems failed simultaneously or you faced competing urgent deadlines. How did you decide what to prioritize and what were the results?',
    tags: ['Pressure', 'Prioritization', 'Crisis Management'],
  },
  {
    id: 'q17',
    category: 'Behavioral',
    title: 'Leading Without Authority',
    description: 'Tell me about a time you led a cross-functional initiative where you had no direct authority over the team members. How did you align them toward a common goal?',
    tags: ['Collaboration', 'Influence', 'Teamwork'],
  }
];

let questionIndex: AnyOrama | null = null;

export async function initQuestionBank() {
  if (questionIndex) return questionIndex;
  
  questionIndex = await create({
    schema: {
      title: 'string',
      description: 'string',
      category: 'string',
      tags: 'string[]', // Orama supports arrays
    },
  });

  const docs = mockQuestionBank.map((q) => ({
    title: q.title,
    description: q.description,
    category: q.category,
    tags: q.tags,
    originalId: q.id,
  }));

  await insertMultiple(questionIndex, docs);
  return questionIndex;
}

export async function searchQuestions(term: string, categoryFilter?: string) {
  if (!questionIndex) {
    await initQuestionBank();
  }
  if (!questionIndex) return [];

  // If no term, just return a subset
  if (!term || term.trim() === '') {
    return mockQuestionBank.filter(q => categoryFilter ? q.category === categoryFilter : true);
  }

  const results = await search(questionIndex, {
    term,
    properties: ['title', 'description', 'tags'],
    limit: 10,
    tolerance: 1, // typo tolerance
  });

  // Extract from Orama hits
  const hits = results.hits.map((hit) => hit.document);
  
  // Re-map back to our type
  const matchedQuestions = hits.map((doc) => 
    mockQuestionBank.find(q => q.id === (doc as unknown as { originalId: string }).originalId)
  ).filter(Boolean) as InterviewQuestion[];

  if (categoryFilter) {
    return matchedQuestions.filter(q => q.category === categoryFilter);
  }

  return matchedQuestions;
}

export function getAllQuestions() {
  return mockQuestionBank;
}
