/**
 * 狼人杀游戏核心引擎 (Game Engine)
 * 负责管理玩家状态、轮次记录、投票统计与胜负判定
 */

export class GameEngine {
  constructor(initialPlayers) {
    this.players = initialPlayers; // [{ id, name, role, isAI, isAlive }]
    this.rounds = [];
    this.currentRoundNumber = 0;
    this.phase = 'night'; // night, discussion, voting, ended
    this.votes = {}; // 投票箱 { voterId: targetId }
    this.winner = null;
  }

  // 开始新的一轮
  startNewRound() {
    this.currentRoundNumber++;
    const newRound = {
      roundNumber: this.currentRoundNumber,
      nightActions: [],
      speeches: [],
      votes: {},
      eliminated: []
    };
    this.rounds.push(newRound);
    return newRound;
  }

  // 获取当前轮次
  getCurrentRound() {
    if (this.rounds.length === 0) {
      return this.startNewRound();
    }
    return this.rounds[this.rounds.length - 1];
  }

  // 记录玩家投票
  castVote(voterId, targetId) {
    this.votes[voterId] = targetId;
    const round = this.getCurrentRound();
    round.votes[voterId] = targetId;
  }

  // 结算投票与胜负判定
  resolveVoting() {
    const voteCounts = {};
    
    // 1. 统计票数
    Object.values(this.votes).forEach(targetId => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });

    // 2. 找出得票最高的人
    let highestVotes = 0;
    let eliminatedId = null;
    for (const [id, count] of Object.entries(voteCounts)) {
      if (count > highestVotes) {
        highestVotes = count;
        eliminatedId = id;
      }
    }

    if (!eliminatedId) {
      return { summary: '本轮无人投票，无人出局。', gameOver: false };
    }

    // 3. 更新玩家生存状态
    const eliminatedPlayer = this.players.find(p => p.id === eliminatedId);
    if (eliminatedPlayer) {
      eliminatedPlayer.isAlive = false;
    }

    // 4. 胜负判定逻辑
    // 检查是否投出了狼人
    let summary = `【${eliminatedPlayer.name}】获得了最高票，被驱逐出局！其真实身份是：${eliminatedPlayer.role === 'werewolf' ? '狼人 🐺' : '好人 🛡️'}\n`;
    
    if (eliminatedPlayer.role === 'werewolf') {
      this.winner = 'villagers';
      this.phase = 'ended';
      summary += '🎉 恭喜好人阵营！狼人已被全部清除，好人胜利！';
    } else {
      // 检查场上剩余的狼人数量是否大于等于好人数量
      const aliveWerewolves = this.players.filter(p => p.isAlive && p.role === 'werewolf');
      const aliveVillagers = this.players.filter(p => p.isAlive && p.role !== 'werewolf');

      if (aliveWerewolves.length >= aliveVillagers.length) {
        this.winner = 'werewolves';
        this.phase = 'ended';
        summary += '💀 狼人数量占优，狼人阵营取得了胜利！';
      } else {
        summary += '游戏继续，进入下一轮夜晚。';
        this.phase = 'discussion';
      }
    }

    return { eliminatedPlayer, summary, gameOver: this.phase === 'ended' };
  }

  // 获取存活玩家列表
  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }
}
