import { GuestReviewView } from '../../../components/GuestReviewView';

export const dynamic = 'force-dynamic';
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestReviewView entryToken={token} />;
}
