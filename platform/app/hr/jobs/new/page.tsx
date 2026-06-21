import { createJob } from '@/app/hr/jobs/actions';
import { Button, Card, Field, Input, PageShell, Select, Textarea } from '@/components/ui';

export default function NewJobPage() {
  return (
    <PageShell title="Post a job" subtitle="Create a posting. External jobs get a public shareable URL automatically.">
      <Card>
        <form action={createJob}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Job title">
                <Input name="title" required placeholder="Senior Software Engineer" />
              </Field>
            </div>
            <Field label="Department">
              <Input name="department" placeholder="Engineering" />
            </Field>
            <Field label="Location">
              <Input name="location" placeholder="Remote / Bengaluru" />
            </Field>
            <Field label="Employment type">
              <Select name="employment_type" defaultValue="Full-time">
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </Select>
            </Field>
            <Field label="Experience required">
              <Input name="experience_required" placeholder="3-5 years" />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Skills required" hint="Comma-separated, e.g. React, TypeScript, Node.js">
                <Input name="skills_required" placeholder="React, TypeScript, Node.js" />
              </Field>
            </div>
            <Field label="Salary min (₹/yr)">
              <Input name="salary_min" type="number" inputMode="numeric" />
            </Field>
            <Field label="Salary max (₹/yr)">
              <Input name="salary_max" type="number" inputMode="numeric" />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Job description">
                <Textarea name="description" rows={4} placeholder="What the role is about…" />
              </Field>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Responsibilities">
                <Textarea name="responsibilities" rows={3} />
              </Field>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Requirements">
                <Textarea name="requirements" rows={3} />
              </Field>
            </div>
            <Field label="ATS threshold score" hint="0-100. Resumes scoring below this are auto-rejected.">
              <Input name="ats_threshold" type="number" defaultValue={60} min={0} max={100} />
            </Field>
            <Field label="Test threshold score" hint="0-100. Minimum assessment score to pass.">
              <Input name="test_threshold" type="number" defaultValue={60} min={0} max={100} />
            </Field>
            <Field label="Hiring manager">
              <Input name="hiring_manager" />
            </Field>
            <Field label="Number of openings">
              <Input name="openings" type="number" defaultValue={1} min={1} />
            </Field>
            <Field label="Application deadline">
              <Input name="deadline" type="date" />
            </Field>
            <Field label="Visibility">
              <Select name="visibility" defaultValue="external">
                <option value="external">External (public)</option>
                <option value="internal">Internal (employees only)</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" style={{ marginTop: 8 }}>
            Create job
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
