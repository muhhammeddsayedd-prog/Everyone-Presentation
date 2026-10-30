/** Exact classifier for this synthetic 200-file experiment, never a product SLA. */
export function assessSyntheticWorkload({summary:s,distinct,prepared,restart,expected_failures}) {
  const fields=['total_files','succeeded','failed','pending','running','unconfirmed','total_attempts','retries','native_requests','peak_inflight','restarts'];
  if(!s||fields.some(field=>!Number.isSafeInteger(s[field])||s[field]<0)||s.total_files!==200||s.succeeded+s.failed+s.pending+s.running+s.unconfirmed!==200||s.running!==0||s.unconfirmed!==0||s.peak_inflight<1||s.peak_inflight>2||distinct!==200)return'failed';
  if(s.pending>0)return'bounded_partial';
  const expected={VIDEO_CONTAINER_UNAVAILABLE:1,VIDEO_DECODE_FAILED:1,VIDEO_TYPE_UNSUPPORTED:1};
  if(s.succeeded!==198||s.failed!==2||s.total_attempts!==201||s.retries!==1||s.native_requests!==199||s.restarts!==1||prepared!==6||restart!==true||expected_failures!==true||!s.failure_codes||Object.keys(s.failure_codes).length!==3||Object.entries(expected).some(([code,count])=>s.failure_codes[code]!==count))return'failed';
  return'passed';
}
