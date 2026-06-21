export type UserRole =
  | 'super_admin'
  | 'hr_admin'
  | 'internal_employee'
  | 'external_candidate';

export type JobVisibility = 'internal' | 'external';
export type JobStatus = 'draft' | 'active' | 'closed';

export type ApplicationStatus =
  | 'applied'
  | 'ats_review'
  | 'ats_rejected'
  | 'assessment_assigned'
  | 'assessment_passed'
  | 'assessment_failed'
  | 'hr_review'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected';

export type Profile = {
  id: string;
  org_id: string | null;
  role: UserRole;
  name: string | null;
  email: string | null;
  mobile: string | null;
  aadhaar: string | null;
  aadhaar_verified: boolean;
  created_at: string;
};

export type Job = {
  id: string;
  org_id: string | null;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  experience_required: string | null;
  skills_required: string[];
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  ats_threshold: number;
  test_threshold: number;
  hiring_manager: string | null;
  openings: number;
  deadline: string | null;
  visibility: JobVisibility;
  status: JobStatus;
  public_slug: string | null;
  created_by: string | null;
  created_at: string;
};

export type AtsBreakdown = {
  skill: number;
  experience: number;
  education: number;
  domain: number;
  keyword: number;
  project: number;
};

export type ParsedResume = {
  name?: string;
  skills?: string[];
  education?: string[];
  experience?: string[];
  certifications?: string[];
  projects?: string[];
};

export type Application = {
  id: string;
  job_id: string;
  candidate_id: string;
  resume_url: string | null;
  current_company: string | null;
  current_role: string | null;
  experience: string | null;
  notice_period: string | null;
  expected_salary: string | null;
  skills: string[];
  linkedin: string | null;
  portfolio: string | null;
  parsed: ParsedResume | null;
  ats_score: number | null;
  ats_breakdown: AtsBreakdown | null;
  ats_reasoning: string | null;
  assessment_score: number | null;
  status: ApplicationStatus;
  interview_attempts: number;
  created_at: string;
};

export type ApplicationEvent = {
  id: string;
  application_id: string;
  type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Interview = {
  id: string;
  application_id: string;
  scheduled_at: string;
  mode: string;
  location: string | null;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

export type Offer = {
  id: string;
  application_id: string;
  salary: string | null;
  joining_date: string | null;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  org_id: string | null;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

// Org-level configuration (Super Admin). Stored in organizations.settings jsonb.
export type OrgSettings = {
  default_ats_threshold?: number;
  default_test_threshold?: number;
  notify_application_submitted?: boolean;
  notify_ats?: boolean;
  notify_assessment?: boolean;
  notify_interview?: boolean;
  notify_offer?: boolean;
};

// ---------- AI Learning & Career Buddy ----------
export type Competency = {
  id: string;
  org_id: string | null;
  name: string;
  category: string | null;
  description: string | null;
};

export type CareerRole = {
  id: string;
  org_id: string | null;
  title: string;
  level: string | null;
  description: string | null;
};

export type SkillGap = { competency: string; current: number; required: number };

export type SkillGapReport = {
  id: string;
  employee_id: string;
  target_role_id: string | null;
  readiness_score: number;
  gaps: SkillGap[] | null;
  reasoning: string | null;
  created_at: string;
};

export type LearningPath = {
  id: string;
  employee_id: string;
  target_role_id: string | null;
  title: string;
  status: 'active' | 'completed';
  created_at: string;
};

export type PathItemStatus = 'not_started' | 'in_progress' | 'completed';

export type PathItem = {
  id: string;
  path_id: string;
  ord: number;
  title: string;
  competency_id: string | null;
  course_id: string | null;
  status: PathItemStatus;
  created_at: string;
};

export type CourseProvider = 'youtube' | 'linkedin' | 'percipio' | 'lms';

export type Course = {
  id: string;
  org_id?: string | null;
  provider: CourseProvider;
  external_id: string | null;
  title: string;
  url: string | null;
  description: string | null;
  skills: string[];
  duration_minutes: number | null;
  level: string | null;
};

export type Enrollment = {
  id: string;
  employee_id: string;
  course_id: string;
  status: 'assigned' | 'in_progress' | 'completed';
  progress_pct: number;
  hours_spent: number;
  completed_at: string | null;
  created_at: string;
};

export type Certification = {
  id: string;
  employee_id: string;
  name: string;
  issuer: string | null;
  issued_date: string | null;
  url: string | null;
};

export type TrainingRequestType = 'training' | 'certification' | 'workshop' | 'conference';
export type TrainingRequestStatus = 'pending' | 'approved' | 'rejected';

export type TrainingRequest = {
  id: string;
  employee_id: string;
  type: TrainingRequestType;
  title: string;
  justification: string | null;
  cost: string | null;
  status: TrainingRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

// Ordered pipeline used by dashboards / timelines.
export const PIPELINE_STAGES: ApplicationStatus[] = [
  'applied',
  'ats_review',
  'assessment_assigned',
  'assessment_passed',
  'hr_review',
  'interview',
  'offer',
  'hired',
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  ats_review: 'ATS Review',
  ats_rejected: 'Rejected — ATS criteria not met',
  assessment_assigned: 'Assessment Assigned',
  assessment_passed: 'Assessment Passed',
  assessment_failed: 'Assessment Not Cleared',
  hr_review: 'HR Review',
  interview: 'Interview Scheduled',
  offer: 'Offer Released',
  hired: 'Hired',
  rejected: 'Rejected',
};
