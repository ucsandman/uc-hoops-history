const { Pool } = require("pg");

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL in env");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    // Wipe drafts-related tables only (keep users)
    await client.query("TRUNCATE TABLE matches, ratings, drafts;");
    await client.query("COMMIT");
    console.log("✅ Wiped drafts/ratings/matches (users preserved).\n");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to wipe:", e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
