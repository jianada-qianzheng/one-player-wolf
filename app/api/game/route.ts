import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { rolePrompt, history } = await req.json();

  // 每个 AI 拥有独立的系统提示词（决定它的性格和狼人/好人立场）
  const response = await generateText({
    model: openai('gpt-4o-mini'),
    system: `你正在玩一个单人狼人杀游戏。${rolePrompt}。请保持口语化，不要长篇大论，像真实玩家一样说话。`,
    messages: history,
  });

  return Response.json({ text: response.text });
}
