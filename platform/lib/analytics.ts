import type { Application, ApplicationEvent, Job } from '@/lib/types';

export type Metrics = {
  totalJobs: number;
  activeJobs: number;
  closedJobs: number;
  draftJobs: number;
  totalApplications: number;
  funnel: { label: string; count: number }[];
  conversion: { label: string; rate: number }[];
  assessmentSuccessRate: number;
  atsAverage: number;
  atsDistribution: { bucket: string; count: number }[];
  avgTimeToHireDays: number | null;
  hired: number;
  skillGap: { skill: string; count: number }[];
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function computeMetrics(
  jobs: Job[],
  apps: Application[],
  events: ApplicationEvent[],
): Metrics {
  const has = (...s: Application['status'][]) => apps.filter((a) => s.includes(a.status)).length;

  // Cumulative funnel: each stage counts everyone who reached it or beyond.
  const reachedAssessment = apps.filter((a) =>
    ['assessment_assigned', 'assessment_passed', 'assessment_failed', 'hr_review', 'interview', 'offer', 'hired'].includes(a.status),
  ).length;
  const passedAssessment = apps.filter((a) =>
    ['assessment_passed', 'hr_review', 'interview', 'offer', 'hired'].includes(a.status),
  ).length;
  const reachedInterview = apps.filter((a) => ['interview', 'offer', 'hired'].includes(a.status)).length;
  const reachedOffer = apps.filter((a) => ['offer', 'hired'].includes(a.status)).length;
  const hired = has('hired');

  const assessmentSuccessRate = pct(
    has('assessment_passed', 'hr_review', 'interview', 'offer', 'hired'),
    has('assessment_passed', 'assessment_failed', 'hr_review', 'interview', 'offer', 'hired'),
  );

  const scored = apps.filter((a) => a.ats_score != null) as (Application & { ats_score: number })[];
  const atsAverage = scored.length
    ? Math.round(scored.reduce((s, a) => s + a.ats_score, 0) / scored.length)
    : 0;
  const buckets = [
    { bucket: '0-39', min: 0, max: 39 },
    { bucket: '40-59', min: 40, max: 59 },
    { bucket: '60-79', min: 60, max: 79 },
    { bucket: '80-100', min: 80, max: 100 },
  ];
  const atsDistribution = buckets.map((b) => ({
    bucket: b.bucket,
    count: scored.filter((a) => a.ats_score >= b.min && a.ats_score <= b.max).length,
  }));

  // Time-to-hire: apply date -> last activity for hired applications.
  const eventsByApp = new Map<string, ApplicationEvent[]>();
  for (const e of events) {
    const list = eventsByApp.get(e.application_id) ?? [];
    list.push(e);
    eventsByApp.set(e.application_id, list);
  }
  const hireDurations: number[] = [];
  for (const a of apps.filter((x) => x.status === 'hired')) {
    const evs = eventsByApp.get(a.id) ?? [];
    const last = evs.reduce((max, e) => Math.max(max, new Date(e.created_at).getTime()), 0);
    if (last > 0) hireDurations.push((last - new Date(a.created_at).getTime()) / 86_400_000);
  }
  const avgTimeToHireDays = hireDurations.length
    ? Math.round((hireDurations.reduce((s, d) => s + d, 0) / hireDurations.length) * 10) / 10
    : null;

  // Skill gap: among ATS-rejected candidates, which required skills were most often missing?
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const gap = new Map<string, number>();
  for (const a of apps.filter((x) => x.status === 'ats_rejected')) {
    const job = jobById.get(a.job_id);
    if (!job) continue;
    const have = new Set((a.skills ?? []).concat(a.parsed?.skills ?? []).map((s) => s.toLowerCase()));
    for (const req of job.skills_required) {
      if (!have.has(req.toLowerCase())) gap.set(req, (gap.get(req) ?? 0) + 1);
    }
  }
  const skillGap = [...gap.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalJobs: jobs.length,
    activeJobs: jobs.filter((j) => j.status === 'active').length,
    closedJobs: jobs.filter((j) => j.status === 'closed').length,
    draftJobs: jobs.filter((j) => j.status === 'draft').length,
    totalApplications: apps.length,
    funnel: [
      { label: 'Applied', count: apps.length },
      { label: 'Assessment', count: reachedAssessment },
      { label: 'Passed', count: passedAssessment },
      { label: 'Interview', count: reachedInterview },
      { label: 'Offer', count: reachedOffer },
      { label: 'Hired', count: hired },
    ],
    conversion: [
      { label: 'Applied → Assessment', rate: pct(reachedAssessment, apps.length) },
      { label: 'Assessment → Passed', rate: pct(passedAssessment, reachedAssessment) },
      { label: 'Interview → Offer', rate: pct(reachedOffer, reachedInterview) },
      { label: 'Offer → Hired', rate: pct(hired, reachedOffer) },
    ],
    assessmentSuccessRate,
    atsAverage,
    atsDistribution,
    avgTimeToHireDays,
    hired,
    skillGap,
  };
}
