import type { ApplicationStatus } from '@/lib/types';

// URL-safe slug from a job title; a short suffix keeps it unique.
export function slugify(title: string, suffix: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'job'}-${suffix}`;
}

// Aadhaar is 12 digits. We format-validate only (mock verify — not UIDAI-checked).
export function isValidAadhaar(value: string): boolean {
  return /^\d{12}$/.test(value.replace(/\s/g, ''));
}

export function maskAadhaar(value: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\s/g, '');
  if (digits.length !== 12) return value;
  return `XXXX XXXX ${digits.slice(8)}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Translucent badge colors tuned for the dark theme.
export function statusColor(status: ApplicationStatus): { bg: string; fg: string } {
  switch (status) {
    case 'hired':
    case 'assessment_passed':
    case 'offer':
      return { bg: 'rgba(52, 211, 153, 0.14)', fg: '#34d399' };
    case 'ats_rejected':
    case 'assessment_failed':
    case 'rejected':
      return { bg: 'rgba(248, 113, 113, 0.14)', fg: '#f87171' };
    case 'assessment_assigned':
    case 'interview':
      return { bg: 'rgba(34, 211, 238, 0.14)', fg: '#22d3ee' };
    case 'hr_review':
      return { bg: 'rgba(251, 191, 36, 0.14)', fg: '#fbbf24' };
    default:
      return { bg: 'rgba(148, 163, 184, 0.14)', fg: '#cbd5e1' };
  }
}
