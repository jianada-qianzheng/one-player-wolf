'use client';

import { useState } from 'react';
import { Player, Message, Phase } from '@/types/game';

export default function WolfGame() {
  const [phase, setPhase] = useState<Phase>('night');
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: '你 (Player)', role: 'villager', isAI: false, isAlive: true },
    { id: '2', name: 'AI-小美', role: 'werewolf', isAI: true, isAlive: true },
    { id: '3', name: 'AI-老张', role: 'seer', isAI: true, isAlive: true },
    { id: '4', name: 'AI-小刚', role: 'villager', isAI: true, isAlive: true },
  ]);
  const [messages, setMessages] = useState<Message[]>([
    { sender: '系统', content: '游戏开始：当前是夜晚，请闭眼。你是村民。', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // 开始白天讨论
  const startDay = async () => {
    setPhase('discussion');
    setLoading(true);
    
    const openingMsg: Message = { sender: '系统', content: '天亮了，昨晚是平安夜。请大家开始讨论。', timestamp: Date.now() };
    const updatedMessages = [...messages, openingMsg];
    setMessages(updatedMessages);

    // 让 AI-老张率先登场发言
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: { name: 'AI-老张', role: 'werewolf' }, // 让老张当狼人试试
          alivePlayers: players.filter(p => p.isAlive),
          messages: updatedMessages.map(m => ({
            role: m.sender === '你' ? 'user' : 'assistant',
            content: `${m.sender}: ${m.content}`
          }))
        })
      });

      const data = await res.json();
      const aiReply: Message = { 
        sender: 'AI-老张', 
        content: data.text || '大家早上好，昨晚平安夜，我们仔细盘盘逻辑吧。', 
        timestamp: Date.now() 
      };
      
      setMessages(prev => [...prev, aiReply]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 发送消息并调用真实 AI 接口
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { sender: '你', content: input, timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      // 真实调用后端 API，把完整对话历史传给 Groq
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: { name: 'AI-老张', role: 'werewolf' },
          alivePlayers: players.filter(p => p.isAlive),
          messages: nextMessages.map(m => ({
            role: m.sender === '你' ? 'user' : 'assistant',
            content: `${m.sender}: ${m.content}`
          }))
        })
      });

      const data = await res.json();
      
      const aiMsg: Message = { 
        sender: 'AI-老张', 
        content: data.text || '我觉得大家说得都有点道理，再看看。', 
        timestamp: Date.now() 
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-gray-900 text-white">
      {/* 左侧：聊天与互动区 */}
      <div className="flex-1 flex flex-col p-4 border-r border-gray-800">
        <header className="mb-4 flex justify-between items-center border-b border-gray-800 pb-2">
          <h1 className="text-xl font-bold">单人简易狼人杀 (Vercel / Next.js)</h1>
          <span className="px-3 py-1 bg-blue-600 rounded text-sm">当前阶段: {phase}</span>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${m.sender === '你' ? 'bg-blue-900 ml-auto max-w-[80%]' : 'bg-gray-800 max-w-[80%]'}`}>
              <span className="text-xs text-gray-400 block mb-1">{m.sender}</span>
              <p className="text-sm">{m.content}</p>
            </div>
          ))}
          {loading && <div className="text-gray-500 text-sm italic">AI 正在思考发言...</div>}
        </div>

        {/* 操作控制区 */}
        {phase === 'night' && (
          <button onClick={startDay} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded font-bold">
            天黑请睁眼（进入白天）
          </button>
        )}

        {phase === 'discussion' && (
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入你的发言/辩解..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold">
              发送
            </button>
          </form>
        )}
      </div>

      {/* 右侧：玩家状态面板 */}
      <div className="w-72 p-4 bg-gray-950 flex flex-col gap-4">
        <h2 className="font-bold border-b border-gray-800 pb-2">存活状态</h2>
        {players.map(p => (
          <div key={p.id} className="flex justify-between items-center bg-gray-900 p-3 rounded">
            <div>
              <p className="font-medium">{p.name}</p>
              <span className="text-xs text-gray-500">{p.isAI ? 'AI 角色' : '人类玩家'}</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${p.isAlive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {p.isAlive ? '存活' : '出局'}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
