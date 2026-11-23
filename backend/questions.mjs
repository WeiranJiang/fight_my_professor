import { allowedUrl, requireRule, value } from './request.mjs';

export function cleanQuestion(body, id) {
  const prompt=value(body.prompt,240), unit=value(body.unit,32), category=value(body.category,32);
  const answer=body.answer,scale=body.scale,time=body.time;
  requireRule(prompt&&unit&&category&&Number.isFinite(answer)&&answer>=0&&answer<=1e12&&Number.isFinite(scale)&&scale>0&&Number.isInteger(time)&&time>=10&&time<=120,'Complete the question and enter valid numeric limits.');
  return {id,prompt,unit,category,answer,scale,time,source:allowedUrl(body.source),active:body.active===true};
}

