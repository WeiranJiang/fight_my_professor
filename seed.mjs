import { extraTrivia } from './extra-trivia.mjs';
import facultySnapshot from './data-source/faculty.json' with {type:'json'};
import { seededAvatar } from './public/shared.js';

const schools = [
  ['penn','University of Pennsylvania','Penn','Philadelphia, PA','https://www.upenn.edu'],
  ['michigan','University of Michigan','Michigan','Ann Arbor, MI','https://umich.edu'],
  ['harvard','Harvard University','Harvard','Cambridge, MA','https://www.harvard.edu'],
  ['stanford','Stanford University','Stanford','Stanford, CA','https://www.stanford.edu'],
  ['mit','Massachusetts Institute of Technology','MIT','Cambridge, MA','https://www.mit.edu'],
  ['princeton','Princeton University','Princeton','Princeton, NJ','https://www.princeton.edu'],
  ['yale','Yale University','Yale','New Haven, CT','https://www.yale.edu'],
  ['columbia','Columbia University','Columbia','New York, NY','https://www.columbia.edu'],
  ['uchicago','University of Chicago','UChicago','Chicago, IL','https://www.uchicago.edu'],
  ['duke','Duke University','Duke','Durham, NC','https://www.duke.edu'],
  ['northwestern','Northwestern University','Northwestern','Evanston, IL','https://www.northwestern.edu'],
  ['cornell','Cornell University','Cornell','Ithaca, NY','https://www.cornell.edu'],
  ['brown','Brown University','Brown','Providence, RI','https://www.brown.edu'],
  ['dartmouth','Dartmouth College','Dartmouth','Hanover, NH','https://home.dartmouth.edu'],
  ['jhu','Johns Hopkins University','Johns Hopkins','Baltimore, MD','https://www.jhu.edu'],
  ['berkeley','University of California, Berkeley','UC Berkeley','Berkeley, CA','https://www.berkeley.edu'],
  ['ucla','University of California, Los Angeles','UCLA','Los Angeles, CA','https://www.ucla.edu'],
  ['cmu','Carnegie Mellon University','CMU','Pittsburgh, PA','https://www.cmu.edu'],
  ['caltech','California Institute of Technology','Caltech','Pasadena, CA','https://www.caltech.edu'],
  ['vanderbilt','Vanderbilt University','Vanderbilt','Nashville, TN','https://www.vanderbilt.edu']
];
const demos = [
  ['vale','Dr. Morgan Vale','Computer Science','penn',[69,82,86,99,89,98],'The Final Boss','violet',{skin:0,hair:1,hairColor:4,glasses:2,shirt:6,shirtColor:0,prop:1}],
  ['park','Prof. Avery Park','Physics','michigan',[65,94,64,96,82,91],'The Human Calculator','peach',{skin:1,hair:2,hairColor:1,glasses:1,shirt:7,shirtColor:1,prop:4}],
  ['rivera','Dr. Casey Rivera','Philosophy','harvard',[72,67,78,89,97,91],'The Charisma Check','mint',{skin:2,hair:0,hairColor:0,beard:2,shirt:5,shirtColor:2,prop:7}],
  ['chen','Prof. Robin Chen','Mathematics','mit',[60,83,72,98,65,87],'The Curve Breaker','blue',{}],
  ['ellis','Dr. Jamie Ellis','History','penn',[65,73,79,84,78,88],'The Archivist','peach',{}],
  ['brooks','Prof. Taylor Brooks','Chemistry','michigan',[79,64,87,91,62,77],'The Lab Legend','violet',{}]
];
export const seedSchools = schools.map(([id,name,short,location,url])=>({id,name,short,location,url}));
export const seedProfessors = demos.map(([id,name,department,school,base,title,tone,traits])=>({id,name,department,school,base,title,tone,demo:true,avatar:{...seededAvatar(id),...traits}}));

const verifiedFaculty = [
  ['penn-jayaraman','Dinesh Jayaraman','Computer and Information Science','penn','https://www.seas.upenn.edu/~dineshj/'],
  ['penn-ungar','Lyle Ungar','Computer and Information Science','penn','https://lifelongml.seas.upenn.edu/madna.github.io/team/'],
  ['michigan-mihalcea','Rada Mihalcea','Computer Science and Engineering','michigan','https://web.eecs.umich.edu/~mihalcea/contact.html']
];
const facultyById = new Map(verifiedFaculty.map(([id,name,department,school,source])=>[id,{id,name,department,school,source}]));
for (const row of facultySnapshot) facultyById.set(row.id,row);
seedProfessors.push(...Array.from(facultyById.values(), row=>({
  ...row,demo:false,base:Array(6).fill(60),
  avatar:seededAvatar(row.id),tone:'blue',title:'Faculty Challenger'
})));

