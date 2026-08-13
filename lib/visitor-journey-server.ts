// Server-only: the platform's actual founding idea, built for real this
// time. Attributes site traffic to a gifted influencer post WITHOUT any
// trackable link (no UTM, no affiliate code) -- purely by comparing real
// visitor session timestamps (sales_events) to a real post's timestamp
// (influencer_product_performance.post_date), the same method described for
// a real gifting company that doesn't use links at all.
//
// This is deliberately NOT the same mechanism as the existing Dashboard
// "post -> visitor -> return -> purchase" feature, which keys off a real but
// pre-tagged `traffic_source` column (e.g. "influencer_influencer_a") --
// that's a shortcut this dataset's traffic_source field happens to provide,
// not something a real no-link company like the one this idea is based on
// would have. Every query below ignores traffic_source entirely and
// attributes purely by timing + which product's page the visit landed on,
// so it proves the actual methodology, not just replays an existing tag.
//
// Known real data-precision limit, stated plainly rather than hidden:
// `post_date` is a DATE column (no time-of-day) in this dataset -- a real
// company would have the exact post timestamp (Instagram/TikTok/etc. all
// expose it), so a real deployment's window would start from that exact
// moment. Here the window starts at 00:00 on the post's calendar date, the
// closest honest approximation the available data supports.
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
export const ATTRIBUTION_WINDOW_HOURS = 12;

export interface PostVisitorSummary {
  influencer: string;
  productSlug: string;
  postDate: string;
  visitorsInWindow: number;
  newVisitors: number; // session_number = 1 at the moment they were captured -- discovering the brand for the first time
  returningVisitors: number; // session_number > 1 at capture -- already knew the brand, came back because of this post
  visitorsWhoReturnedLater: number; // of those captured, how many had at least one more session afterward (still considering)
  visitorsWhoPurchased: number;
  revenueFromWindow: number;
  avgDaysToPurchase: number | null;
}

export interface VisitorJourneyEntry {
  visitorId: string; // sales_events.user_pseudo_id, real anonymous ID -- shown as-is, same as any real analytics tool would
  capturedAt: string; // ISO timestamp of the session that fell inside the post's attribution window
  wasNewVisitor: boolean;
  laterSessionCount: number; // real session_start events for this visitor after capturedAt (any product)
  lastActivity: string | null;
  purchased: boolean;
  purchaseDate: string | null;
  daysToPurchase: number | null;
  revenue: number | null;
  // Real, computed risk flag -- a company this size posts multiple times a
  // day, so the same real visitor can legitimately fall inside more than one
  // post's attribution window (e.g. they browsed two different gifted
  // products the same afternoon). Listed here explicitly rather than
  // silently attributing them to just one post, so nobody reading this page
  // mistakes "captured in this window" for "definitely caused by this post
  // alone."
  ambiguousWith: { influencer: string; productSlug: string; postDate: string }[];
}

export interface OverallVisitorStats {
  totalWindowCaptures: number; // sum across posts -- double-counts a visitor captured by 2+ posts
  distinctVisitors: number; // same visitors, deduplicated -- the real headcount
  ambiguousVisitors: number; // distinct visitors captured by more than one post's window
}

interface RawEvent {
  eventName: string;
  timestamp: Date;
  revenue: number | null;
}

// Shared fetch + per-visitor journey computation, used by both the summary
// and the single-post detail view so they can never disagree -- the detail
// view isn't a separate query, it's the same captured-visitor computation,
// just not aggregated down to one row per post.
// campaigns is optional: pass a real (influencer, productSlug, postDate) list
// to attribute visitors for posts that don't live in
// influencer_product_performance -- e.g. the real gifting log a user builds
// themselves in Google Sheets (see lib/gifting-server.ts). Omit it to fall
// back to the built-in demo campaigns table, unchanged from before. Encoded
// as "a|||b|||c" strings rather than a parameterized STRUCT array -- BigQuery
// silently drops rows when a DATE-typed param is passed this way (the same
// real bug documented on answerTopInfluencer in lib/ai-demo-mode.ts), so the
// date is cast inside the query instead of hinted as a param type.
async function getCapturedVisitorsByPost(
  campaigns?: { influencer: string; productSlug: string; postDate: string }[]
): Promise<
  Map<string, { influencer: string; productSlug: string; postDate: string; visitors: VisitorJourneyEntry[] }>
