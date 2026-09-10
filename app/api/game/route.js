import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRolePrompt } from '@/lib/prompts';

export async function POST(req) {
  try {
    const { character, messages, alivePlayers, phase, proposalState } = await req.json();

    const rolePrompt = getRolePrompt(character.role, character.name, alivePlayers);
    
    let systemPrompt = '';
    
    if (phase === 'voting_proposal') {
      // 处于投票提议表态阶段
      systemPrompt = `
${rolePrompt}
【当前任务：对 ${proposalState.proposer} 提出的“立即进入投票环节”进行表态】
1. **严格无上帝视角**：根据当前的讨论局势，判断现在是应该立刻投票，还是应该继续盘逻辑。
2. **必须明确表态**：你必须选择【同意】或者【反对】进入投票。
3. **格式要求**：你的回复必须以 \`[AGREE]\` 或 \`[DISAGREE]\` 开头，后面紧跟一句话理由（字数在 30 到 60 字内，口语化）。例如：\`[AGREE] 大家都聊得差不多了，快投票吧。\`
`;
    } else {
      // 正常讨论阶段
      systemPrompt = `
${rolePrompt}
【核心铁律】：
1. **绝对禁止复读废话**：严禁使用“我觉得大家说得都有点道理”、“再看看”！必须尖锐指出某人的嫌疑或进行防御。
2. **提议投票机制**：如果你认为局势已经明朗、不需要再废话了，你可以在发言末尾加上 \`[ACTION: PROPOSE_VOTE]\` 来号召大家开始投票。如果觉得还要继续聊，则不加。
3. 字数控制在 40 到 90 字，口语化。
`;
    }

    const responseText = (await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: '请发表你的看法。' }],
    })).text;

    let action = null;
    let cleanText = responseText;
    let voteDecision = null;

    if (phase === 'voting_proposal') {
      if (responseText.includes('[AGREE]')) {
        voteDecision = 'AGREE';
        cleanText = responseText.replace('[AGREE]', '').trim();
      } else if (responseText.includes('[DISAGREE]')) {
        voteDecision = 'DISAGREE';
        cleanText = responseText.replace('[DISAGREE]', '').trim();
      } else {
        // 默认兜底为同意
        voteDecision = 'AGREE';
      }
    } else {
      if (responseText.includes('[ACTION: PROPOSE_VOTE]')) {
        action = 'PROPOSE_VOTE';
        cleanText = responseText.replace('[ACTION: PROPOSE_VOTE]', '').trim();
      }
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
