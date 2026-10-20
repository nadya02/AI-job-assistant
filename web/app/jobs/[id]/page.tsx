import { redirect } from 'next/navigation';

// The job page now lives in the detail panel on the jobs list.
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/?job=${encodeURIComponent(id)}`);
}
