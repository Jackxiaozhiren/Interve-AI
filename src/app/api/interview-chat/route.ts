import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

const zhipu = createOpenAI({
  // @ts-expect-error - compatibility parameter is not officially supported by OpenAI types but needed for Zhipu
  compatibility: 'compatible',
  baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  apiKey: process.env.ZHIPU_API_KEY,
  fetch: async (url, options) => {
    if (options?.body && typeof options.body === 'string') {
      const body = JSON.parse(options.body);
      if (body.model === 'glm-4.7-flash') {
        body.thinking = { type: 'enabled' };
        body.max_tokens = 65536;
      }
      options.body = JSON.stringify(body);
    }
    return fetch(url, options);
  }
});

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, context, codeContext, systemDesignContext, role, level, persona, stressTest, setupContext, framework, company, resumeText, cognitiveLoad, starProgress, behavioralTraits, model } = await req.json();

    if (!messages) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const currentRole = role || "Software Engineer";
    const currentLevel = level || "Mid-Level";
    const currentPersona = persona || "professional";
    const currentSetupContext = setupContext || "";

    // Model selection logic
    let selectedModel;
    if (model === 'openai') {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      selectedModel = openai.chat('gpt-4o');
    } else if (model === 'gemini') {
      const { google } = await import('@ai-sdk/google');
      selectedModel = google('models/gemini-1.5-pro');
    } else {
      selectedModel = zhipu.chat("glm-4.7-flash");
    }

    // Context Compression: truncate long inputs to prevent token overflow
    const maxTextLength = 8000;
    const safeTruncate = (str: string) => str?.length > maxTextLength ? str.substring(0, maxTextLength) + "\n...[Content truncated due to length limits]" : str;

    const currentResumeText = safeTruncate(resumeText || "");
    const safeCodeContext = safeTruncate(codeContext || "");
    const safeSystemDesignContext = safeTruncate(systemDesignContext || "");
    const safeContext = safeTruncate(context || "");
    
    // Message Compression: retain only the most recent N messages (e.g., 20) to save context window
    const recentMessages = messages.length > 20 ? messages.slice(-20) : messages;

    const personaMapping: Record<string, string> = {
      professional: "专业严谨，注重逻辑、条理和系统性架构思维",
      friendly: "平易近人，善于鼓励和引导候选人展现真实实力",
      stress: "严肃苛刻，进行高压测试，喜欢连环追问底层细节和边界情况",
      visionary: "高瞻远瞩，关注宏观视野、技术趋势和业务商业价值",
      supportive: "支持型导师，温和且鼓励人，侧重于引导出候选人的思考过程",
      technical: "技术狂魔，深挖系统设计、架构原理和极端的边缘情况",
      aggressive: "极其高压，咄咄逼人，喜欢打断并质疑一切假设"
    };

    const personaTrait = personaMapping[currentPersona] || personaMapping.professional;
    const isStress = stressTest === true;

    let systemPrompt = `你是顶级大厂的面试官天团（Panel Interview）。你目前正在面试一位申请【${currentLevel} ${currentRole}】职位的候选人。你将根据对话上下文扮演三位不同的面试官：
1. [Tech] (技术主�?：专门深挖代码细节、系统设计、架构瓶颈和边界情况�?2. [HR] (HR总监)：专门考察软技能、文化匹配度、职业规划、团队协作�?3. [Product] (产品经理)：专门考察业务理解、需求拆解、产品思维、用户体验�?
【严格规定】：每次你的回复必须且只能由其中最适合接话的一位面试官发言。并且，你必须在回复的最开头使�?[Tech]、[HR] �?[Product] 标签明确标明你的身份！例如：
"[Tech] 你的架构里如果有单点故障怎么办？"

候选人的背景经历补充上下文参考：\n${safeContext ? safeContext + '\n' : ''}${currentSetupContext ? currentSetupContext + '\n' : ''}${currentResumeText ? '候选人的简历内容：\n' + currentResumeText + '\n' : ''}${safeCodeContext ? '\n目前候选人正在技术沙盘中编写的代码：\n\`\`\`\n' + safeCodeContext + '\n\`\`\`\n如果你要考察代码能力，请结合上面的代码片段指出不足、要求分析复杂度或进行技术探讨。\n' : ''}${safeSystemDesignContext ? '\n目前候选人正在系统设计面板中绘制的系统架构(文本特征)：\n\`\`\`text\n' + safeSystemDesignContext + '\n\`\`\`\n如果你要考察系统设计能力，请结合上面的架构特征指出缺陷、单点故障、可扩展性瓶颈，或进行深度的架构探讨。\n' : ''}${(!safeContext && !currentSetupContext && !safeCodeContext && !safeSystemDesignContext && !currentResumeText) ? '暂无特别背景，请进行常规的专业沟通' : ''}

核心指令：1. 候选人正在进行视频面试。你的沟通风格必须展现出【${personaTrait}】的特点。${isStress ? "2. 【警告：当前为FAANG顶级压力测试模式】你必须极度苛刻、挑剔且缺乏耐心。如果候选人回答啰嗦、跑题，或者逻辑有漏洞，请以尖锐的口吻立刻打断，或者抛出更难的边界情况（edge cases）追问。绝不给候选人喘息的机会！" : "2. 绝对不要长篇大论，每次输出只给出一个核心追问或简短反馈（字数控制在50字以内，越像人类口语越好）。"}
3. 不要使用列表、Markdown，像真实人类一样自然地对话。4. 针对候选人应聘的职位（${role}）和级别（${level}）进行深度提问。`;

    if (framework === "star" || framework === "behavioral") {
      systemPrompt += `\n5. 【强制执�?STAR 面试法】你必须要求候选人严格按照 STAR 框架 (Situation情境, Task任务, Action行动, Result结果) 详细回答�?- 在候选人回答完后，你必须在心里快速核对是否包含了 S、T、A、R 四个完整要素。`;
      
      if (starProgress) {
        systemPrompt += `\n\n【系统监控提示：目前候选人回答�?STAR 完整度如�?(0-100)】\n- 情境 (S): ${starProgress.s.progress}% (置信�? ${starProgress.s.confidence}%, 耗时: ${starProgress.s.timeSpentSeconds}s)\n- 任务 (T): ${starProgress.t.progress}% (置信�? ${starProgress.t.confidence}%, 耗时: ${starProgress.t.timeSpentSeconds}s)\n- 行动 (A): ${starProgress.a.progress}% (置信�? ${starProgress.a.confidence}%, 耗时: ${starProgress.a.timeSpentSeconds}s)\n- 结果 (R): ${starProgress.r.progress}% (置信�? ${starProgress.r.confidence}%, 耗时: ${starProgress.r.timeSpentSeconds}s)\n\n`;
        
        // Dynamically add prompts based on the missing components
        if (starProgress.s.progress < 50) {
          systemPrompt += `- 候选人**极度缺乏情境(S)**，请首先犀利追问："能提供更多关于当时的背景信息吗？当时面临的约束或难点是什么？"\n`;
        } else if (starProgress.t.progress < 50) {
          systemPrompt += `- 候选人**极度缺乏任务(T)**，请追问�?在这个情境中，你个人的核心目标或职责到底是什么？"\n`;
        } else if (starProgress.a.progress < 50) {
          systemPrompt += `- 候选人**极度缺乏行动(A)**，请深挖�?你具体采取了哪些步骤来实现这个目标？请分享你个人的技术或管理决策细节，不要只谈团队�?\n`;
        } else if (starProgress.r.progress < 50) {
          systemPrompt += `- 候选人**极度缺乏结果(R)**，请强烈要求数据�?这个行动最终的量化结果是什么？产生了什么业务价值或数据提升？你从中复盘学到了什么？"\n`;
        } else {
          systemPrompt += `- 候选人�?STAR 结构已经比较完整。你可以追问一些反思性问题，例如�?如果让你重新做一次，你会怎么改进�? 或者针对技术细节进行深挖。\n`;
        }
        systemPrompt += `\n【重要要求】：请查阅对话历史，如果你上一�?*刚刚问过**同样缺失的环节（例如上一轮刚问了结果，而当前R分数依旧低）�?*请绝对避�?*机械重复同样的问题！如果发现重复，请采用更柔和、不同角度的引导，或者先肯定对方的回答再顺水推舟提出深挖，切勿像机器人一样复读。另外，如果已经针对同一个缺失环节追问过2次但候选人仍未给出有效信息，请暂时放弃该环节，转而推进面试的其他部分，以免面试陷入僵局。`;
      } else {
        systemPrompt += `\n- 如果**缺少情境(S)**，请追问�?能提供更多关于当时的背景信息吗？当时面临的约束或难点是什么？"
- 如果**缺少任务(T)**，请追问�?在这个情境中，你个人的核心目标或职责到底是什么？"
- 如果**缺少行动(A)**（或者行动描述过于泛泛），请追问�?你具体采取了哪些步骤来实现这个目标？请分享你个人的技术或管理决策细节�?
- 如果**缺少结果(R)**，请强烈追问�?这个行动最终的量化结果是什么？产生了什么业务价值或数据提升？你从中复盘学到了什么？"`;
      }
      
      systemPrompt += `\n- 注意：不要一次性抛出多个问题，每次只针�?*最缺失的一个环�?*进行自然但犀利的追问。`;
    } else {
      systemPrompt += `\n5. 如果提出行为面试问题（考察过往经验），请顺其自然地引导候选人采用结构化方式作答。`;
    }

    if (behavioralTraits) {
      systemPrompt += `\n\n【实时软技能评估反�?(0-100)】\n- 领导�?(Leadership): ${behavioralTraits.leadership}\n- 解决问题 (Problem Solving): ${behavioralTraits.problemSolving}\n- 沟通表�?(Communication): ${behavioralTraits.communication}\n`;
      
      const weakTraits = [];
      if (behavioralTraits.leadership < 40) weakTraits.push("领导�?Leadership)");
      if (behavioralTraits.problemSolving < 40) weakTraits.push("解决问题能力(Problem Solving)");
      if (behavioralTraits.communication < 40) weakTraits.push("沟通表�?Communication)");

      if (weakTraits.length > 0) {
        systemPrompt += `\n【高级行为学追踪指示】：\n候选人目前在 ${weakTraits.join('、')} 维度表现较弱（得分 < 40）。作为面试官，你需要在接下来的对话中，**非常自然且隐蔽地**穿插对这些薄弱维度的考察，切忌生硬地切换话题！你可以：
- 针对【领导力】：追问在出现技术分歧或进度延期时，候选人是如何主动站出来推动共识、带领团队破局的。
- 针对【解决问题能力】：深挖候选人遇到过的最棘手的线上故障或架构死胡同，要求其详细拆解当时的排查思路和破局点。
- 针对【沟通表达】：如果候选人表述不清，故意抛出一个模糊的业务需求，测试候选人是否会主动向你（面试官）澄清需求细节。
【防机械重复警告】：查阅之前的对话记录，如果你刚才已经针对某个软技能（如领导力）进行了深度追问，但分数还没更新，**绝对不要再次重复提问**。必须换一个角度，或暂时回到专业技术的探讨上。`;
      }
    }

    if (company === "amazon" || framework === "amazon_lps") {
      systemPrompt += `\n6. 【重点考察亚马逊领导力原则(Amazon LPs)】你需要特别关注候选人在回答中是否体现了诸如“Customer Obsession(客户至上)”、“Ownership(主人翁精�?”、“Dive Deep(刨根问底)”等核心品质，并针对这些特质进行深度追问。`;
    } else if (company === "google" || framework === "google_googliness") {
      systemPrompt += `\n6. 【重点考察Google Googliness】你需要特别关注候选人在回答中是否体现了拥抱模糊�?Thrive in Ambiguity)、做正确的事(Do the right thing)以及对反馈的开放态度，并针对这些特质进行深度追问。`;
    } else if (company === "startup" || framework === "startup_scrappiness") {
      systemPrompt += `\n6. 【重点考察初创公司特质(Start-up Scrappiness)】你需要特别关注候选人是否表现出极强的偏向行动(Bias for action)、从0�?的构建能�?0 to 1 builder)以及极端的责任感(Extreme ownership)，并针对这些特质进行深度追问。`;
    } else if (company === "meta") {
      systemPrompt += `\n6. 【重点考察Meta极客文化】你需要特别关注候选人的执行力(Move Fast)、解决问题的速度以及其技术栈深度，并针对系统设计的可扩展性进行深度追问。`;
    }

    const currentCognitiveLoad = cognitiveLoad || 0;
    
    // Dynamic Strategy Based on Cognitive Load
    if (currentCognitiveLoad > 80) {
      systemPrompt += "\n\n【系统警告：检测到候选人认知负荷极高（极度紧张、卡壳）。作为专业面试官，你现在必须改变策略：使用更温和的语气，主动给出微小的提示(Hint)，或者引导他们拆解问题，绝不可再咄咄逼人。】";
    } else if (currentCognitiveLoad > 60) {
      systemPrompt += "\n\n【系统提示：候选人认知负荷偏高。请放慢追问节奏，可以用肯定性的语言鼓励候选人继续思考。】";
    } else if (currentCognitiveLoad < 30) {
      systemPrompt += "\n\n【系统提示：候选人当前极其放松。你必须加大压力，追问更底层的技术细节或更极端的边界条件，测试其技术深度极限。】";
    }

    // Try-catch block specifically for model fallback mechanism
    try {
      const startTime = performance.now();
      const result = await streamText({
        model: selectedModel,
        system: systemPrompt,
        messages: recentMessages,
        abortSignal: req.signal,
      });
      
      const response = result.toTextStreamResponse();
      const endTime = performance.now();
      console.log(`[Performance] AI Chat Response took ${(endTime - startTime).toFixed(2)}ms for model ${model || 'zhipu'}`);
      
      response.headers.set('X-Response-Time', `${(endTime - startTime).toFixed(2)}ms`);
      return response;
    } catch (primaryError) {
      console.warn(`Primary model ${model || 'zhipu'} failed, falling back to glm-4-flash`, primaryError);
      const fallbackStartTime = performance.now();
      // Fallback model
      const fallbackResult = await streamText({
        model: zhipu.chat("glm-4-flash"),
        system: systemPrompt,
        messages: recentMessages,
        abortSignal: req.signal,
      });
      const response = fallbackResult.toTextStreamResponse();
      const fallbackEndTime = performance.now();
      console.log(`[Performance] Fallback AI Chat Response took ${(fallbackEndTime - fallbackStartTime).toFixed(2)}ms`);
      response.headers.set('X-Response-Time', `${(fallbackEndTime - fallbackStartTime).toFixed(2)}ms`);
      return response;
    }
  } catch (error) {
    console.error("Error in interview chat:", error);
    return NextResponse.json(
      { error: "Failed to generate interview chat" },
      { status: 500 }
    );
  }
}
