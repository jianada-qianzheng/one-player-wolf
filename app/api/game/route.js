import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRolePrompt } from '@/lib/prompts';

export async function POST(req) {
  try {
    const { character, messages, alivePlayers, phase } = await req.json();

    const rolePrompt = getRolePrompt(character.role, character.name, alivePlayers);
    
    const systemPrompt = `
${rolePrompt}

【绝命铁律——绝对禁止 AI 敷衍】：
1. **严禁复读废话**：绝对、严禁使用“我觉得大家说得都有点道理”、“再看看”、“局势还不明朗”这种万能混子句式！一旦检测到此类废话将被直接判负。
2. **必须有攻击性或立场**：你必须根据前面的聊天记录，**点名批评某个人**、指出某个人的逻辑漏洞、或者强行带节奏说谁像狼。
3. **无上帝视角**：你只知道自己是谁，不知道别人身份。
4. **自主推进投票**：如果你觉得大家已经吵得差不多了，或者有人提议投票，请在回复结尾加上 \`[ACTION: ENTER_VOTING]\`。如果觉得还要继续盘逻辑，则不加。
5. 字数控制在 40 到 90 字，口语化，像真人联机。
`;

    const responseText = (await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: '请发表你的看法。' }],
    })).text;

    const shouldVote = responseText.includes('[ACTION: ENTER_VOTING]');
    const cleanText = responseText.replace('[ACTION: ENTER_VOTING]', '').trim();

    return Response.json({ 
      text: cleanText, 
      action: shouldVote ? 'ENTER_VOTING' : null 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