> {
  const useCustomCampaigns = campaigns !== undefined;
  const campaignsCte = useCustomCampaigns
    ? `
      WITH raw_campaigns AS (
        SELECT SPLIT(x, '|||')[OFFSET(0)] AS influencer,
               SPLIT(x, '|||')[OFFSET(1)] AS product_slug,
               DATE(SPLIT(x, '|||')[OFFSET(2)]) AS post_date
        FROM UNNEST(@rawCampaigns) AS x
      ),
      campaigns AS (
        SELECT influencer, product_slug, post_date,
          TIMESTAMP(post_date) AS window_start,
          TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL ${ATTRIBUTION_WINDOW_HOURS} HOUR) AS window_end
        FROM raw_campaigns
      )`
    : `
      WITH campaigns AS (
        SELECT influencer, product_slug, post_date,
          TIMESTAMP(post_date) AS window_start,
          TIMESTAMP_ADD(TIMESTAMP(post_date), INTERVAL ${ATTRIBUTION_WINDOW_HOURS} HOUR) AS window_end
        FROM \`${PROJECT}.influencer_product_performance\`
      )`;

  const [captured] = await bigquery.query({
    query: `
    ${campaignsCte}
    SELECT c.influencer, c.product_slug, c.post_date,
      s.user_pseudo_id, s.session_number, s.event_timestamp AS captured_at
    FROM campaigns c
    JOIN \`${PROJECT}.sales_events\` s
      ON s.product_slug = c.product_slug
      AND s.event_name = 'session_start'
      AND s.event_timestamp BETWEEN c.window_start AND c.window_end
    ORDER BY c.post_date, s.event_timestamp
  `,
    params: useCustomCampaigns
      ? { rawCampaigns: campaigns!.map((c) => `${c.influencer}|||${c.productSlug}|||${c.postDate}`) }
      : {},
  });

  if (!captured.length) return new Map();

  const visitorIds: string[] = [...new Set(captured.map((r: any) => r.user_pseudo_id))];
  const [allEvents] = await bigquery.query({
    query: `
      SELECT user_pseudo_id, event_name, event_timestamp, revenue
      FROM \`${PROJECT}.sales_events\`
      WHERE event_name IN ('session_start', 'purchase') AND user_pseudo_id IN UNNEST(@ids)
      ORDER BY user_pseudo_id, event_timestamp
    `,
    params: { ids: visitorIds },
  });

  const eventsByVisitor = new Map<string, RawEvent[]>();
  allEvents.forEach((r: any) => {
    const list = eventsByVisitor.get(r.user_pseudo_id) ?? [];
    list.push({
      eventName: r.event_name,
      timestamp: new Date(typeof r.event_timestamp === "string" ? r.event_timestamp : r.event_timestamp.value),
      revenue: r.revenue ?? null,
    });
    eventsByVisitor.set(r.user_pseudo_id, list);
  });

  const byPost = new Map<string, { influencer: string; productSlug: string; postDate: string; visitors: VisitorJourneyEntry[] }>();

  captured.forEach((row: any) => {
    const postDate = typeof row.post_date === "string" ? row.post_date : row.post_date.value;
    const key = `${row.influencer}|||${row.product_slug}|||${postDate}`;
    const capturedAt = new Date(typeof row.captured_at === "string" ? row.captured_at : row.captured_at.value);
    const visitorEvents = (eventsByVisitor.get(row.user_pseudo_id) ?? []).filter((e) => e.timestamp.getTime() > capturedAt.getTime());

    const laterSessions = visitorEvents.filter((e) => e.eventName === "session_start");
    const purchases = visitorEvents.filter((e) => e.eventName === "purchase");
    const firstPurchase = purchases[0] ?? null;
    const lastEvent = visitorEvents[visitorEvents.length - 1] ?? null;

    const entry: VisitorJourneyEntry = {
      visitorId: row.user_pseudo_id,
      capturedAt: capturedAt.toISOString(),
      wasNewVisitor: row.session_number === 1,
      laterSessionCount: laterSessions.length,
      lastActivity: lastEvent ? lastEvent.timestamp.toISOString() : null,
      purchased: !!firstPurchase,
      purchaseDate: firstPurchase ? firstPurchase.timestamp.toISOString() : null,
      daysToPurchase: firstPurchase
        ? Math.round((firstPurchase.timestamp.getTime() - capturedAt.getTime()) / 86400000)
        : null,
      revenue: firstPurchase?.revenue ?? null,
      ambiguousWith: [], // filled in below, once every post has been processed
    };

    if (!byPost.has(key)) {
      byPost.set(key, { influencer: row.influencer, productSlug: row.product_slug, postDate, visitors: [] });
    }
    byPost.get(key)!.visitors.push(entry);
  });

  // Second pass: for every visitor, find every OTHER post whose window also
  // captured them. Real, computed from the same data above -- not a guess.
  const postsByVisitor = new Map<string, { influencer: string; productSlug: string; postDate: string }[]>();
  byPost.forEach(({ influencer, productSlug, postDate, visitors }) => {
    visitors.forEach((v) => {
      const list = postsByVisitor.get(v.visitorId) ?? [];
      list.push({ influencer, productSlug, postDate });
      postsByVisitor.set(v.visitorId, list);
    });
  });
  byPost.forEach(({ influencer, productSlug, postDate, visitors }) => {
    visitors.forEach((v) => {
      const allPostsForVisitor = postsByVisitor.get(v.visitorId) ?? [];
      v.ambiguousWith = allPostsForVisitor.filter(
        (p) => !(p.influencer === influencer && p.productSlug === productSlug && p.postDate === postDate)
      );
    });
  });

  return byPost;
}

