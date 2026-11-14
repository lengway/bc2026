import evaluation from './evaluation.json';
import moves from './move-reviews.json';

export { default as caseView } from './case-view.json';
export { default as eventsPage } from './events-page.json';
export { default as certificateLimited } from './certificate-limited.json';
export { default as certificateFull } from './certificate-full.json';
export { default as skillPath } from './skill-path.json';
export { default as insufficientReview } from './insufficient-review.json';
export { default as insufficientEventsPage } from './insufficient-events-page.json';
export { default as editorBatches } from './editor-batches.json';
export { default as editorAcks } from './editor-acks.json';
export { evaluation, moves };
export const review = { evaluation, moves };
