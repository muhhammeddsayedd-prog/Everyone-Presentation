import type { CandidateMedia } from '@eps/domain';
const messages:Record<CandidateMedia['processing_issues'][number],string>={
  NO_AUDIO:'No clear spoken audio was available for transcription. Enter supplied facts manually or add a new introduction.',
  TRANSCRIPTION_FAILED:'This introduction could not be transcribed. Available frames are retained. Enter supplied facts manually or add a new introduction.',
  EXTRACTION_FAILED:'Facts could not be extracted. Review the original video and any available English transcript, then enter supplied facts manually.',
  FRAME_SELECTION_UNAVAILABLE:'Automatic frame review was unavailable. Inspect and choose real source frames manually; your original video and supplied facts are retained.',
  INSUFFICIENT_FRAMES:'Fewer than three frames were selected. You can continue or choose other available frames.',
  ENGLISH_TRANSCRIPT_UNAVAILABLE:'The English transcript could not be prepared. Your original video and supplied facts are retained. Add a new introduction to try again.',
};
export function CandidateProcessingIssues({issues}:{issues:CandidateMedia['processing_issues']}){
 return issues.length?<div className="notice" role="status"><ul>{issues.map(code=><li key={code}>{messages[code]}</li>)}</ul></div>:null;
}
