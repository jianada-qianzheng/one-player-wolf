'use client';

import { useState } from 'react';
import { Player, Message, Phase, GameEngine } from '@/lib/gameEngine';

export default function WolfGame() {
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

  const startDay = async () => {
    engine.phase = 'discussion';
    setPhase('discussion');
    const openingMsg: Message = { sender: '系统', content: '天亮了，昨晚是平安夜。请大家按顺序开始讨论。', timestamp: Date.now() };
    setMessages(prev => [...prev, openingMsg]);
  };

  const processNextSpeaker = async (currentMessages: Message[]) => {
    const nextSpeaker = engine.getNextSpeaker();
    if (!nextSpeaker) return;

    if (!nextSpeaker.isAI) {
      setMessages(prev => [
        ...prev, 
        { sender: '系统', content: `轮到【${nextSpeaker.name}】发言了（可在输入框发言，或输入“投票”发起投票提议）。`, timestamp: Date.now() }
      ]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: { name: nextSpeaker.name, role: nextSpeaker.role },
          alivePlayers: engine.getAlivePlayers(),
          phase: engine.phase,
          messages: currentMessages.map(m => ({
            role: m.sender === '你' ? 'user' : 'assistant',
            content: `${m.sender}: ${m.content}`
          }))
        })
      });

      const data = await res.json();
      const aiMsg: Message = { 
        sender: nextSpeaker.name, 
        content: data.text || '我觉得大家要多注意发言。', 
        timestamp: Date.now() 
      };

      const updated = [...currentMessages, aiMsg];
      setMessages(updated);

      if (data.action === 'PROPOSE_VOTE') {
        engine.phase = 'voting_proposal';
        setPhase('voting_proposal');
        engine.resetProposal(nextSpeaker.name);
        setMessages(prev => [
          ...prev, 
          { sender: '系统', content: `💡 【提议投票】${nextSpeaker.name} 提议结束讨论并进入投票环节！正在征求全场意见...`, timestamp: Date.now() }
        ]);
        await handleProposalResponses(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProposalResponses = async (currentMessages: Message[]) => {
    const aliveAIs = engine.getAlivePlayers().filter(p => p.isAI);
    let workingMessages = [...currentMessages];

    setLoading(true);
    for (const ai of aliveAIs) {
      if (ai.name === engine.proposalState.proposer) continue;

      try {
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: { name: ai.name, role: ai.role },
            alivePlayers: engine.getAlivePlayers(),
            phase: 'voting_proposal',
            proposalState: engine.proposalState,
            messages: workingMessages.map(m => ({ role: 'user', content: `${m.sender}: ${m.content}` }))
          })
        });

        const data = await res.json();
        const isAgree = data.voteDecision === 'AGREE';
        engine.addProposalResponse(ai.name, isAgree);

        const aiMsg: Message = {
          sender: ai.name,
          content: `${isAgree ? '👍【同意投票】' : '👎【反对投票】'} ${data.text}`,
          timestamp: Date.now()
        };
        workingMessages.push(aiMsg);
        setMessages([...workingMessages]);
      } catch (err) {
        console.error(err);
      }
    }
    setLoading(false);

    const humanAlive = engine.getAlivePlayers().some(p => !p.isAI);
    if (humanAlive) {
      setMessages(prev => [
        ...prev,
        { sender: '系统', content: `👉 投票提议已发起！请你在下方点击【同意进入投票】或【反对并继续讨论】。`, timestamp: Date.now() }
      ]);
    }
  };

  const handleHumanProposalResponse = async (agree: boolean) => {
    engine.addProposalResponse('你 (Player)', agree);
    const respMsg: Message = {
      sender: '你',
      content: agree ? '👍 我同意进入投票。' : '👎 我反对，继续讨论。',
      timestamp: Date.now()
    };
    const updated = [...messages, respMsg];
    setMessages(updated);

    if (agree && engine.isProposalPassed()) {
      engine.phase = 'voting';
      setPhase('voting');
      setMessages(prev => [
        ...prev,
        { sender: '系统', content: '🎉 全员一致同意！正式进入【投票处决】环节，请在右侧选择你要淘汰的目标。', timestamp: Date.now() }
      ]);
    } else if (!agree || engine.isProposalFailed()) {
      engine.phase = 'discussion';
      setPhase('discussion');
      setMessages(prev => [
        ...prev,
        { sender: '系统', content: '❌ 提议未通过（有人反对），游戏继续回到日常讨论。', timestamp: Date.now() }
      ]);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || phase !== 'discussion') return;

    const isProposing = input.includes('投票');
    const userMsg: Message = { sender: '你', content: input, timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');

    if (isProposing) {
      engine.phase = 'voting_proposal';
      setPhase('voting_proposal');
      engine.resetProposal('你 (Player)');
      setMessages(prev => [
        ...prev,
        { sender: '系统', content: '💡 【提议投票】你提议结束讨论并进入投票环节！正在征求全场 AI 意见...', timestamp: Date.now() }
      ]);
      await handleProposalResponses(nextMessages);
    } else {
      await processNextSpeaker(nextMessages);
    }
  };

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

      setPlayers([...engine.players]);
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
      {/* 左侧：聊天与互动区 */}
      <div className="flex-1 flex flex-col p-4 border-r border-gray-800">
        <header className="mb-4 flex justify-between items-center border-b border-gray-800 pb-2">
          <h1 className="text-xl font-bold">单人狼人杀 (提议投票 + 全员表态制)</h1>
          <div className="flex gap-2 items-center">
            <span className="px-3 py-1 bg-blue-600 rounded text-sm">阶段: {phase}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${m.sender === '你' ? 'bg-blue-900 ml-auto max-w-[80%]' : 'bg-gray-800 max-w-[80%]'}`}>
              <span className="text-xs text-gray-400 block mb-1">{m.sender}</span>
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {loading && <div className="text-gray-500 text-sm italic">AI 正在思考发言中...</div>}
        </div>

        {/* 操作控制区 */}
        {phase === 'night' && (
          <button onClick={startDay} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded font-bold">
            天黑请睁眼（进入白天讨论）
          </button>
        )}

        {phase === 'discussion' && (
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="发言讨论（输入包含“投票”二字可发起投票提议）..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none"
            />
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold disabled:opacity-50">
              发送
            </button>
          </form>
        )}

        {phase === 'voting_proposal' && !loading && (
          <div className="flex gap-4 p-4 bg-gray-800 rounded-lg border border-yellow-500 items-center justify-between">
            <span className="text-sm text-yellow-300 font-bold">请对当前的投票提议做出抉择：</span>
            <div className="flex gap-2">
              <button 
                onClick={() => handleHumanProposalResponse(true)} 
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold"
              >
                👍 同意投票
              </button>
              <button 
                onClick={() => handleHumanProposalResponse(false)} 
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-bold"
              >
                👎 反对并继续讨论
              </button>
            </div>
          </div>
        )}

        {phase === 'voting' && (
          <div className="flex flex-col gap-2 bg-gray-800 p-4 rounded-lg border border-purple-500">
            <p className="text-sm font-bold text-purple-300">🗳️ 投票环节：请在右侧面板点击选择你要投出的玩家，然后确认：</p>
            <button 
              onClick={submitVote} 
              disabled={loading}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold disabled:opacity-50"
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
