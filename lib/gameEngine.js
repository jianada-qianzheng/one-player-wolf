/**
 * 游戏状态与轮次数据结构设计
 */

export class GameManager {
  constructor(players) {
    // players: 玩家列表 [{ id, name, role, isAlive, isAI }]
    this.players = players;
    this.rounds = []; // 存储每一轮的详细记录
    this.currentRoundNumber = 0;
    this.phase = 'setup'; // setup, night, day_speech, day_vote, ended
    this.winner = null;
  }

  // 开始新的一轮
  startNewRound() {
    this.currentRoundNumber++;
    const newRound = {
      roundNumber: this.currentRoundNumber,
      nightActions: [], // 夜晚动作记录：[{ actorId, targetId, action }]
      speeches: [],     // 白天发言记录：[{ speakerId, role, content }]
      votes: {},        // 投票记录：{ voterId: targetId }
      eliminated: [],   // 本轮出局者
      summary: ''       // 本轮总结
    };
    this.rounds.push(newRound);
    return newRound;
  }

  // 获取当前轮次对象
  getCurrentRound() {
    if (this.rounds.length === 0) {
      return this.startNewRound();
    }
    return this.rounds[this.rounds.length - 1];
  }

  // 记录夜晚动作
  recordNightAction(actorId, targetId, action) {
    const round = this.getCurrentRound();
    round.nightActions.push({ actorId, targetId, action });
  }

  // 记录发言
  recordSpeech(speakerId, role, content) {
    const round = this.getCurrentRound();
    round.speeches.push({ speakerId, role, content });
  }

  // 记录投票
  recordVote(voterId, targetId) {
    const round = this.getCurrentRound();
    round.votes[voterId] = targetId;
  }

  // 导出完整游戏历史（可用于喂给 AI 作为上下文记忆）
  getGameHistoryContext() {
    return JSON.stringify(this.rounds, null, 2);
  }
}
