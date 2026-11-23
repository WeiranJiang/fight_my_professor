const estimates=[
  ['marbles','Volume','Assuming perfect packing with no gaps, how many 2 cm cubes fit in a 20 × 12 × 10 cm box?',300,'cubes'],
  ['suitcase','Volume','How many 5 cm cubes fit in a suitcase with an internal space of 55 × 35 × 20 cm?',308,'cubes'],
  ['classroom','Campus','A school has 24 classrooms and each has 28 seats. How many seats are there altogether?',672,'seats'],
  ['inches','Measurement','How many inches are in 13 feet?',156,'inches'],
  ['tiles','Measurement','How many 25 cm square tiles cover a 5 m by 3 m floor without cuts or gaps?',240,'tiles'],
  ['type','Technology','How many characters can you type in 12 minutes at a steady 4 characters per second?',2880,'characters'],
  ['catch','Sports','Two teams each have 11 players. How many distinct pairs can you form with one player from each team?',121,'pairs'],
  ['mosaic','Arts','A mosaic uses a 32 × 24 grid. How many tiles are there if six tiles are missing?',762,'tiles'],
  ['books','Campus','A library has 38 shelves with 42 books on each shelf. How many books is that?',1596,'books'],
  ['bottles','Volume','How many 250 mL bottles can be filled completely from 18 liters of water?',72,'bottles'],
  ['octagon','Geometry','How many diagonals can be drawn between the vertices of an octagon?',20,'diagonals'],
  ['bytes-night','Technology','How many bytes are in 3 KiB, where a kibibyte is 1024 bytes?',3072,'bytes']
];
const choices=[
  ['deck-rare','rare','Cards','Which is the rarest outcome when drawing one card from a standard 52-card deck?',[
    ['Draw the ace of spades',1],['Draw any queen',4],['Draw a heart',13],['Draw a red card',26]]],
  ['deck-common','common','Cards','Which is the most likely outcome when drawing one card from a standard 52-card deck?',[
    ['Draw a face card',12],['Draw a spade',13],['Draw a red card',26],['Draw any king',4]]],
  ['coins-rare','rare','Probability','Flip four fair coins. Which number of heads is least likely among the choices?',[
    ['Four heads',1],['One head',4],['Two heads',6]]],
  ['coins-common','common','Probability','Flip five fair coins. Which listed count of heads is most likely?',[
    ['Five heads',1],['Four heads',5],['Three heads',10],['Zero heads',1]]],
  ['scrabble-rare','rare','Word games','A bag holds 12 A tiles, 8 E tiles, 3 J tiles and 5 T tiles. Pick the letter least likely to be drawn.',[['A',12],['E',8],['J',3],['T',5]]],
  ['books-common','common','Campus','A library cart has 14 mysteries, 9 biographies, 5 cookbooks and 18 travel books. Which genre is most likely to be picked at random?',[
    ['Mystery',14],['Biography',9],['Cookbook',5],['Travel',18]]],
  ['survey-rare','rare','Campus','A survey of 90 students logged 29 taking the bus, 17 cycling, 38 walking and 6 taking the train. Pick the least reported commute.',[
    ['Bus',29],['Cycling',17],['Walking',38],['Train',6]]],
  ['ticket-common','common','Games','A jar contains 7 purple tickets, 19 orange tickets, 11 silver tickets and 5 gold tickets. Which color comes out most often in random draws with replacement?',[
    ['Purple',7],['Orange',19],['Silver',11],['Gold',5]]]
];
export const extraTrivia=[
  ...estimates.map(([id,category,prompt,answer,unit])=>({id:'free-'+id,kind:'estimate',category,prompt,answer,unit,scale:Math.max(5,Math.round(answer*.4)),time:25,active:true})),
  ...choices.map(([id,kind,category,prompt,options])=>({id:'free-'+id,kind,category,prompt,options:options.map(([text,weight])=>({text,weight})),time:25,active:true}))
];
