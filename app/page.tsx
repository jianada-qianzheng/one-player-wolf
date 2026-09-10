'use client';

import { useState, useRef } from 'react';
import { Player, Message, Phase } from '@/types/game';
import { GameEngine } from '@/lib/gameEngine';

export default function WolfGame() {
  // 初始化游戏引擎实例 (保留在组件状态或ref中)
  const [engine] = useState(() => new GameEngine([
    { id: '1', name: '你 (Player)', role: 'villager', isAI: false, isAlive: true },
    { id: '2', name: 'AI-小美', role: 'werewolf', isAI: true, isAlive: true },
    { id: '3', name: 'AI-老张', role: 'seer', isAI: true, isAlive: true },
    { id: '4', name: 'AI-小刚', role: 'villager', isAI: true, isAlive: true },
  ]));

  const [phase, setPhase] = useState<Phase>('night');
  const [players, setPlayers] = useState<Player[]>(engine.players);
  const [messages, setMessages] = useState<Message[]>([
    { sender: '系统', content: '游戏开始：当前是夜晚，请闭眼。你是村民。', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  // 开始白天讨论
  const startDay = async () => {
    engine.phase = 'discussion';
    setPhase('discussion');
    engine.startNewRound();
    setLoading(true);
    
    const openingMsg: Message = { sender: '系统', content: '天亮了，昨晚是平安夜。请大家开始讨论。', timestamp: Date.now() };
    const updatedMessages = [...messages, openingMsg];
    setMessages(updatedMessages);

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: { name: 'AI-老张', role: 'seer' },
          alivePlayers: engine.getAlivePlayers(),
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

  // 发送消息并调用 Groq AI
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { sender: '你', content: input, timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: { name: 'AI-老张', role: 'werewolf' },
          alivePlayers: engine.getAlivePlayers(),
          messages: nextMessages.map(m => ({
            role: m.sender === '你' ? 'user' : 'assistant',
            content: `${m.sender}: ${m.content}`
          }))
        })
      });

      const data = await res.json();
      const aiMsg: Message = { 
        sender: 'AI-老张', 
        content: data.text || '我觉得大家说得都有点道理，咱们准备投票吧。', 
        timestamp: Date.now() 
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 进入投票阶段
  const enterVotingPhase = () => {
    engine.phase = 'voting';
    setPhase('voting');
    setMessages(prev => [...prev, { sender: '系统', content: '进入投票阶段！请在右侧面板选择你想投出的玩家，然后点击确认投票。', timestamp: Date.now() }]);
  };

  // 提交投票并由 Game Engine 结算
  const submitVote = () => {
    if (!selectedTarget) {
      alert('请先在右侧面板点击选中你要投票的人！');
      return;
    }

    // 1. 记录你的投票
    engine.castVote('1', selectedTarget);

    // 2. 模拟 AI 随机投票（例如小美、小刚也进行投票）
    const aliveAIs = engine.getAlivePlayers().filter(p => p.isAI);
    aliveAIs.forEach(ai => {
      // 简单模拟：AI 随机投给场上除自己外的一个活着的玩家
      const otherPlayers = engine.getAlivePlayers().filter(p => p.id !== ai.id);
      const randomTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      if (randomTarget) {
        engine.castVote(ai.id, randomTarget.id);
      }
    });

    // 3. 调用引擎核心方法结算投票与胜负
    const result = engine.resolveVoting();

    // 4. 更新前端状态
    setPlayers([...engine.players]);
    setPhase(engine.phase);
    setMessages(prev => [
      ...prev, 
      { sender: '系统', content: result.summary, timestamp: Date.now() }
    ]);
  };

  return (
    <main className="flex h-screen bg-gray-900 text-white">
      {/* 左侧：聊天与互动区 */}
      <div className="flex-1 flex flex-col p-4 border-r border-gray-800">
        <header className="mb-4 flex justify-between items-center border-b border-gray-800 pb-2">
          <h1 className="text-xl font-bold">单人简易狼人杀 (Vercel / Next.js)</h1>
          <div className="flex gap-2 items-center">
            <span className="px-3 py-1 bg-blue-600 rounded text-sm">当前阶段: {phase}</span>
            {phase === 'discussion' && (
              <button onClick={enterVotingPhase} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm font-bold">
                发起投票
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${m.sender === '你' ? 'bg-blue-900 ml-auto max-w-[80%]' : 'bg-gray-800 max-w-[80%]'}`}>
              <span className="text-xs text-gray-400 block mb-1">{m.sender}</span>
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
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

        {phase === 'voting' && (
          <div className="flex flex-col gap-2 bg-gray-800 p-4 rounded-lg border border-purple-500">
            <p className="text-sm font-bold text-purple-300">请在右侧面板点击选择要投票淘汰的玩家，然后确认投票：</p>
            <button 
              onClick={submitVote} 
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold"
            >
              确认投票淘汰【{players.find(p => p.id === selectedTarget)?.name || '未选择'}】
            </button>
          </div>
        )}

        {phase === 'ended' && (
          <div className="p-3 bg-red-950 border border-red-500 rounded text-center font-bold text-red-300">
            游戏已结束！刷新页面可重新开始。
          </div>
        )}
      </div>

      {/* 右侧：玩家状态面板 */}
      <div className="w-80 p-4 bg-gray-950 flex flex-col gap-4">
        <h2 className="font-bold border-b border-gray-800 pb-2">存活状态与投票</h2>
        <p className="text-xs text-gray-400">
          {phase === 'voting' ? '👉 点击下方任意存活玩家进行投票锁定：' : '当前存活玩家列表：'}
        </p>
        {players.map(p => (
          <div 
            key={p.id} 
            onClick={() => {
              if (phase === 'voting' && p.isAlive) {
                setSelectedTarget(p.id);
              }
            }}
            className={`flex justify-between items-center p-3 rounded transition-all ${
              phase === 'voting' && p.isAlive ? 'cursor-pointer hover:bg-gray-800 border' : ''
            } ${selectedTarget === p.id ? 'border-purple-500 bg-purple-950/50' : 'bg-gray-900'}`}
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <span className="text-xs text-gray-500">{p.isAI ? 'AI 角色' : '人类玩家'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${p.isAlive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {p.isAlive ? '存活' : '已出局'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
