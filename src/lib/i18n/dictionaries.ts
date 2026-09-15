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
    },
    // Phase 6 (V2): settings preferences. Wired to real stores
    // (LanguageContext + useAccessibilityStore); every key ships en+zh.
    settings: {
      language: "Language",
      languageDesc: "Interface language for translated surfaces. Interview room copy and AI prompts remain Chinese for now.",
      english: "English",
      chinese: "中文",
      accessibility: "Accessibility",
      accessibilityDesc: "These controls take effect immediately and persist on this device.",
      calmMode: "Calm mode",
      calmModeDesc: "Reduce motion and visual stimulation.",
      liveCaptions: "Live captions",
      liveCaptionsDesc: "Show real-time captions during interviews.",
      dyslexiaMode: "Dyslexia-friendly text",
      dyslexiaModeDesc: "Roomier, monospaced reading style in the interview room.",
      liveInsights: "Live AI estimates",
      liveInsightsDesc: "Show experimental STAR / behavioral / strain tiles during interviews. Off by default.",
      on: "On",
      off: "Off",
    },
    // Phase 9: interview-loop chrome. New surfaces must add both locales;
    // legacy hardcoded copy migrates incrementally (see UX_REPORT).
    interview: {
      turn: "Turn",
      difficultyEasy: "Easy",
      difficultyMedium: "Medium",
      difficultyHard: "Hard",
      difficultyExpert: "Expert",
      showAiEstimates: "Show live AI estimates",
      hideAiEstimates: "Hide live AI estimates",
      showAiEstimatesTitle: "Show live AI estimates (experimental)",
      hideAiEstimatesTitle: "Hide live AI estimates",
      experimental: "Experimental",
      aiEstimate: "AI estimate",
      strainCaption: "Heuristic from pauses & fillers — not a medical or emotional measure.",
      localOnly: "Local only",
      noVisualAnalysis: "No visual analysis. Video stays on this device and is never scored.",
      cameraRequesting: "Requesting camera access…",
      cameraOff: "Camera off. Interview works fully without video."
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
    },
    settings: {
      language: "语言",
      languageDesc: "已翻译界面的显示语言。面试房间文案与 AI 提示词暂保持中文。",
      english: "English",
      chinese: "中文",
      accessibility: "无障碍",
      accessibilityDesc: "以下开关立即生效，并保存在本设备上。",
      calmMode: "宁静模式",
      calmModeDesc: "减少动效与视觉刺激。",
      liveCaptions: "实时字幕",
      liveCaptionsDesc: "面试过程中显示实时字幕。",
      dyslexiaMode: "阅读辅助字体",
      dyslexiaModeDesc: "面试房间使用更疏朗的等宽阅读样式。",
      liveInsights: "实时 AI 评估",
      liveInsightsDesc: "面试中显示实验性的 STAR / 行为 / 负荷 tile。默认关闭。",
      on: "开",
      off: "关",
    },
    interview: {
      turn: "轮次",
      difficultyEasy: "简单",
      difficultyMedium: "中等",
      difficultyHard: "困难",
      difficultyExpert: "专家",
      showAiEstimates: "显示实时 AI 评估",
      hideAiEstimates: "隐藏实时 AI 评估",
      showAiEstimatesTitle: "显示实时 AI 评估（实验性）",
      hideAiEstimatesTitle: "隐藏实时 AI 评估",
      experimental: "实验性",
      aiEstimate: "AI 估计",
      strainCaption: "基于停顿与口头禅的启发式估计——不是医疗或情绪测量。",
      localOnly: "仅本地",
      noVisualAnalysis: "无视觉分析。视频不出本设备，不参与评分。",
      cameraRequesting: "正在请求摄像头权限…",
      cameraOff: "摄像头已关闭。不开视频也可完整面试。"
    }
  }
};

export type Language = 'en' | 'zh';
export type Dictionary = typeof dictionaries.en;
