-- Real, live-editable influencer gifting tracker, fed by two tabs in a
-- single Google Sheets workbook the user maintains herself (see
-- app/api/gifting/import-gifts and app/api/gifting/import-posts). Each
-- import fully replaces the table's contents with the sheet's current
-- state -- the closest honest approximation of "real time" without a paid
-- Google Sheets push/webhook subscription (see lib/gifting-server.ts).
--
-- product_name is stored as free text exactly as typed in the sheet.
-- Matching it to a real product_slug (so real visitor-lift data can be
-- attached) happens at read time in lib/gifting-server.ts against the
-- existing product_full_stack view -- never guessed, never silently
-- defaulted when no match is found.
CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.gifting_log` (
  gift_id STRING,
  influencer STRING,
  product_name STRING,
  cost FLOAT64,
  date_gifted DATE,
  notes STRING,
  synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `project-cb954e13-3b16-432f-aa7.analytics_lab.posting_log` (
  post_id STRING,
  influencer STRING,
  date_posted DATE,
  time_posted STRING,
  post_type STRING,
  platform STRING,
  synced_at TIMESTAMP
);
