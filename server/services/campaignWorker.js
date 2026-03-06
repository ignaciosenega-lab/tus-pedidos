const twilioService = require("./twilio");

// In-memory state per campaign
const workerState = {
  lastSendTime: {},
  messagesSincePause: {},
  consecutiveFailures: {},
  pauseUntil: {},
};

// Random int between min and max (inclusive)
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Greeting variations for anti-pattern detection
const GREETINGS = ["Hola", "Buenos días", "¡Hola!", "Buenas", "Hey", "Hola!"];
const INTROS = [
  "te escribimos de",
  "somos de",
  "te contactamos desde",
  "te hablamos de",
  "nos comunicamos de",
];

function randomGreeting() {
  return GREETINGS[randInt(0, GREETINGS.length - 1)];
}

function randomIntro() {
  return INTROS[randInt(0, INTROS.length - 1)];
}

/**
 * Replace {{variable}} placeholders in message body.
 */
function personalizeMessage(template, contact, greetingVariants) {
  let msg = template;

  // Pick a random greeting variant if provided
  let variants = [];
  try {
    variants = typeof greetingVariants === "string" ? JSON.parse(greetingVariants) : greetingVariants || [];
  } catch { variants = []; }

  if (variants.length > 0) {
    const greeting = variants[randInt(0, variants.length - 1)];
    msg = greeting + " " + msg;
  } else {
    // Default: prepend a random greeting
    msg = randomGreeting() + " " + msg;
  }

  // Standard replacements
  msg = msg.replace(/\{\{nombre\}\}/gi, contact.name || "");
  msg = msg.replace(/\{\{telefono\}\}/gi, contact.phone || "");
  msg = msg.replace(/\{\{saludo\}\}/gi, randomGreeting());
  msg = msg.replace(/\{\{intro\}\}/gi, randomIntro());

  // Custom vars from contact
  let customVars = {};
  try {
    customVars = typeof contact.custom_vars === "string" ? JSON.parse(contact.custom_vars) : contact.custom_vars || {};
  } catch { customVars = {}; }

  for (const [key, val] of Object.entries(customVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    msg = msg.replace(regex, String(val));
  }

  return msg.trim();
}

/**
 * Check if current time is within allowed sending hours (9:00 - 20:00 Argentina).
 */
function isWithinSendingHours() {
  const now = new Date();
  // Argentina timezone offset: UTC-3
  const argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const hour = argTime.getHours();
  return hour >= 9 && hour < 20;
}

/**
 * Get today's date string in Argentina timezone (YYYY-MM-DD).
 */
function getTodayArg() {
  const now = new Date();
  const argTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const y = argTime.getFullYear();
  const m = String(argTime.getMonth() + 1).padStart(2, "0");
  const d = String(argTime.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Reset daily counters for numbers whose last_reset_date != today.
 */
function resetDailyCounts(db) {
  const today = getTodayArg();
  db.prepare(
    "UPDATE campaign_numbers SET sent_today = 0, last_reset_date = ? WHERE last_reset_date != ? AND status != 'blocked'"
  ).run(today, today);
}

/**
 * Main tick function — called every 5 seconds by setInterval.
 */
async function processCampaignQueue(db) {
  if (!twilioService.isConfigured()) return;

  // Reset daily counts
  resetDailyCounts(db);

  // Find running campaigns
  const campaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'running'").all();
  if (campaigns.length === 0) return;

  const now = Date.now();

  for (const campaign of campaigns) {
    const cid = campaign.id;

    // Check sending hours
    if (!isWithinSendingHours()) continue;

    // Check pause
    if (workerState.pauseUntil[cid] && now < workerState.pauseUntil[cid]) continue;

    // Check delay between messages (8-25 seconds)
    if (workerState.lastSendTime[cid]) {
      const minDelay = randInt(8, 25) * 1000;
      if (now - workerState.lastSendTime[cid] < minDelay) continue;
    }

    // Check pause after 15 messages (2-5 minute break)
    if ((workerState.messagesSincePause[cid] || 0) >= 15) {
      const pauseMs = randInt(2, 5) * 60 * 1000;
      workerState.pauseUntil[cid] = now + pauseMs;
      workerState.messagesSincePause[cid] = 0;
      console.log(`[Campaign ${cid}] Pausa de ${Math.round(pauseMs / 1000 / 60)}min después de 15 mensajes`);
      continue;
    }

    // Find next unsent contact
    const nextContact = db.prepare(`
      SELECT cc.* FROM campaign_contact_lists ccl
      JOIN campaign_contacts cc ON cc.id = ccl.contact_id
      WHERE ccl.campaign_id = ?
        AND cc.opted_out = 0
        AND cc.id NOT IN (SELECT contact_id FROM campaign_messages WHERE campaign_id = ?)
      ORDER BY cc.id ASC
      LIMIT 1
    `).get(cid, cid);

    if (!nextContact) {
      // No more contacts — campaign complete
      db.prepare("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(cid);
      console.log(`[Campaign ${cid}] Completada`);
      // Clean up state
      delete workerState.lastSendTime[cid];
      delete workerState.messagesSincePause[cid];
      delete workerState.consecutiveFailures[cid];
      delete workerState.pauseUntil[cid];
      continue;
    }

    // Find available sender number
    const senderNumber = db.prepare(
      "SELECT * FROM campaign_numbers WHERE status = 'active' AND sent_today < daily_limit ORDER BY sent_today ASC LIMIT 1"
    ).get();

    if (!senderNumber) {
      console.log(`[Campaign ${cid}] No hay números disponibles, esperando...`);
      continue;
    }

    // Send message
    let result;
    if (campaign.template_sid) {
      // Template-based send
      let vars = {};
      try {
        const customVars = typeof nextContact.custom_vars === "string" ? JSON.parse(nextContact.custom_vars) : nextContact.custom_vars || {};
        vars = { "1": nextContact.name || "", ...customVars };
      } catch { vars = { "1": nextContact.name || "" }; }
      result = await twilioService.sendTemplate(senderNumber.phone, nextContact.phone, campaign.template_sid, vars);
    } else {
      // Free-form message
      const body = personalizeMessage(campaign.message_body, nextContact, campaign.greeting_variants);
      result = await twilioService.sendMessage(senderNumber.phone, nextContact.phone, body);
    }

    // Record message
    const msgStatus = result.ok ? "sent" : "failed";
    db.prepare(`
      INSERT INTO campaign_messages (campaign_id, contact_id, number_id, twilio_sid, status, error_code, error_message, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(cid, nextContact.id, senderNumber.id, result.sid || null, msgStatus, result.code || null, result.error || null);

    // Update campaign counters
    if (result.ok) {
      db.prepare("UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?").run(cid);
      db.prepare("UPDATE campaign_numbers SET sent_today = sent_today + 1 WHERE id = ?").run(senderNumber.id);
      workerState.consecutiveFailures[cid] = 0;
    } else {
      db.prepare("UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?").run(cid);
      workerState.consecutiveFailures[cid] = (workerState.consecutiveFailures[cid] || 0) + 1;

      // Auto-pause after 3 consecutive failures
      if (workerState.consecutiveFailures[cid] >= 3) {
        db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(cid);
        console.log(`[Campaign ${cid}] Auto-pausada por ${workerState.consecutiveFailures[cid]} fallos consecutivos`);
        delete workerState.consecutiveFailures[cid];
        continue;
      }
    }

    workerState.lastSendTime[cid] = Date.now();
    workerState.messagesSincePause[cid] = (workerState.messagesSincePause[cid] || 0) + 1;
  }
}

module.exports = { processCampaignQueue };
