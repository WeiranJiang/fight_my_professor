export const DEFAULTS = {prior:60, priorWeight:5, minRatings:3, minProfessors:2, winXP:120, lossXP:35, firstXP:40, levelXP:150, hp:90, damage:23, botSpread:1};
export const average = values => values.reduce((a,b)=>a+b,0)/values.length;
export const difficulty = (power,intelligence) => {
  const score = power * .7 + intelligence * .3;
  return score>=90?'Boss':score>=84?'Elite':score>=76?'Hard':score>=63?'Normal':'Easy';
};
export const level = (xp, config) => 1 + Math.floor(xp/config.levelXP);
export const hp = (fighter,config) => config.hp + Math.round(fighter.values[2]*.25);
export function botGuess(question, fighter, random, config) {
  const intelligence = fighter.values[3]/100;
  const signedError = (random()*2-1) * (0.85-intelligence*.63) * question.scale * config.botSpread;
  return Math.max(0, Math.round((question.answer+signedError)*10)/10);
}
export function resolveRound(q, estimate, bot, player, enemy, config, round) {
  const playerError = estimate === null ? null : Math.abs(estimate-q.answer);
  const botError = Math.abs(bot-q.answer);
  const tie = playerError!==null && Math.abs(playerError-botError)<1e-8;
  const winner = tie ? 'tie' : playerError!==null && playerError<botError ? 'player' : 'enemy';
  const attacker = winner==='player'?player.values:enemy.values;
  const defender = winner==='player'?enemy.values:player.values;
  const error = winner==='player'?playerError:botError;
  const score = playerError===null?0:Math.round(100*Math.max(0,1-playerError/q.scale));
  const bonus = (round===3 ? attacker[4]/40 : 0) + (round===5 ? attacker[5]/40 : 0);
  const damage = tie?0:Math.max(1,Math.round(config.damage*(1.45-.64*Math.min(error/q.scale,1)) + attacker[0]/22 + bonus - defender[2]/32 - defender[1]/60));
  return {answer:q.answer, source:q.source, estimate, bot, playerError, botError, winner, damage, score};
}
