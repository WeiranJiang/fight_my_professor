import { allowedUrl, requireRule, value } from './request.mjs';

export function cleanQuestion(body, id) {
  requireRule(body && typeof body === 'object' && !Array.isArray(body), 'Expected a question object.');
  requireRule(typeof body.active === 'boolean', 'Active must be true or false.');
  requireRule(!body.source || allowedUrl(body.source), 'Source must be an HTTPS URL.');
  const prompt=value(body.prompt,240), unit=value(body.unit,32), category=value(body.category,32);
  const answer=body.answer,scale=body.scale,time=body.time;
  requireRule(prompt&&unit&&category&&Number.isFinite(answer)&&answer>=0&&answer<=1e12&&(unit!=='%'||answer<=100)&&Number.isFinite(scale)&&scale>0&&Number.isInteger(time)&&time>=10&&time<=120,'Complete the question and enter valid numeric limits.');
  return {id,prompt,unit,category,answer,scale,time,source:allowedUrl(body.source),active:body.active===true};
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
