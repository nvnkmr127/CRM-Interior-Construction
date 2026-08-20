const aiService = require('./src/services/aiService');

async function runTests() {
  console.log('--- STARTING SENTIMENT FIX VERIFICATION ---');

  const negativeTranscript = `
    The client was extremely unhappy with the progress.
    They complained that the pricing is way too expensive and has gone over budget.
    They are frustrated with the delay and want to cancel the contract if we don't fix these issues.
    We need to send a revised quote by tomorrow.
  `;

  const positiveTranscript = `
    The client loved the layout design.
    They said the colors are perfect and they are very excited to start the construction.
    Everything looks great and they agreed to the proposal.
    We should schedule the site visit soon.
  `;

  const neutralTranscript = `
    The client asked about the dimensions of the living room cabinets.
    We discussed whether to use laminate or veneer finishes.
    We will meet again next week.
  `;

  // Test Negative Case
  console.log('\n--- TESTING NEGATIVE CASE ---');
  const negSummary = await aiService.summarizeMeeting(negativeTranscript);
  const negCoach = await aiService.analyzeMeetingForCoaching(negativeTranscript);
  console.log('Sentiment:', negSummary.customer_sentiment);
  console.log('Summary:', negSummary.summary);
  console.log('Action Items:', negSummary.action_items);
  console.log('Coach Feedback:', negCoach.feedback);
  console.log('Missed Questions:', negCoach.missed_questions);
  console.log('Strengths:', negCoach.strengths);

  if (negSummary.customer_sentiment !== 'Negative') {
    throw new Error('Test failed: Expected Negative sentiment');
  }

  // Test Positive Case
  console.log('\n--- TESTING POSITIVE CASE ---');
  const posSummary = await aiService.summarizeMeeting(positiveTranscript);
  const posCoach = await aiService.analyzeMeetingForCoaching(positiveTranscript);
  console.log('Sentiment:', posSummary.customer_sentiment);
  console.log('Summary:', posSummary.summary);
  console.log('Action Items:', posSummary.action_items);
  console.log('Coach Feedback:', posCoach.feedback);
  console.log('Missed Questions:', posCoach.missed_questions);
  console.log('Strengths:', posCoach.strengths);

  if (posSummary.customer_sentiment !== 'Positive') {
    throw new Error('Test failed: Expected Positive sentiment');
  }

  // Test Neutral Case
  console.log('\n--- TESTING NEUTRAL CASE ---');
  const neutSummary = await aiService.summarizeMeeting(neutralTranscript);
  const neutCoach = await aiService.analyzeMeetingForCoaching(neutralTranscript);
  console.log('Sentiment:', neutSummary.customer_sentiment);
  console.log('Summary:', neutSummary.summary);
  console.log('Action Items:', neutSummary.action_items);
  console.log('Coach Feedback:', neutCoach.feedback);
  console.log('Missed Questions:', neutCoach.missed_questions);
  console.log('Strengths:', neutCoach.strengths);

  if (neutSummary.customer_sentiment !== 'Neutral') {
    throw new Error('Test failed: Expected Neutral sentiment');
  }

  console.log('\n--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
