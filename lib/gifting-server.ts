// Server-only: closes the loop the whole platform is built around --
// "was she gifted, did she actually post, and what did that post do to
// real sales" -- using two real, hand-maintained Google Sheets tabs (see
// app/api/gifting/import-gifts and import-posts) instead of the synthetic
// influencer_product_performance demo table.
//
// Real limits, stated plainly rather than hidden:
//  1. Matching a gift to a post is done by (same influencer, post date on
//     or after gift date, within a configurable window) -- there's no
//     stronger real signal available (no post-ID back-reference in a plain
//     spreadsheet), so if an influencer posts about unrelated things after
//     being gifted, this can mismatch. When more than one of her posts
//     falls in the window, ALL candidates are surfaced, not just the first.
//  2. Product name -> product_slug matching is exact-case-insensitive
//     against the real product_full_stack view. If it doesn't match
//     (typo, product not in the catalog), visitor-lift and revenue are
//     explicitly left null with a reason -- never estimated.
import fs from "fs";
import path from "path";
import { bigquery } from "@/lib/bigquery";
import { getPostVisitorSummaries, ATTRIBUTION_WINDOW_HOURS } from "@/lib/visitor-journey-server";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

// Not secret, but stored the same way credentials are (local, gitignored
// file) so the "Refresh Now" button and the auto-poll on the gifting page
// can re-pull the sheet's current state without asking her to paste the URL
// in again every time. See app/api/gifting/refresh/route.ts.
const CREDENTIALS_DIR = path.join(process.cwd(), ".credentials");
const SHEET_URLS_PATH = path.join(CREDENTIALS_DIR, "gifting-sheets.json");

export interface GiftingSheetUrls {
  giftsSheetUrl?: string;
  postsSheetUrl?: string;
}

