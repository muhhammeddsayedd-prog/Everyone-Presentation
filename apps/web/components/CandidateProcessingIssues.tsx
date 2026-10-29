import type { CandidateMedia } from '@eps/domain';
const messages:Record<CandidateMedia['processing_issues'][number],string>={
  NO_AUDIO:'No clear spoken audio was available for transcription. Enter supplied facts manually or add a new introduction.',
  TRANSCRIPTION_FAILED:'This introduction could not be transcribed. Available frames are retained. Enter supplied facts manually or add a new introduction.',
  EXTRACTION_FAILED:'The original transcript is available, but facts could not be extracted. Review the transcript and enter supplied facts manually.',
  INSUFFICIENT_FRAMES:'Fewer than three frames were selected. You can continue or choose other available frames.',
};
export function CandidateProcessingIssues({issues}:{issues:CandidateMedia['processing_issues']}){
 return issues.length?<div className="notice" role="status"><ul>{issues.map(code=><li key={code}>{messages[code]}</li>)}</ul></div>:null;
}
