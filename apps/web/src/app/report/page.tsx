import type { Metadata } from 'next';
import { ReportFlow } from './ReportFlow';

export const metadata: Metadata = {
  title: 'Report a problem',
  description:
    'Report a low-risk community asset problem without a wallet. Photos are re-encoded to remove EXIF/GPS and can be redacted before upload.',
};

export default function ReportPage() {
  return <ReportFlow />;
}
