export const stats = ['Strength', 'Agility', 'Durability', 'Intelligence', 'Rizz', 'Aura'];
export const tags = ['Final Boss Energy', 'Built Different', 'Main Character', '8 AM Warrior', 'Absolute Unit', 'Legendary Rizz', 'Human Calculator', 'Unbeatable Aura', 'Office Hours Menace', 'Caffeine Powered', 'Walking Encyclopedia'];
export const options = {
  skin: ['#f5c3a0','#d8956b','#a66448','#73452e','#f5dac0'],
  hair: ['Side part','Curly','Long','Buzz cut','Bald','Ponytail','Bun','Wavy','Short','Medium'],
  hairColor: ['#302334','#634135','#cd9553','#a84d42','#aca6ad','#e8e3e9','#7861aa'],
  glasses: ['None','Round','Rectangle','Small','Thick'],
  beard: ['None','Mustache','Beard','Goatee'],
  shirt: ['T-shirt','Sweater','Hoodie','Button-down','Polo','Cardigan','Blazer','Lab coat'],
  shirtColor: ['#7758b9','#dd775a','#609a8f','#e7b552','#596eac','#b85b88','#63734c','#ece5d4'],
  pants: ['Jeans','Slacks','Shorts','Casual'],
  pantsColor: ['#3d4866','#514355','#786757','#405444'],
  shoes: ['Sneakers','Dress shoes','Boots'],
  prop: ['None','Tie','Bow tie','Cap','Book','Clipboard','Laptop','Coffee'],
  eyeShape: ['Dot','Round','Oval','Sleepy'],
  eyeSize: ['Small','Medium','Large'],
  eyeColor: ['#282335','#714334','#336bb4','#26815f','#9a661a','#8052a1','#b34f78']
};
export const defaultAvatar = Object.fromEntries(Object.keys(options).map(key => [key, 0]));
export const colors = new Set(['skin','hairColor','shirtColor','pantsColor','eyeColor']);
export const eyeColorNames = ['Ink','Brown','Blue','Green','Amber','Violet','Rose'];
export const eyeTraits = Object.freeze({eyeShape:0,eyeSize:0,eyeColor:0});

// Three rows per eye. The middle column sits on the original one-pixel dot.
const eyePatterns = [
  [['...','.#.','...'],['.##','.##','...'],['###','###','###']],
  [['.#.','.#.','...'],['.#.','###','.#.'],['.##','###','##.']],
  [['.#.','.#.','.#.'],['.##','.##','.#.'],['.##','###','###']],
  [['...','.##','...'],['...','###','...'],['#..','.##','...']]
];
export function seededAvatar(id) {
  let seed = [...id].reduce((n,c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return Object.fromEntries(Object.entries(options).map(([key, values]) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return [key, (seed >>> 8) % values.length];
  }));
}
export function avatar(a = defaultAvatar) {
  const {eyeShape,eyeSize,eyeColor} = {...eyeTraits,...a};
  const widerEyes = eyeShape!==0 || eyeSize!==0;
  const ink = '#282335', skin = options.skin[a.skin], hair = options.hairColor[a.hairColor];
  const shirt = options.shirtColor[a.shirtColor], pants = options.pantsColor[a.pantsColor];
  const r = (x,y,w,h,fill=ink) => '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>';
  const hairline = [
    [[6,5,11,4],[5,7,4,5],[14,7,5,3],[17,8,2,5]],
    [[5,6,14,4],[6,4,3,4],[11,3,4,4],[16,5,3,5],[4,8,3,6],[17,8,3,5]],
    [[5,5,14,5],[4,8,4,14],[17,8,3,14]],
    [[7,6,10,2],[6,7,2,2],[16,7,2,2]],
    [],
    [[6,5,13,4],[5,8,4,4],[16,8,3,4],[19,9,3,9],[20,16,3,3]],
    [[7,3,8,3],[9,2,5,2],[6,5,13,4],[5,8,4,4],[16,8,3,4]],
    [[5,6,14,4],[7,4,9,3],[4,8,4,8],[17,8,3,8],[15,8,3,3]],
    [[6,5,12,5],[5,7,3,5],[17,7,2,4]],
    [[5,6,14,4],[7,4,10,3],[4,8,4,10],[17,8,3,10]]
  ];
  let px = r(7,19,10,3)+r(5,21,14,6)+r(4,23,3,4)+r(17,23,3,4)+r(7,26,10,5)+r(6,30,6,2)+r(13,30,5,2);
  px += r(8,26,8,a.pants===2?2:4,pants)+r(8,28,3,2,a.pants===2?skin:pants)+r(13,28,3,2,a.pants===2?skin:pants);
  px += r(7,30,4,1,a.shoes===0?'#faf2d9':a.shoes===1?'#614541':ink)+r(14,30,3,1,a.shoes===0?'#faf2d9':a.shoes===1?'#614541':ink);
  px += r(6,22,12,4,a.shirt===7?'#f8f5e7':shirt)+r(8,20,8,2,a.shirt===7?'#f8f5e7':shirt)+r(5,25,2,1,skin)+r(17,25,2,1,skin);
  if (a.shirt>1) px += r(11,21,2,2,'#fff2ce')+r(12,23,1,3,a.shirt===7?shirt:'#302334');
  px += r(8,5,8,1)+r(6,6,12,2)+r(5,8,14,9)+r(7,17,10,3)+r(6,9,12,8,skin)+r(8,7,8,12,skin);
  px += hairline[a.hair].map(part=>r(...part,hair)).join('');
  px += r(8,16,1,1,'#df866d')+r(15,16,1,1,'#df866d')+r(11,17,2,1,'#a35b52');
  if (a.glasses) {
    const rounded = a.glasses===1;
    const top = a.glasses===3&&!widerEyes?12:11;
    const width = widerEyes?5:4;
    const frame = a.glasses===4?ink:'#64505a';
    for (const x of [7,widerEyes?12:13]) {
      const inset = rounded?1:0;
      px += r(x+inset,top,width-2*inset,1,frame)+r(x+inset,15,width-2*inset,1,frame);
      px += r(x,top+1,1,14-top,frame)+r(x+width-1,top+1,1,14-top,frame);
    }
    px += r(11,top+1,2,1,frame);
  }
  const iris = options.eyeColor[eyeColor];
  const pattern = eyePatterns[eyeShape][eyeSize];
  for (const [row,pixels] of pattern.entries()) {
    for (let column=0;column<pixels.length;column++) {
      if (pixels[column]==='#') px += r(8+column,12+row,1,1,iris)+r(15-column,12+row,1,1,iris);
    }
  }
  if (a.beard) px += r(a.beard===3?11:9, a.beard===3?17:16,a.beard===3?2:6,1,hair)+(a.beard===2?r(9,17,6,2,hair):'');
  if (a.prop===1 || a.prop===2) px += r(a.prop===1?11:9,20,a.prop===1?2:6,a.prop===1?5:2,'#de685c');
  if (a.prop===3) px += r(5,3,14,2)+r(8,5,8,2)+r(17,5,1,4,'#e9af45');
  if (a.prop>=4) px += r(16,22,7,6)+r(17,23,5,4,['#eea653','#e7c98b','#8ab6c5','#fcf1d0'][a.prop-4])+r(17,26,4,1,'#f9e5b9');
  return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" shape-rendering="crispEdges">'+px+'</svg>');
}
