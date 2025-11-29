import { redirect } from 'next/navigation';

/**
 * Main /create page - redirects to /create/upload (Step 1)
 */
export default function CreatePage() {
  redirect('./create/upload');
}
