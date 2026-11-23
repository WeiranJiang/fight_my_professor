import institutions from '../data-source/schools.json' with {type:'json'};

// Preserve the original paths and affiliation IDs for the first 20 schools.
const existingIds = new Map([
  [110404,'caltech'],[110635,'berkeley'],[110662,'ucla'],[130794,'yale'],
  [144050,'uchicago'],[147767,'northwestern'],[162928,'jhu'],[166027,'harvard'],
  [166683,'mit'],[170976,'michigan'],[182670,'dartmouth'],[186131,'princeton'],
  [190150,'columbia'],[190415,'cornell'],[198419,'duke'],[211440,'cmu'],
  [215062,'penn'],[217156,'brown'],[221999,'vanderbilt'],[243744,'stanford']
]);

export const nationalSchools = new Map(institutions.map(([unit,name,city,state,url,level,aliases])=>{
  const id=existingIds.get(unit)??'ipeds'+unit;
  return [id,{id,name,short:name,location:city+', '+state,state,url,level,unit,aliases}];
}));
