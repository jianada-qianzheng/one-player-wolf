import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRolePrompt } from '@/lib/prompts';

export async function POST(req) {
  try {
    const { character, messages, alivePlayers, phase } = await req.json();

    const rolePrompt = getRolePrompt(character.role, character.name, alivePlayers);
    
    const systemPrompt = `
${rolePrompt}

【核心行为准则（极度重要）】：
1. **严格无上帝视角**：你只知道自己的身份和生死状态，你完全不知道别人是好人还是狼人！你的所有怀疑或信任，必须且只能基于上面的聊天记录。
2. **严禁废话复读**：绝对不允许使用“我觉得大家说得都有点道理，再看看”这种混子敷衍词。
3. **自主评估讨论节奏**：如果你（或大家在聊天中）觉得已经把逻辑盘得差不多了，或者有人提议结束讨论、准备投票，你可以在你的发言结尾加上一个特殊控制指令：\`[ACTION: ENTER_VOTING]\`。如果觉得还要继续盘，就正常发言，**不要**加该指令。
4. 语言口语化，像真人玩桌游，字数控制在 40 到 100 字左右。
`;

    const responseText = (await generateText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: '请发表你的看法。' }],
    })).text;

    // 检查 AI 是否发出了进入投票的指令
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
