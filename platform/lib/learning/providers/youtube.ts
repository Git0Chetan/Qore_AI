import type { Course } from '@/lib/types';

// Live YouTube Data API search. Returns [] when no API key is set so the
// aggregator can fall back to other providers.
export async function searchYouTube(query: string, max = 4): Promise<Course[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  try {
    const url =
      'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&safeSearch=strict' +
      `&maxResults=${max}&q=${encodeURIComponent(query + ' tutorial')}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    type YtItem = {
      id?: { videoId?: string };
      snippet?: { title?: string; description?: string; channelTitle?: string };
    };
    const items: YtItem[] = Array.isArray(data?.items) ? data.items : [];
    return items
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        id: `youtube:${it.id!.videoId}`,
        provider: 'youtube' as const,
        external_id: it.id!.videoId ?? null,
        title: it.snippet?.title ?? 'YouTube video',
        url: `https://www.youtube.com/watch?v=${it.id!.videoId}`,
        description: it.snippet?.channelTitle ?? it.snippet?.description ?? null,
        skills: [query],
        duration_minutes: null,
        level: null,
      }));
  } catch {
    return [];
  }
}
