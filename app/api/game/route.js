import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { getRolePrompt, buildAISpeechPrompt } from '@/lib/prompts';

export async function POST(req) {
  try {
    const { character, gameHistory, alivePlayers } = await req.json();

    // 1. 获取该角色专属的动态提示词
    const rolePrompt = getRolePrompt(character.role, character.name, alivePlayers);
    
    // 2. 构造完整的 AI 提示词上下文
    const systemPrompt = buildAISpeechPrompt({ ...character, systemPrompt: rolePrompt }, gameHistory);

    // 3. 调用 Groq 高速模型生成 AI 发言
    const response = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: [{ role: 'user', content: '请开始你的发言。' }],
    });

    return Response.json({ text: response.text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
