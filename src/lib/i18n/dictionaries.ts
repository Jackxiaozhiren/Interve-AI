export const dictionaries = {
  en: {
    nav: {
      dashboard: "Dashboard",
      interview: "Interview",
      practice: "Practice",
      recruiter: "Recruiter Hub",
    },
    common: {
      search: "Search...",
      filter: "Filter",
      generateReport: "Generate Report",
      save: "Save",
      cancel: "Cancel",
    },
    recruiter: {
      commandCenter: "Recruiting Command Center",
      commandCenterDesc: "Macro-level insights and candidate pipeline management.",
      totalCandidates: "Total Candidates",
      avgMatchScore: "Avg Match Score",
      interviewsThisWeek: "Interviews This Week",
      pipelineConversion: "Pipeline Conversion",
      activeRoles: "Active Roles Distribution",
      recentCandidates: "Recent Candidates",
      smartParser: "Smart JD Parser",
      noCandidates: "No candidates match your search."
    },
    dashboard: {
      overview: "Overview.",
      overviewDesc: "Your telemetry and diagnostic readiness tracking at a glance.",
      clearHistory: "Clear History",
      newMock: "New Mock Interview",
      readinessScore: "Readiness Score",
      latestEval: "Latest Evaluation",
      growthTraj: "Growth Trajectory",
      skillBreakdown: "Skill Breakdown",
      qualitativeFeedback: "Qualitative Feedback",
      diagnosticReports: "Diagnostic Reports"
    }
  },
  zh: {
    nav: {
      dashboard: "仪表盘",
      interview: "面试",
      practice: "练习",
      recruiter: "招聘官中心",
    },
    common: {
      search: "搜索...",
      filter: "筛选",
      generateReport: "生成报告",
      save: "保存",
      cancel: "取消",
    },
    recruiter: {
      commandCenter: "招聘指挥中心",
      commandCenterDesc: "宏观洞察与候选人流转管理。",
      totalCandidates: "候选人总数",
      avgMatchScore: "平均匹配度",
      interviewsThisWeek: "本周面试数",
      pipelineConversion: "漏斗转化率",
      activeRoles: "活跃岗位分布",
      recentCandidates: "近期候选人",
      smartParser: "JD 智能解析",
      noCandidates: "没有找到符合条件的候选人。"
    },
    dashboard: {
      overview: "概览。",
      overviewDesc: "您近期的面试表现与诊断报告一览。",
      clearHistory: "清除记录",
      newMock: "新建模拟面试",
      readinessScore: "准备度得分",
      latestEval: "最近评估",
      growthTraj: "成长轨迹",
      skillBreakdown: "技能分解",
      qualitativeFeedback: "定性反馈",
      diagnosticReports: "诊断报告"
    }
  }
};

export type Language = 'en' | 'zh';
export type Dictionary = typeof dictionaries.en;
