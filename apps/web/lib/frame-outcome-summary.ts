import type {FrameExtractionOutcome} from '@eps/central';
export function frameOutcomeSummary(outcome: FrameExtractionOutcome) {
  const parts=[`${outcome.extracted_count} distinct frame${outcome.extracted_count===1?'':'s'} extracted from ${outcome.requested_count} requested time${outcome.requested_count===1?'':'s'}.`];
  if(outcome.unavailable_timestamps_ms.length)parts.push(`No frame was available at: ${outcome.unavailable_timestamps_ms.map(time=>`${(time/1000).toFixed(3)}s`).join(', ')}.`);
  if(outcome.warnings.includes('FRAME_TIMESTAMP_SHARED'))parts.push('Nearby requested times shared a source frame.');
  return parts.join(' ');
}
