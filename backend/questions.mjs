import { allowedUrl, requireRule, value } from './request.mjs';

export function cleanQuestion(body, id) {
  requireRule(body && typeof body === 'object' && !Array.isArray(body), 'Expected a question object.');
  requireRule(typeof body.active === 'boolean', 'Active must be true or false.');
  requireRule(!body.source || allowedUrl(body.source), 'Source must be an HTTPS URL.');
  const prompt=value(body.prompt,240), category=value(body.category,32), time=body.time;
  const kind=body.kind??'estimate';
  requireRule(prompt&&category&&Number.isInteger(time)&&time>=10&&time<=120&&['estimate','rare','common'].includes(kind),'Enter a prompt, category, and time limit of 10–120 seconds.');
  const common={id,prompt,category,time,kind,source:allowedUrl(body.source),active:body.active};
  if(kind!=='estimate'){
    requireRule(Array.isArray(body.options)&&body.options.length>=2&&body.options.length<=8,'Provide two to eight weighted options.');
    const options=body.options.map(entry=>({text:value(entry?.text,120),weight:entry?.weight}));
    requireRule(options.every(option=>option.text&&Number.isFinite(option.weight)&&option.weight>=0&&option.weight<=1e12),'Each option needs a label and a valid weight.');
    requireRule(new Set(options.map(option=>option.text.toLowerCase())).size===options.length&&new Set(options.map(option=>option.weight)).size>1,'Options must be distinct and have at least two different weights.');
    return {...common,options};
  }
  const unit=value(body.unit,32), answer=body.answer,scale=body.scale;
  requireRule(unit&&Number.isFinite(answer)&&answer>=0&&answer<=1e12&&(unit!=='%'||answer<=100)&&Number.isFinite(scale)&&scale>0,'Complete the question and enter valid numeric limits.');
  return {...common,unit,answer,scale};
}

export function cleanQuestionPack(questions, nextId) {
  requireRule(Array.isArray(questions) && questions.length > 0 && questions.length <= 150,
    'Provide a JSON array of 1–150 questions.');
  return questions.map((question, index) => {
    try {
      return cleanQuestion(question, nextId(index));
    } catch (error) {
      requireRule(false, 'Question '+(index+1)+': '+error.message);
    }
  });
}
