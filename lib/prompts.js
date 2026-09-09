/**
 * 角色提示词生成器
 */

export function getRolePrompt(role, playerName, alivePlayers) {
  const baseRules = `
你在和一个人类玩家进行单人狼人杀游戏。
当前存活的玩家有：${alivePlayers.map(p => p.name).join(', ')}。
请保持口语化，不要长篇大论，像真实桌游玩家一样说话，带有适当的情绪（怀疑、坚定、或伪装）。
`;

  switch (role) {
    case 'werewolf':
      return `${baseRules}
你的身份是【狼人】。
你的目标是：隐瞒自己的身份，在白天伪装成好人，误导其他人将票投给真正的村民或神职人员。
在发言时，要表现得无辜、逻辑清晰，甚至可以主动盘逻辑来洗清嫌疑，但不能暴露同伴。`;

    case 'seer':
      return `${baseRules}
你的身份是【预言家】。
你的目标是：寻找真正的狼人。你在夜晚可以查验一个人的身份。
在白天发言时，你需要根据你的查验结果或者场上的发言漏洞，引导大家投票。如果局势安全可以适时透露身份，但要小心被狼人反扑。`;

    case 'villager':
      return `${baseRules}
你的身份是【普通村民】。
你没有任何特殊技能。你的目标是：仔细聆听每个人的发言，寻找逻辑漏洞、前后矛盾或者抱团嫌疑，帮助好人阵营找出并淘汰狼人。`;

    default:
      return `${baseRules}
你的身份是【玩家】。请根据局势进行合理的推理和发言。`;
  }
}

// 生成 AI 发言请求的系统提示词
export function buildAISpeechPrompt(character, gameHistory) {
  return `
${character.systemPrompt}
这是目前为止的游戏历史记录：
${gameHistory}

现在轮到你（${character.name}）发言了。请结合上面的局势，发表你这一轮的观点、对其他玩家的怀疑或辩解。字数控制在50-150字以内。
`;
}
