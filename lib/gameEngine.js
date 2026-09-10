import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

/**
 * @typedef {'killer' | 'villager'} Role
 * @typedef {'night' | 'discussion' | 'voting_proposal' | 'voting' | 'ended'} Phase
 * 
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {Role} role
 * @property {boolean} isAI
 * @property {boolean} isAlive
 */

export class GameEngine {
  constructor() {
    /** @type {Player[]} */
    this.players = [
      { id: '1', name: '你 (Player)', role: 'villager', isAI: false, isAlive: true },
      { id: '2', name: 'AI-小美', role: 'villager', isAI: true, isAlive: true },
      { id: '3', name: 'AI-老张', role: 'killer', isAI: true, isAlive: true },
      { id: '4', name: 'AI-小刚', role: 'villager', isAI: true, isAlive: true },
      { id: '5', name: 'AI-小红', role: 'villager', isAI: true, isAlive: true },
      { id: '6', name: 'AI-小强', role: 'villager', isAI: true, isAlive: true },
    ];
    this.assignRandomKiller();

    /** @type {Phase} */
    this.phase = 'night';
    this.currentSpeakerIndex = 0;
    this.votes = new Map();
    this.proposalState = {
      proposer: null,
      agrees: new Set(),
      disagrees: new Set()
    };
  }

  assignRandomKiller() {
    this.players.forEach(p => p.role = 'villager');
    const aiPlayers = this.players.filter(p => p.isAI);
    const randomKiller = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];
    randomKiller.role = 'killer';
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  getNextSpeaker() {
    const alive = this.getAlivePlayers();
    if (alive.length === 0) return null;
    const speaker = alive[this.currentSpeakerIndex % alive.length];
    this.currentSpeakerIndex++;
    return speaker;
  }

  nightAction() {
    const aliveAIs = this.getAlivePlayers().filter(p => p.isAI);
    const killer = aliveAIs.find(p => p.role === 'killer');
    const victims = this.getAlivePlayers().filter(p => p.id !== killer?.id);
    
    let victim = null;
    if (killer && victims.length > 0) {
      victim = victims[Math.floor(Math.random() * victims.length)];
      victim.isAlive = false;
    }
    return victim;
  }

  castVote(voterId, targetId) {
    this.votes.set(voterId, targetId);
  }

  /**
   * 内部处理所有存活 AI 的投票
   */
  async executeAIVotes(messages) {
    const aliveAIs = this.getAlivePlayers().filter(p => p.isAI);
    const targets = this.getAlivePlayers();

    for (const ai of aliveAIs) {
      // 简单随机或根据逻辑投票给非自己的存活玩家
      const possibleTargets = targets.filter(t => t.id !== ai.id);
      if (possibleTargets.length > 0) {
        const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        this.castVote(ai.id, randomTarget.id);
      }
    }
  }

  resetProposal(proposerName) {
    this.proposalState = {
      proposer: proposerName,
      agrees: new Set([proposerName]),
      disagrees: new Set()
    };
  }

  addProposalResponse(name, agree) {
    if (agree) {
      this.proposalState.agrees.add(name);
    } else {
      this.proposalState.disagrees.add(name);
    }
  }

  isProposalPassed() {
    const aliveCount = this.getAlivePlayers().length;
    return this.proposalState.agrees.size >= aliveCount;
  }

  isProposalFailed() {
    const aliveCount = this.getAlivePlayers().length;
    return this.proposalState.disagrees.size > 0 || 
           (this.proposalState.agrees.size + this.proposalState.disagrees.size >= aliveCount && !this.isProposalPassed());
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

    const survivingKiller = this.getAlivePlayers().find(p => p.role === 'killer');
    const survivingVillagers = this.getAlivePlayers().filter(p => p.role === 'villager');

    let summary = `🗳️ 【投票处决结果】\n`;
    if (eliminatedPlayer) {
      summary += `• ${eliminatedPlayer.name} 被全场投票出局！身份是：【${eliminatedPlayer.role === 'killer' ? '杀手 🔪' : '平民 🛡️'}】\n`;
    } else {
      summary += `• 本轮无人出局。\n`;
    }

    if (!survivingKiller) {
      this.phase = 'ended';
      summary += '\n🎉 【好人阵营获胜】杀手已经被成功消灭！';
    } else if (survivingKiller && survivingVillagers.length <= 1) {
      this.phase = 'ended';
      summary += '\n💀 【杀手阵营获胜】杀手人数已经占优，平民被屠村！';
    } else {
      this.phase = 'night';
      summary += '\n天黑了，请注意安全，即将进入下一轮夜晚...';
    }

    return { summary, eliminatedPlayer };
  }
}
