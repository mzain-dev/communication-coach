// Creates the database (if missing), applies schema.sql, and seeds default
// scenarios + a first admin account so there's a way to log in.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Defaults to local dev config; pass a different file to target another environment, e.g.
// `node scripts/init-db.mjs .env.production` (see the `db:init:prod` npm script).
const envFile = process.argv[2] || ".env.local";
dotenv.config({ path: envFile });
console.log(`Using config from ${envFile}`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "voice_eng",
  SEED_ADMIN_EMAIL = "admin@local.test",
  SEED_ADMIN_PASSWORD = "ChangeMe123!",
} = process.env;

const DEFAULT_SCENARIOS = [
  {
    name: "Casual conversation",
    type: "casual",
    difficulty: "beginner",
    is_client_track: false,
    system_prompt:
      "You are a friendly conversation partner helping the user practice everyday spoken English. Keep a natural, casual tone, ask follow-up questions, and gently model correct phrasing when the user makes a mistake without interrupting the flow of conversation.",
  },
  {
    name: "Client call: Handling objections",
    type: "client",
    difficulty: "advanced",
    is_client_track: true,
    system_prompt:
      "You are a client on a call with the user, who is a vendor or service provider. Raise a specific, realistic objection about price, timeline, or scope, and push back reasonably if their response is weak. Expect clear, professional, structured spoken responses that address your concern directly. Stay in character as the client throughout.",
  },
  {
    name: "Client call: Delivering bad news",
    type: "client",
    difficulty: "advanced",
    is_client_track: true,
    system_prompt:
      "You are a client expecting an update on a project. The user (a vendor or service provider) needs to deliver bad news to you — a delay, a budget overrun, or a missed deliverable. React realistically (concerned, frustrated, or disappointed) and press for specifics: what happened, what's the plan, and what's the new timeline. Reward calm, honest, well-structured communication. Stay in character as the client throughout.",
  },
  {
    name: "Client call: Negotiating",
    type: "client",
    difficulty: "advanced",
    is_client_track: true,
    system_prompt:
      "You are a client negotiating contract terms, pricing, or scope with the user, who represents a vendor. Hold a firm but reasonable initial position, and expect the user to make a persuasive case, propose trade-offs, or find common ground. Stay in character as the client throughout.",
  },
  {
    name: "Client call: Status update",
    type: "client",
    difficulty: "intermediate",
    is_client_track: true,
    system_prompt:
      "You are a client checking in on a project's progress. Ask the user (a vendor or service provider) for a clear status update: what's done, what's in progress, what's blocked, and next steps. Ask reasonable follow-up questions if their update is vague. Stay in character as the client throughout.",
  },
  {
    name: "Difficult conversation",
    type: "difficult",
    difficulty: "advanced",
    is_client_track: false,
    system_prompt:
      "You are playing a counterpart in a tense but realistic conversation (e.g. delivering bad news, disagreeing with a colleague, or negotiating). Push back reasonably on weak arguments and require the user to stay calm, clear, and diplomatic.",
  },
  {
    name: "Interview practice",
    type: "interview",
    difficulty: "intermediate",
    is_client_track: false,
    system_prompt:
      "You are a hiring manager interviewing the user for a professional role. Ask common behavioral and role-specific interview questions one at a time, and follow up naturally based on their answers.",
  },
  {
    name: "Custom scenario",
    type: "custom",
    difficulty: "intermediate",
    is_client_track: false,
    system_prompt:
      "You are a flexible roleplay partner. Adapt to whatever scenario or role the user describes at the start of the conversation and stay in character.",
  },
  {
    // Module 9 (YouTube Context Learning): a placeholder FK target for speaking_sessions —
    // the real system prompt is built per-session from that video's pasted transcript.
    name: "YouTube Video Discussion",
    type: "youtube",
    difficulty: "intermediate",
    is_client_track: false,
    system_prompt:
      "You are discussing a YouTube video with an English learner. (Placeholder — the real system prompt is built per-session from that video's transcript.)",
  },
];

async function main() {
  // Local dev (root) can create the database itself. Managed hosts like Hostinger scope the
  // MySQL user to one already-created database with no CREATE DATABASE privilege — in that case
  // this fails and we just proceed assuming the database (created via hPanel) already exists.
  try {
    const admin = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
    });
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await admin.end();
  } catch (err) {
    console.log(`Skipping CREATE DATABASE (${err.code ?? err.message}) — assuming "${DB_NAME}" already exists.`);
  }

  const db = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  const schema = readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await db.query(schema);
  console.log(`Schema applied to database "${DB_NAME}".`);

  // CREATE TABLE IF NOT EXISTS above doesn't add new columns to a table that already exists
  // from a previous deploy — this brings an existing `summaries` table (local or production) up
  // to date without a full migration tool. Safe to re-run: a duplicate-column error (1060) means
  // it's already applied.
  try {
    await db.query("ALTER TABLE summaries ADD COLUMN details JSON NULL");
    console.log('Added "details" column to summaries.');
  } catch (err) {
    if (err.errno === 1060) {
      console.log('"details" column already present on summaries, skipping.');
    } else {
      throw err;
    }
  }

  const [existingScenarios] = await db.query("SELECT COUNT(*) as count FROM scenarios");
  if (existingScenarios[0].count === 0) {
    for (const s of DEFAULT_SCENARIOS) {
      await db.query(
        "INSERT INTO scenarios (name, type, system_prompt, difficulty, is_client_track) VALUES (?, ?, ?, ?, ?)",
        [s.name, s.type, s.system_prompt, s.difficulty, s.is_client_track]
      );
    }
    console.log(`Seeded ${DEFAULT_SCENARIOS.length} default scenarios.`);
  } else {
    console.log("Scenarios already present, skipping seed.");
  }

  const [existingAdmins] = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  if (existingAdmins[0].count === 0) {
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
    await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      ["Admin", SEED_ADMIN_EMAIL, passwordHash]
    );
    console.log(`Seeded admin account: ${SEED_ADMIN_EMAIL} / ${SEED_ADMIN_PASSWORD}`);
  } else {
    console.log("An admin account already exists, skipping seed.");
  }

  await db.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
