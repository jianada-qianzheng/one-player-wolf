import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export class GameEngine {
  constructor(initialPlayers) {
    this.players = initialPlayers;
    this.phase = 'night';
    this.currentSpeakerIndex = 0;
    this.votes = new Map();
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  // 严格按照座位顺序获取下一个发言者（包括人类和AI）
  getNextSpeaker() {
    const alive = this.getAlivePlayers();
    if (alive.length === 0) return null;
    const speaker = alive[this.currentSpeakerIndex % alive.length];
    this.currentSpeakerIndex++;
    return speaker;
  }

  castVote(voterId, targetId) {
    this.votes.set(voterId, targetId);
  }

  async executeAIVotes(messages) {
    const aliveAIs = this.getAlivePlayers().filter(p => p.isAI);
    
    for (const ai of aliveAIs) {
      try {
        const otherPlayers = this.getAlivePlayers().filter(p => p.id !== ai.id);
        const playerListStr = otherPlayers.map(p => `- ID: ${p.id}, 名字: ${p.name}`).join('\n');

        const prompt = `
你正在玩狼人杀。你的名字是：${ai.name}，身份是：${ai.role}（无上帝视角）。
当前候选目标：
${playerListStr}

近期发言：
${messages.slice(-8).map(m => `${m.sender}: ${m.content}`).join('\n')}

请根据上述发言，选出你认为最可疑的一个人进行投票。
必须严格输出格式正确的 JSON，不要有多余废话：
{"targetId": "目标ID", "reason": "理由"}
`;

        const res = (await generateText({
          model: groq('llama-3.1-8b-instant'),
          system: "你是一个狼人杀玩家，请秘密投票，严格只输出 JSON。",
          prompt: prompt,
        })).text;

        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const voteData = JSON.parse(jsonMatch[0]);
          if (voteData.targetId && otherPlayers.some(p => p.id === voteData.targetId)) {
            this.castVote(ai.id, voteData.targetId);
            continue;
          }
        }
        
        const fallbackTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        if (fallbackTarget) {
          this.castVote(ai.id, fallbackTarget.id);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  resolveVoting() {
    const voteCounts = new Map();
    this.votes.forEach((targetId) => {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    });

    let maxVotes = 0;
    let eliminatedId = null;
    voteCounts.forEach((count, targetId) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = targetId;
      }
    });

    let eliminatedPlayer = null;
    if (eliminatedId) {
      const player = this.players.find(p => p.id === eliminatedId);
      if (player) {
        player.isAlive = false;
        eliminatedPlayer = player;
      }
    }

    this.votes.clear();

    const survivingWolves = this.getAlivePlayers().filter(p => p.role === 'werewolf');
    const survivingGoodGuys = this.getAlivePlayers().filter(p => p.role !== 'werewolf');

    let summary = `🗳️ 【投票结果揭晓】\n`;
    if (eliminatedPlayer) {
      summary += `• ${eliminatedPlayer.name} 淘汰！身份是：【${eliminatedPlayer.role}】\n`;
    } else {
      summary += `• 本轮无人出局。\n`;
    }

    if (survivingWolves.length === 0) {
      this.phase = 'ended';
      summary += '🎉 好人阵营获胜！';
    } else if (survivingWolves.length >= survivingGoodGuys.length) {
      this.phase = 'ended';
      summary += '💀 狼人阵营获胜！';
    } else {
      this.phase = 'night';
      summary += '进入下一轮夜晚。';
    }

    return { summary, eliminatedPlayer };
  }
}
