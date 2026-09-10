import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export async function POST(req) {
  try {
    const { character, messages, alivePlayers, phase, proposalState } = await req.json();

    let systemPrompt = '';
    const aliveListStr = alivePlayers.map(p => p.name).join('、');

    if (phase === 'voting_proposal') {
      systemPrompt = `
你正在玩 6 人极简杀手局。你的名字是 ${character.name}，身份是 ${character.role === 'killer' ? '暗中潜伏的杀手' : '普通平民'}。
当前提议：${proposalState?.proposer || '某玩家'} 提议立刻结束讨论并进入投票环节。
场上存活：${aliveListStr}
任务：决定是否同意投票。
格式要求：必须以 \`[AGREE]\` 或 \`[DISAGREE]\` 开头，后面紧跟一句 20-40 字口语化理由（例如：\`[AGREE] 已经盘得差不多了，快投票吧。\`）。绝对不要输出 undefined。
`;
    } else {
      systemPrompt = `
你正在玩 6 人极简杀手局（1个杀手，5个平民）。你的名字是 ${character.name}。
场上存活玩家：${aliveListStr}

【核心行为准则——严禁复读和敷衍】：
1. **绝对禁止复读空话**：严禁说“我觉得大家要多注意发言”、“再看看”这类废话！
2. **针锋相对**：如果别人怀疑你，你必须反咬回去或极力自证；如果你在盘逻辑，必须点名道姓指控某人（如：“我觉得小美刚才的发言非常像杀手在带节奏”）。
3. **字数与风格**：30 到 70 字，口语化，像真人联机开黑。
4. **提议投票**：如果你觉得已经吵够了、想投票，可以在结尾加上 \`[ACTION: PROPOSE_VOTE]\`。
`;
    }

    const responseText = (await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: '发表你的看法。' }],
    })).text;

    let action = null;
    let cleanText = responseText;
    let voteDecision = 'AGREE';

    if (phase === 'voting_proposal') {
      if (responseText.includes('反对') || responseText.includes('不急') || responseText.includes('DISAGREE')) {
        voteDecision = 'DISAGREE';
        cleanText = responseText.replace(/\[DISAGREE\]|DISAGREE/g, '').trim();
      } else {
        voteDecision = 'AGREE';
        cleanText = responseText.replace(/\[AGREE\]|AGREE/g, '').trim();
      }
    } else {
      if (responseText.includes('[ACTION: PROPOSE_VOTE]')) {
        action = 'PROPOSE_VOTE';
        cleanText = responseText.replace('[ACTION: PROPOSE_VOTE]', '').trim();
      }
    }

    // 后端防废读兜底过滤
    if (!cleanText || cleanText.includes('多注意发言') || cleanText.includes('undefined')) {
      const fallbackList = [
        '你这么急着转移话题，我看你才是藏在好人堆里的杀手吧！',
        '大家别被他带节奏了，我觉得他刚才的发言漏洞百出。',
        '死的人越多越要冷静，我看小美和小刚现在的反应都很可疑。'
      ];
      cleanText = fallbackList[Math.floor(Math.random() * fallbackList.length)];
    }

    return Response.json({ 
      text: cleanText, 
      action,
      voteDecision
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
