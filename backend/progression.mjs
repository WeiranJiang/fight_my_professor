export function achievementNames(u) {
  return [
    [u.wins>=1,'First Victory'],[u.defeated.length>=5,'Office Hours Champion'],
    [u.defeated.length>=50,'Professor Slayer'],[u.best>=550,'Academic Weapon'],
    [u.bosses>=1,'Final Boss'],[(u.perfect??0)>=5,'Laser Focus']
  ].filter(([earned])=>earned).map(([,name])=>name);
}