export async function getPostVisitorSummaries(
  campaigns?: { influencer: string; productSlug: string; postDate: string }[]
): Promise<PostVisitorSummary[]> {
  const byPost = await getCapturedVisitorsByPost(campaigns);
  const summaries: PostVisitorSummary[] = [];
  byPost.forEach(({ influencer, productSlug, postDate, visitors }) => {
    const newVisitors = visitors.filter((v) => v.wasNewVisitor).length;
    const returningVisitors = visitors.length - newVisitors;
    const returnedLater = visitors.filter((v) => v.laterSessionCount > 0).length;
    const purchasedVisitors = visitors.filter((v) => v.purchased);
    const revenue = purchasedVisitors.reduce((s, v) => s + (v.revenue ?? 0), 0);
    const daysList = purchasedVisitors.map((v) => v.daysToPurchase!).filter((d) => d !== null);
    summaries.push({
      influencer,
      productSlug,
      postDate,
      visitorsInWindow: visitors.length,
      newVisitors,
      returningVisitors,
      visitorsWhoReturnedLater: returnedLater,
      visitorsWhoPurchased: purchasedVisitors.length,
      revenueFromWindow: revenue,
      avgDaysToPurchase: daysList.length ? Math.round((daysList.reduce((s, d) => s + d, 0) / daysList.length) * 10) / 10 : null,
    });
  });
  return summaries.sort((a, b) => (a.postDate < b.postDate ? 1 : -1));
}

export async function getAllVisitorJourneys(): Promise<
  { influencer: string; productSlug: string; postDate: string; visitors: VisitorJourneyEntry[] }[]
> {
  const byPost = await getCapturedVisitorsByPost();
  return [...byPost.values()].sort((a, b) => (a.postDate < b.postDate ? 1 : -1));
}

// The honest headline numbers: how many window-captures happened (can
// double-count a visitor seen by 2+ posts) vs. how many distinct real
// people that actually is, and how many of those are genuinely ambiguous
// (timing alone can't say which post gets credit). Computed from the exact
// same captured-visitor data as everything else on this page -- never a
// separate estimate.
export async function getOverallVisitorStats(): Promise<OverallVisitorStats> {
  const byPost = await getCapturedVisitorsByPost();
  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  let totalWindowCaptures = 0;
  byPost.forEach(({ visitors }) => {
    visitors.forEach((v) => {
      totalWindowCaptures++;
      seen.add(v.visitorId);
      if (v.ambiguousWith.length > 0) ambiguous.add(v.visitorId);
    });
  });
  return { totalWindowCaptures, distinctVisitors: seen.size, ambiguousVisitors: ambiguous.size };
}
