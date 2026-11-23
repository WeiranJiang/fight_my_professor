const DAY = 86400000;
const dailyTypes = ['estimate','estimate','estimate','rare','common'];
export const questionType = question => question.kind ?? 'estimate';

function diceOutcomes(sides,tail,reverse) {
  return [tail,tail+1,tail+2,sides,sides+1,sides+2].map(total=>reverse?2*(sides+1)-total:total).map(total=>({
    text:String(total), weight:sides-Math.abs(sides+1-total)
  }));
}

// Five reproducible, checked prompts unlock each UTC day. Historical prompts
// are generated on demand so deployment and scheduled jobs aren't required.
export function dailyQuestions(now=Date.now(), days=120) {
  const today=Math.floor(now/DAY);
  return Array.from({length:days},(_,age)=>{
    const day=today-age, releasedAt=day*DAY;
    const length=18+day%67, width=12+day%53, height=8+day%43;
    const amount=2+day%17, volume=5+day%31;
    const sides=8+day%61, slots=9+day%37, special=1+day%3;
    const rows=[
      {prompt:'How many 1 cm cubes exactly fill a box measuring '+length+' × '+width+' × '+height+' cm?',answer:length*width*height,unit:'cubes'},
      {prompt:'You have '+amount+' liters of water. How many '+(volume*10)+' mL cups can you fill completely?',answer:Math.floor(amount*1000/(volume*10)),unit:'cups'},
      {prompt:'A rack has '+length+' shelves, with '+width+' spots per shelf. If '+height+' spots are empty, how many are occupied?',answer:length*width-height,unit:'spots'},
      {prompt:'Which listed total is least likely when rolling two fair '+sides+'-sided dice numbered from 1 to '+sides+'?',options:diceOutcomes(sides,2+day%4,day%2===1)},
      {prompt:'A fair spinner has '+slots+' equal slots. Which listed outcome is most likely?',options:[
        {text:'Land on one of '+special+' marked slots',weight:special},
        {text:'Land on one of '+(special+1)+' marked slots',weight:special+1},
        {text:'Land on one of '+(special+2)+' marked slots',weight:special+2},
        {text:'Land on one of '+(slots-1)+' marked slots',weight:slots-1}
      ]}
    ];
    return rows.map((row,index)=>({
      id:'daily-'+day+'-'+index, kind:dailyTypes[index], category:index<3?'Estimation':'Probability',
      time:25, active:true, releasedAt, scale:Math.max(5,Math.round((row.answer??0)*.4)),...row
    }));
  }).flat();
}

export function selectQuestions(bank, recent, playlist, now, random=Math.random) {
  const cutoff=now-30*DAY;
  // Older deployments stored just 14 IDs. Remember them on the first upgrade.
  const history=new Map(Array.isArray(recent)
    ?recent.map(id=>[id,now]):Object.entries(recent??{}).filter(([,time])=>time>=cutoff));
  const ordered=bank.map(q=>{
    const age=q.releasedAt==null?120:(now-q.releasedAt)/DAY;
    const weight=age<7?4:age<30?2:1;
    return {q,seen:history.get(q.id)??0,priority:-Math.log(Math.max(Number.EPSILON,random()))/weight};
  }).sort((a,b)=>a.seen-b.seen||a.priority-b.priority).map(({q})=>q);
  const kinds=playlist==='mixed'?['estimate','rare','common','estimate','rare','common','estimate']:Array(7).fill(playlist);
  const selected=[];
  for(const kind of kinds){
    const question=ordered.find(q=>questionType(q)===kind&&!selected.includes(q));
    if(question)selected.push(question);
  }
  for(const q of selected)history.set(q.id,now);
  return {selected,recent:Object.fromEntries([...history.entries()].sort((a,b)=>b[1]-a[1]).slice(0,1800))};
}

export function botChoice(question, fighter, random=Math.random) {
  const options=question.options;
  const best=options.reduce((result,option,index)=>
    (question.kind==='rare'?option.weight<options[result].weight:option.weight>options[result].weight)?index:result,0);
  return random()<(0.27+fighter.values[3]*.005)?best:Math.floor(random()*options.length);
}