export function readGiftingSheetUrls(): GiftingSheetUrls {
  try {
    return JSON.parse(fs.readFileSync(SHEET_URLS_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function writeGiftingSheetUrls(update: GiftingSheetUrls) {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  const merged = { ...readGiftingSheetUrls(), ...update };
  fs.writeFileSync(SHEET_URLS_PATH, JSON.stringify(merged), { mode: 0o600 });
}

// How many days after being gifted a post still reasonably counts as
// "about this gift" -- generous on purpose (influencers don't always post
// same-day), but bounded so a post from 8 months later doesn't get credited.
const POST_MATCH_WINDOW_DAYS = 90;

export interface GiftRecord {
  giftId: string;
  influencer: string;
  productName: string;
  cost: number;
  dateGifted: string;
  notes: string | null;
}

export interface PostRecord {
  postId: string;
  influencer: string;
  datePosted: string;
  timePosted: string | null;
  postType: string | null;
  platform: string | null;
}

export interface GiftRoiRow {
  gift: GiftRecord;
  posted: boolean;
  matchedPosts: PostRecord[]; // every real post by this influencer inside the match window -- can be 0, 1, or several
  productSlug: string | null; // resolved from product_full_stack, or null if no real match found
  visitorsInWindow: number | null;
  visitorsWhoPurchased: number | null;
  attributedRevenue: number | null;
  roiPct: number | null; // (attributedRevenue - cost) / cost * 100, only when both a matched post and a resolved product exist
  note: string | null; // explains why any of the above are null, when they are
}

export async function getGiftingLog(): Promise<GiftRecord[]> {
  const [rows] = await bigquery.query(`
    SELECT gift_id, influencer, product_name, cost, date_gifted, notes
    FROM \`${PROJECT}.gifting_log\`
    ORDER BY date_gifted DESC
  `);
  return rows.map((r: any) => ({
    giftId: r.gift_id,
    influencer: r.influencer,
    productName: r.product_name,
    cost: r.cost ?? 0,
    dateGifted: typeof r.date_gifted === "string" ? r.date_gifted : r.date_gifted.value,
    notes: r.notes ?? null,
  }));
}

export async function getPostingLog(): Promise<PostRecord[]> {
  const [rows] = await bigquery.query(`
    SELECT post_id, influencer, date_posted, time_posted, post_type, platform
    FROM \`${PROJECT}.posting_log\`
    ORDER BY date_posted DESC
  `);
  return rows.map((r: any) => ({
    postId: r.post_id,
    influencer: r.influencer,
    datePosted: typeof r.date_posted === "string" ? r.date_posted : r.date_posted.value,
    timePosted: r.time_posted ?? null,
    postType: r.post_type ?? null,
    platform: r.platform ?? null,
  }));
}

async function getProductNameToSlugMap(): Promise<Map<string, string>> {
  const [rows] = await bigquery.query(`
    SELECT DISTINCT product_slug, product_name
    FROM \`${PROJECT}.product_full_stack\`
  `);
  const map = new Map<string, string>();
  rows.forEach((r: any) => map.set(String(r.product_name).trim().toLowerCase(), r.product_slug));
  return map;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export async function getGiftingRoi(): Promise<{ rows: GiftRoiRow[]; windowDays: number }> {
  const [gifts, posts, productMap] = await Promise.all([getGiftingLog(), getPostingLog(), getProductNameToSlugMap()]);

  const postsByInfluencer = new Map<string, PostRecord[]>();
  posts.forEach((p) => {
    const list = postsByInfluencer.get(p.influencer) ?? [];
    list.push(p);
    postsByInfluencer.set(p.influencer, list);
  });

  // Build the pre-match rows first, collecting real campaigns to batch into
  // one visitor-attribution query instead of one per gift.
  const preRows: (Omit<GiftRoiRow, "visitorsInWindow" | "visitorsWhoPurchased" | "attributedRevenue" | "roiPct"> & {
    campaignKey: string | null;
  })[] = [];
  const campaigns: { influencer: string; productSlug: string; postDate: string }[] = [];

  for (const gift of gifts) {
    const candidatePosts = (postsByInfluencer.get(gift.influencer) ?? []).filter((p) => {
      const diff = daysBetween(gift.dateGifted, p.datePosted);
      return diff >= 0 && diff <= POST_MATCH_WINDOW_DAYS;
    });
    const posted = candidatePosts.length > 0;
    const productSlug = productMap.get(gift.productName.trim().toLowerCase()) ?? null;

    let note: string | null = null;
    let campaignKey: string | null = null;
    if (!posted) {
      note = `No post by ${gift.influencer} found within ${POST_MATCH_WINDOW_DAYS} days of the gift date.`;
    } else if (!productSlug) {
      note = `"${gift.productName}" doesn't match a real product in the catalog — check spelling, or the exact product name.`;
    } else {
      // Use the earliest matching post as the one the visitor window is measured from.
      const earliest = [...candidatePosts].sort((a, b) => (a.datePosted < b.datePosted ? -1 : 1))[0];
      campaignKey = `${gift.influencer}|||${productSlug}|||${earliest.datePosted}`;
      campaigns.push({ influencer: gift.influencer, productSlug, postDate: earliest.datePosted });
      if (candidatePosts.length > 1) {
        note = `${candidatePosts.length} posts by ${gift.influencer} fall in the match window — visitor lift is measured from the earliest one.`;
      }
    }

    preRows.push({
      gift,
      posted,
      matchedPosts: candidatePosts,
      productSlug,
      note,
      campaignKey,
    });
  }

  const summaries = campaigns.length > 0 ? await getPostVisitorSummaries(campaigns) : [];
  const summaryByKey = new Map(summaries.map((s) => [`${s.influencer}|||${s.productSlug}|||${s.postDate}`, s]));

  const rows: GiftRoiRow[] = preRows.map((pre) => {
    const summary = pre.campaignKey ? summaryByKey.get(pre.campaignKey) ?? null : null;
    const visitorsInWindow = summary ? summary.visitorsInWindow : null;
    const visitorsWhoPurchased = summary ? summary.visitorsWhoPurchased : null;
    const attributedRevenue = summary ? summary.revenueFromWindow : null;
    const roiPct =
      attributedRevenue !== null && pre.gift.cost > 0
        ? Math.round(((attributedRevenue - pre.gift.cost) / pre.gift.cost) * 1000) / 10
        : null;

    return {
      gift: pre.gift,
      posted: pre.posted,
      matchedPosts: pre.matchedPosts,
      productSlug: pre.productSlug,
      visitorsInWindow,
      visitorsWhoPurchased,
      attributedRevenue,
      roiPct,
      note: pre.note,
    };
  });

  return { rows, windowDays: POST_MATCH_WINDOW_DAYS };
}

export { ATTRIBUTION_WINDOW_HOURS };
