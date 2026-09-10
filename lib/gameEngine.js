import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export class GameEngine {
  constructor(initialPlayers) {
    this.players = initialPlayers; // [{ id, name, role, isAI, isAlive }]
    this.phase = 'night'; // night, discussion, voting, ended
    this.currentSpeakerIndex = 0;
    this.votes = new Map(); // voterId -> targetId
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  // 获取下一个发言的 AI 角色
  getNextAISpeaker() {
    const aliveAIs = this.getAlivePlayers().filter(p => p.isAI);
    if (aliveAIs.length === 0) return null;
    const speaker = aliveAIs[this.currentSpeakerIndex % aliveAIs.length];
    this.currentSpeakerIndex++;
    return speaker;
  }

  // 记录投票
  castVote(voterId, targetId) {
    this.votes.set(voterId, targetId);
  }

  /**
   * 让每一个存活的 AI 角色“无上帝视角”地根据近期聊天记录和自身立场独立投票
   */
  async executeAIVotes(messages) {
    const aliveAIs = this.getAlivePlayers().filter(p => p.isAI);
    
    for (const ai of aliveAIs) {
      try {
        const otherPlayers = this.getAlivePlayers().filter(p => p.id !== ai.id);
        const playerListStr = otherPlayers.map(p => `- ID: ${p.id}, 名字: ${p.name}`).join('\n');

        // AI 独立投票的 Prompt（严格限制：无上帝视角，只能凭对话投票）
        const prompt = `
你正在玩一场狼人杀游戏。
你的名字是：${ai.name}
你的底牌/身份是：${ai.role}（注意：你绝对不知道其他任何人的真实身份是好是坏！）
当前场上存活的候选投票目标：
${playerListStr}

【近期聊天对话记录】：
${messages.slice(-8).map(m => `${m.sender}: ${m.content}`).join('\n')}

【投票准则】：
1. 严格禁止上帝视角：你不知道谁是狼人谁是好人，你只能根据上面的聊天发言来判断谁最可疑。
2. 利益最大化：如果是狼人，你要寻找机会把水搅浑或者投给好人；如果是好人/预言家，你要投给你认为发言逻辑最差、最像狼的人。
3. **你必须且只能从上面给出的候选目标中选择一个 ID 进行投票**。
4. 你的回复必须严格包含如下格式的 JSON（不要有多余的 markdown 废话）：
{"targetId": "目标ID", "reason": "一句话投票理由"}
`;

        const res = (await generateText({
          model: groq('llama-3.1-8b-instant'),
          system: "你是一个狼人杀单人玩家，请根据逻辑进行秘密投票，严格只输出 JSON。",
          prompt: prompt,
        })).text;

        // 解析 AI 返回的投票结果
        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const voteData = JSON.parse(jsonMatch[0]);
          if (voteData.targetId && otherPlayers.some(p => p.id === voteData.targetId)) {
            this.castVote(ai.id, voteData.targetId);
            continue;
          }
        }
        
        // 容错：如果解析失败，随机投一个活着的其他人
        const fallbackTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        if (fallbackTarget) {
          this.castVote(ai.id, fallbackTarget.id);
        }
      } catch (err) {
        console.error(`AI ${ai.name} 投票出错:`, err);
        const otherPlayers = this.getAlivePlayers().filter(p => p.id !== ai.id);
        if (otherPlayers.length > 0) {
          this.castVote(ai.id, otherPlayers[0].id);
        }
      }
    }
  }

  // 结算投票与胜负
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

    // 胜负判定
    const survivingWolves = this.getAlivePlayers().filter(p => p.role === 'werewolf');
    const survivingGoodGuys = this.getAlivePlayers().filter(p => p.role !== 'werewolf');

    let summary = `🗳️ 【投票结果揭晓】\n`;
    if (eliminatedPlayer) {
      summary += `• ${eliminatedPlayer.name} 获得了最高票被淘汰！其真实身份是：【${eliminatedPlayer.role}】\n`;
    } else {
      summary += `• 本轮无人出局。\n`;
    }

    if (survivingWolves.length === 0) {
      this.phase = 'ended';
      summary += '🎉 狼人已被全部消灭，好人阵营获胜！';
    } else if (survivingWolves.length >= survivingGoodGuys.length) {
      this.phase = 'ended';
      summary += '💀 狼人数量已占优，狼人阵营取得了胜利！';
    } else {
      this.phase = 'night';
      summary += '游戏继续，进入下一轮。';
    }

    return { summary, eliminatedPlayer };
  }
}