const nasa='https://science.nasa.gov/learn/basics-of-space-flight/chapter-1-the-solar-system/';
const moon='https://science.nasa.gov/moon/facts/';
const penn='https://www.upenn.edu/about/history';
const constitution='https://www.archives.gov/founding-docs/constitution-transcript';
const elements='https://iupac.org/what-we-do/periodic-table-of-elements/';
const olympics='https://www.olympics.com/ioc/overview';
const units='https://www.nist.gov/pml/owm/si-units-length';
const chemistry='Science', history='History', space='Space', math='Math', sports='Sports';
const rows = [
 ['penn',history,'What year does the University of Pennsylvania date its founding to?',1740,80,'year',penn],
 ['moon-km',space,'What is the average distance from Earth to the Moon in kilometers?',384400,170000,'km',moon],
 ['moon-days',space,'How many Earth days does one orbit of the Moon take? Round to a whole day.',27,14,'days',moon],
 ['moon-radius',space,'What is the Moon’s approximate radius in kilometers?',1740,700,'km',moon],
 ['planets',space,'How many planets orbit the Sun?',8,4,'planets',nasa],
 ['venus',space,'How many Earth days does Venus take to orbit the Sun? Round to a whole day.',225,100,'days',nasa],
 ['mars',space,'How many Earth days does Mars take to orbit the Sun? Round to a whole day.',687,270,'days',nasa],
 ['jupiter',space,'How many Earth years does Jupiter take to orbit the Sun? Round to a whole year.',12,7,'years',nasa],
 ['constitution',history,'What year was the U.S. Constitution signed?',1787,80,'year',constitution],
 ['senate',history,'How many senators does the U.S. Constitution assign to each state?',2,3,'senators',constitution],
 ['gold',chemistry,'What is the atomic number of gold?',79,45,'atomic number',elements],
 ['silver',chemistry,'What is the atomic number of silver?',47,30,'atomic number',elements],
 ['tin',chemistry,'What is the atomic number of tin?',50,26,'atomic number',elements],
 ['oxygen',chemistry,'What is the atomic number of oxygen?',8,7,'atomic number',elements],
 ['uranium',chemistry,'What is the atomic number of uranium?',92,42,'atomic number',elements],
 ['marathon',sports,'How many meters long is a standard marathon?',42195,18000,'m','https://worldathletics.org/disciplines/road-running/marathon'],
 ['olympics',sports,'What year did Athens host the first modern Olympic Games?',1896,60,'year',olympics],
 ['mile',math,'How many feet make up one statute mile?',5280,2100,'ft',units],
 ['percent',math,'What percentage is three eighths?',37.5,30,'%',null],
 ['prime',math,'What is the smallest prime number greater than 100?',101,12,'number',null],
 ['angles',math,'How many degrees are in the interior angles of a regular hexagon combined?',720,330,'degrees',null],
 ['bytes','Technology','How many bits are in 16 bytes?',128,80,'bits',null],
 ['chess','Games','How many squares of all sizes are on a standard 8 × 8 chessboard?',204,160,'squares',null],
 ['cards','Games','In a standard 52-card deck, what percentage of the cards are face cards? Round to one decimal place.',23.1,22,'%',null],
 ['seconds',math,'How many seconds are in one week?',604800,450000,'seconds',null],
 ['piano','Arts','How many keys are on a standard full-size modern piano?',88,35,'keys','https://www.yamaha.com/en/musical_instrument_guide/piano/trivia/trivia007.html'],
 ['oscars','Arts','What year was the first Academy Awards ceremony held?',1929,80,'year','https://www.oscars.org/oscars/ceremonies/1929'],
 ['alaska','Geography','What year did Alaska become a U.S. state?',1959,55,'year','https://www.archives.gov/historical-docs/todays-doc/?dod-date=103'],
 ['zero',math,'How many trailing zeros are in one million?',6,4,'zeros',null]
];
export const seedQuestions = rows.map(([id,category,prompt,answer,scale,unit,source])=>({id,category,prompt,answer,scale,unit,source,time:25,active:true}));

seedQuestions.push(...extraTrivia);
