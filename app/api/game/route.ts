import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const { rolePrompt, history } = await req.json();

    // 使用 Groq 的高速推理模型
    const response = await generateText({
      model: groq('llama-3.3-70b-versatile'), 
      system: `你正在玩一个单人狼人杀游戏。${rolePrompt}。请保持口语化，不要长篇大论，像真实玩家一样说话。`,
      messages: history,
    });

    return Response.json({ text: response.text });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
