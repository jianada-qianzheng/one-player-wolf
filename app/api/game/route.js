import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRolePrompt } from '@/lib/prompts';

export async function POST(req) {
  try {
    const { character, messages, alivePlayers, phase, proposalState } = await req.json();

    const rolePrompt = getRolePropmp ? getRolePrompt(character.role, character.name, alivePlayers) : '';
    
    let systemPrompt = '';
    
    if (phase === 'voting_proposal') {
      systemPrompt = `
${rolePrompt}
【当前任务：对 ${proposalState.proposer} 提出的“立即进入投票环节”进行表态】
1. 必须明确表态：你的回复必须以 \`[AGREE]\` 或 \`[DISAGREE]\` 开头，后面紧跟一句话理由（字数在 30 到 60 字内，口语化）。
`;
    } else {
      systemPrompt = `
${rolePrompt}
【狼人杀高级玩家铁律——绝对禁止敷衍和复读】：
1. **禁止万能废话**：绝对、严禁输出“我觉得大家说得都有点道理”、“再看看”、“我觉得这个人嫌疑很大”这种没有具体指向的空洞废话！一旦出现此类废话判定违规。
2. **正面回答质问**：如果上一个发言或者历史消息里有人在质问你（例如问你“为什么”、“谁嫌疑大”），你必须**指名道姓地给出具体理由**（例如捏造对方刚才发言的逻辑漏洞、或者强行诬陷某人）。
3. **主动抛出攻击或防御**：你要么在攻击别人（如：“我刚才注意到XX发言支支吾吾，他绝对是狼”），要么在为自己辩护。
4. **提议投票机制**：如果你觉得已经盘清楚了，想结束讨论，可以在回复末尾加上 \`[ACTION: PROPOSE_VOTE]\`。
5. 字数控制在 40 到 90 字，口语化，像真人。
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
