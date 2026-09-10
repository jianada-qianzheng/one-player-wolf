'use client';

import { useState } from 'react';
import { GameEngine } from '@/lib/gameEngine';

type Role = 'killer' | 'villager';
type Phase = 'night' | 'discussion_1' | 'discussion_2' | 'voting' | 'ended';

interface Player {
  id: string;
  name: string;
  role: Role;
  isAI: boolean;
  isAlive: boolean;
}

interface Message {
  sender: string;
  content: string;
  timestamp: number;
}

export default function WolfGame() {
  const [engine] = useState(() => new GameEngine());
  const [phase, setPhase] = useState<Phase>('night');
  const [players, setPlayers] = useState<Player[]>(engine.players as Player[]);
  const [messages, setMessages] = useState<Message[]>([
    { sender: '系统', content: '🎮 6人极简杀手局已就绪！\n【规则简化】夜晚盲狙 ➔ 第一轮发言 ➔ 第二轮发言 ➔ 直接投票处决！\n当前是夜晚，请点击下方按钮天黑闭眼。', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [roundCount, setRoundCount] = useState(1); // 1 代表第一轮发言，2 代表第二轮发言

  // 1. 开始白天，结算夜晚
  const startDay = async () => {
    setLoading(true);
    const victim = engine.nightAction();
    
    setPhase('discussion_1');
    setRoundCount(1);
    setPlayers([...engine.players] as Player[]);

    let nightMsg = '🌙 昨夜寒风凛冽，暗流涌动...\n';
    if (victim) {
      nightMsg += `💀 【第一夜惨案】天亮了！【${victim.name}】在睡梦中遭到了杀手的无情袭击，当场倒在血泊中，已直接淘汰出局！`;
    } else {
      nightMsg += `✨ 昨晚是个奇迹般的平安夜，无人遇害。`;
    }

    setMessages(prev => [
      ...prev,
      { sender: '系统', content: nightMsg, timestamp: Date.now() },
      { sender: '系统', content: '🔥 【第一轮讨论开始】请大家发言，分析昨晚死讯。你可以直接输入你的观点，AI 们也会依次回应。', timestamp: Date.now() }
    ]);
    setLoading(false);
  };

  // 2. 玩家发送发言
  const handleUserMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    const userMsg: Message = { sender: '你', content: userText, timestamp: Date.now() };
    let currentMessages = [...messages, userMsg];
    setMessages(currentMessages);

    setLoading(true);
    try {
      // 让活着的 AI 依次或随机插话回应
      const aliveAIs = engine.getAlivePlayers().filter(p => p.isAI);
      for (const ai of aliveAIs.slice(0, 3)) { // 随机选3个AI回应，保持节奏明快
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: { name: ai.name, role: ai.role },
            alivePlayers: engine.getAlivePlayers(),
            phase: phase,
            messages: currentMessages.map(m => ({
              role: m.sender === '你' ? 'user' : 'assistant',
              content: `${m.sender}: ${m.content}`
            }))
          })
        });

        const data = await res.json();
        const aiMsg: Message = {
          sender: ai.name,
          content: data.text || '我觉得大家要谨慎排查。',
          timestamp: Date.now()
        };
        currentMessages.push(aiMsg);
      }

      setMessages([...currentMessages]);

      // 检查是进入第二轮讨论还是直接进入投票
      if (phase === 'discussion_1') {
        setPhase('discussion_2');
        setRoundCount(2);
        setMessages(prev => [
          ...prev,
          { sender: '系统', content: '⚡ 【第二轮发言开始】大家请补充最后的线索或嫌疑人，发言结束后即将锁定投票！', timestamp: Date.now() }
        ]);
      } else if (phase === 'discussion_2') {
        // 两轮发言结束，直接跳转进投票环节！
        setPhase('voting');
        setMessages(prev => [
          ...prev,
          { sender: '系统', content: '🗳️ 【两轮发言完毕】讨论环节结束！请在右侧面板点击选中你要投票淘汰的目标，然后点击下方确认投票。', timestamp: Date.now() }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. 提交投票
  const submitVote = async () => {
    if (!selectedTarget) {
      alert('请先在右侧面板点击选中你要投票的人！');
      return;
    }

    setLoading(true);
    try {
      engine.castVote('1', selectedTarget);
      await engine.executeAIVotes(messages);
      const result = engine.resolveVoting();

      setPlayers([...engine.players] as Player[]);
      setPhase(engine.phase as Phase);
      setMessages(prev => [
        ...prev,
        { sender: '系统', content: result.summary, timestamp: Date.now() }
      ]);
      setSelectedTarget('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-gray-900 text-white">
      <div className="flex-1 flex flex-col p-4 border-r border-gray-800">
        <header className="mb-4 flex justify-between items-center border-b border-gray-800 pb-2">
          <h1 className="text-xl font-bold">6人极简杀手局 (两轮发言直接投票)</h1>
          <div className="flex gap-2 items-center">
            <span className="px-3 py-1 bg-blue-600 rounded text-sm">
              {phase === 'night' && '阶段: 夜晚降临'}
              {phase === 'discussion_1' && '阶段: 第一轮讨论'}
              {phase === 'discussion_2' && '阶段: 第二轮讨论'}
              {phase === 'voting' && '阶段: 投票处决'}
              {phase === 'ended' && '阶段: 游戏结束'}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${m.sender === '你' ? 'bg-blue-900 ml-auto max-w-[80%]' : 'bg-gray-800 max-w-[80%]'}`}>
              <span className="text-xs text-gray-400 block mb-1">{m.sender}</span>
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {loading && <div className="text-gray-500 text-sm italic">AI 正在思考回应中...</div>}
        </div>

        {phase === 'night' && (
          <button onClick={startDay} className="w-full py-3 bg-green-600 hover:bg-green-500 rounded font-bold text-lg">
            天黑请睁眼（开始第一轮讨论）
          </button>
        )}

        {(phase === 'discussion_1' || phase === 'discussion_2') && (
          <form onSubmit={handleUserMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`[第 ${roundCount} 轮] 输入你的发言看法（按发送后 AI 会集体回应并推进流程）...`}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none"
            />
            <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold disabled:opacity-50">
              发送并推进
            </button>
          </form>
        )}

        {phase === 'voting' && (
          <div className="flex flex-col gap-2 bg-gray-800 p-4 rounded-lg border border-purple-500">
            <p className="text-sm font-bold text-purple-300">🗳️ 投票决战：请在右侧面板点击选中你要淘汰的玩家，然后点击下方确认：</p>
            <button 
              onClick={submitVote} 
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded font-bold text-lg disabled:opacity-50"
            >
              确认投票淘汰【{players.find(p => p.id === selectedTarget)?.name || '未选择'}】
            </button>
          </div>
        )}

        {phase === 'ended' && (
          <div className="p-4 bg-red-950 border border-red-500 rounded text-center font-bold text-red-300 text-lg">
            🎉 游戏已分出胜负！刷新页面即可重新开始新的一局。
          </div>
        )}
      </div>

      <div className="w-80 p-4 bg-gray-950 flex flex-col gap-4">
        <h2 className="font-bold border-b border-gray-800 pb-2">6人存活状态</h2>
        <p className="text-xs text-gray-400">
          {phase === 'voting' ? '👉 点击下方任意存活玩家进行锁定：' : '当前存活状态表：'}
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
