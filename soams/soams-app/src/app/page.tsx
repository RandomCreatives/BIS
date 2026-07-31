import { redirect } from 'next/navigation';

// Entry point: the (protected) layout decides between /dashboard, /login,
// and the setup notice.
export default function Home() {
  redirect('/dashboard');
}
