import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRolePrompt } from '@/lib/prompts';

export async function POST(req) {
  try {
    const { character, messages, alivePlayers, phase, proposalState } = await req.json();

    const rolePrompt = getRolePrompt ? getRolePrompt(character.role, character.name, alivePlayers) : '';
    
    let systemPrompt = '';
    
    if (phase === 'voting_proposal') {
      systemPrompt = `
${rolePrompt}
【当前任务：对 ${proposalState?.proposer || '某玩家'} 提出的“立即进入投票环节”进行表态】
1. 局势判断：根据上面的讨论，如果大家还在扯皮或没有盘出东西，请选择【反对】；如果已经讨论得差不多了，请选择【同意】。
2. 格式要求：你的回复必须以 \`[AGREE]\` 或 \`[DISAGREE]\` 开头，后面紧跟一句话理由（字数在 20 到 50 字内，口语化，绝对不要出现 undefined）。
`;
    } else {
      systemPrompt = `
${rolePrompt}
【狼人杀铁律——绝对禁止复读和敷衍】：
1. **严禁复读废话**：绝对、严禁输出“我觉得大家说得都有点道理”、“再看看”、“我觉得这个人嫌疑很大”这种没有具体对象的空话！
2. **正面指名道姓**：如果别人问你“谁嫌疑大”或“为什么”，你必须**指名道姓地说是谁**（例如小美、老张或你），并编造一个像模像样的理由（如：“我觉得老张刚才发言吞吞吐吐，像是在给狼人挡刀”）。
3. **提议投票机制**：如果你觉得已经聊透了，想结束讨论进入投票，请在回复末尾加上 \`[ACTION: PROPOSE_VOTE]\`。
4. 字数控制在 40 到 90 字，口语化，像真人联机。
`;
    }

    const responseText = (await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: '请发表你的看法。' }],
    })).text;

    let action = null;
    let cleanText = responseText;
    let voteDecision = 'AGREE';

    if (phase === 'voting_proposal') {
      if (responseText.includes('[AGREE]')) {
        voteDecision = 'AGREE';
        cleanText = responseText.replace('[AGREE]', '').trim();
      } else if (responseText.includes('[DISAGREE]')) {
        voteDecision = 'DISAGREE';
        cleanText = responseText.replace('[DISAGREE]', '').trim();
      } else {
        // 如果没有包含标签，根据文本关键字智能判断
        if (responseText.includes('反对') || responseText.includes('不急') || responseText.includes('再看看')) {
          voteDecision = 'DISAGREE';
        } else {
          voteDecision = 'AGREE';
        }
      }
    } else {
      if (responseText.includes('[ACTION: PROPOSE_VOTE]')) {
        action = 'PROPOSE_VOTE';
        cleanText = responseText.replace('[ACTION: PROPOSE_VOTE]', '').trim();
      }
    }

    // 确保清理掉任何意外残留的标签
    cleanText = cleanText.replace(/\[AGREE\]|\[DISAGREE\]|\[ACTION: PROPOSE_VOTE\]/g, '').trim();

    return Response.json({ 
      text: cleanText || '我觉得大家要小心点。', 
      action,
      voteDecision
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 }, { text: '系统开小差了。' });
  }
}
