import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { updatePathItem } from '@/app/learn/actions';
import { Button, Card, PageShell } from '@/components/ui';
import { CourseRecommendations } from '@/components/learn/CourseRecommendations';
import type { LearningPath, PathItem, PathItemStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<PathItemStatus, { dot: string; label: string; color: string }> = {
  completed: { dot: 'var(--success)', label: 'Completed', color: 'var(--success)' },
  in_progress: { dot: 'var(--accent)', label: 'In progress', color: 'var(--accent)' },
  not_started: { dot: 'var(--text-faint)', label: 'Not started', color: 'var(--text-muted)' },
};

export default async function LearningPathPage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: pathRow } = await supabase
    .from('learning_paths')
    .select('*')
    .eq('employee_id', profile!.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const path = pathRow as LearningPath | null;

  let items: PathItem[] = [];
  if (path) {
    const { data } = await supabase.from('path_items').select('*').eq('path_id', path.id).order('ord');
    items = (data ?? []) as PathItem[];
  }

  return (
    <PageShell
      title="Learning path"
      subtitle={path?.title ?? 'Your personalized learning journey'}
      action={<Link href="/learn"><Button variant="secondary">← Back</Button></Link>}
    >
      {!path ? (
        <Card>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No active path yet. <Link href="/learn" className="ui-link">Run a skill analysis</Link> to generate one.
          </p>
        </Card>
      ) : (
        <div style={{ position: 'relative' }}>
          {items.map((item, i) => {
            const s = STATUS_STYLE[item.status];
            const next: PathItemStatus = item.status === 'completed' ? 'not_started' : item.status === 'in_progress' ? 'completed' : 'in_progress';
            const nextLabel = item.status === 'completed' ? 'Reset' : item.status === 'in_progress' ? 'Mark complete' : 'Start';
            return (
              <div key={item.id} style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                {/* Flow rail */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 9999, flexShrink: 0,
                    background: 'var(--surface-solid)', border: `2px solid ${s.dot}`,
                    color: s.dot, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                  }}>{i + 1}</div>
                  {i < items.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 24 }} />}
                </div>

                {/* Node card */}
                <Card style={{ flex: 1, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{item.title}</div>
                      <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>● {s.label}</span>
                    </div>
                    <form action={updatePathItem}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="status" value={next} />
                      <Button type="submit" variant={item.status === 'in_progress' ? 'primary' : 'secondary'} style={{ fontSize: 13, padding: '6px 12px' }}>
                        {nextLabel}
                      </Button>
                    </form>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <CourseRecommendations query={item.title} />
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
