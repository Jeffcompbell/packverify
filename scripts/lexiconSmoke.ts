import { matchLexicon, lexiconHitsToIssues } from '../src/services/lexiconService';

const sampleText = `This miracle cream can cure acne, treat redness, and heal scars fast.
It claims to be FDA approved for disease treatment.`;

const hits = matchLexicon(sampleText, 'cosmetics', ['US'], ['general', 'cosmetics']);
console.log('Raw hits:', hits.map(hit => ({ id: hit.entry.id, match: hit.matchedText, severity: hit.entry.severity })));

const issues = lexiconHitsToIssues(hits);
console.log('Issues formatted:', issues.map(issue => ({
  id: issue.id,
  problem: issue.problem,
  suggestion: issue.suggestion,
  severity: issue.severity,
  context: issue.context
})));
