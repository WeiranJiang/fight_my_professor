import { readFile } from 'node:fs/promises';
import { cleanQuestionPack } from '../backend/questions.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run questions:check -- path/to/questions.json');
  process.exitCode = 1;
} else {
  try {
    const contents = JSON.parse(await readFile(file, 'utf8'));
    const questions = cleanQuestionPack(contents, index => String(index + 1));
    console.log('Validated '+questions.length+' question'+(questions.length===1?'':'s')+'.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
