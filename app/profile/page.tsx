import type { Metadata } from 'next';
import ProfileDashboard from '@/components/ProfileDashboard';

export const metadata: Metadata = {
  title: 'Your profile — KeyMania',
  description: 'Your display name, your speed, and how it has been trending.',
};

export default function ProfilePage() {
  return <ProfileDashboard />;
}
