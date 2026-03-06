const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");

function safeParseJson(str, fallback) {
  try { return typeof str === "string" ? JSON.parse(str) : str || fallback; }
  catch { return fallback; }
}

/* ══════════════════════════════════════════════════
   CAMPAIGNS
   ══════════════════════════════════════════════════ */

// GET /api/campaigns
router.get("/", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  let campaigns;
  if (req.user.role === "master") {
    campaigns = db.prepare("SELECT * FROM campaigns ORDER BY id DESC").all();
  } else {
    const branchId = req.user.branch_id;
    campaigns = db.prepare("SELECT * FROM campaigns WHERE branch_id = ? ORDER BY id DESC").all(branchId);
  }
  res.json(campaigns.map((c) => ({
    ...c,
    greeting_variants: safeParseJson(c.greeting_variants, []),
  })));
});

// POST /api/campaigns
router.post("/", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { branch_id, name, template_sid, message_body, greeting_variants, scheduled_at, contact_scope, contact_branch_id } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre es requerido" });

  const result = db.prepare(`
    INSERT INTO campaigns (branch_id, name, template_sid, message_body, greeting_variants, scheduled_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    branch_id || req.user.branch_id || null,
    name,
    template_sid || "",
    message_body || "",
    JSON.stringify(greeting_variants || []),
    scheduled_at || null,
    req.user.id
  );

  const created = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json({ ...created, greeting_variants: safeParseJson(created.greeting_variants, []) });
});

// PUT /api/campaigns/:id
router.put("/:id", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Campaña no encontrada" });
  if (!["draft", "paused"].includes(existing.status)) {
    return res.status(400).json({ error: "Solo se pueden editar campañas en borrador o pausadas" });
  }

  const { name, template_sid, message_body, greeting_variants, scheduled_at, branch_id } = req.body;
  db.prepare(`
    UPDATE campaigns SET name=?, template_sid=?, message_body=?, greeting_variants=?, scheduled_at=?, branch_id=?
    WHERE id=?
  `).run(
    name !== undefined ? name : existing.name,
    template_sid !== undefined ? template_sid : existing.template_sid,
    message_body !== undefined ? message_body : existing.message_body,
    greeting_variants !== undefined ? JSON.stringify(greeting_variants) : existing.greeting_variants,
    scheduled_at !== undefined ? scheduled_at : existing.scheduled_at,
    branch_id !== undefined ? branch_id : existing.branch_id,
    id
  );

  const updated = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  res.json({ ...updated, greeting_variants: safeParseJson(updated.greeting_variants, []) });
});

// DELETE /api/campaigns/:id
router.delete("/:id", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Campaña no encontrada" });
  if (existing.status !== "draft") {
    return res.status(400).json({ error: "Solo se pueden eliminar campañas en borrador" });
  }

  db.prepare("DELETE FROM campaign_contact_lists WHERE campaign_id = ?").run(id);
  db.prepare("DELETE FROM campaign_messages WHERE campaign_id = ?").run(id);
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  res.json({ ok: true });
});

// POST /api/campaigns/:id/start
router.post("/:id/start", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return res.status(404).json({ error: "Campaña no encontrada" });
  if (!["draft", "paused", "scheduled"].includes(campaign.status)) {
    return res.status(400).json({ error: "No se puede iniciar esta campaña" });
  }

  const { contact_scope, contact_branch_id } = req.body;

  // If starting from draft, load contacts into junction table
  if (campaign.status === "draft" || campaign.status === "scheduled") {
    db.prepare("DELETE FROM campaign_contact_lists WHERE campaign_id = ?").run(id);

    let contacts;
    if (contact_scope === "branch" && contact_branch_id) {
      contacts = db.prepare("SELECT id FROM campaign_contacts WHERE opted_out = 0 AND branch_id = ?").all(contact_branch_id);
    } else {
      contacts = db.prepare("SELECT id FROM campaign_contacts WHERE opted_out = 0").all();
    }

    if (contacts.length === 0) {
      return res.status(400).json({ error: "No hay contactos disponibles para esta campaña" });
    }

    const ins = db.prepare("INSERT INTO campaign_contact_lists (campaign_id, contact_id) VALUES (?, ?)");
    for (const c of contacts) ins.run(id, c.id);

    db.prepare("UPDATE campaigns SET total_contacts = ?, started_at = datetime('now'), status = 'running' WHERE id = ?")
      .run(contacts.length, id);
  } else {
    // Resuming from paused
    db.prepare("UPDATE campaigns SET status = 'running' WHERE id = ?").run(id);
  }

  const updated = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  res.json({ ...updated, greeting_variants: safeParseJson(updated.greeting_variants, []) });
});

// POST /api/campaigns/:id/pause
router.post("/:id/pause", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return res.status(404).json({ error: "Campaña no encontrada" });
  if (campaign.status !== "running") {
    return res.status(400).json({ error: "Solo se pueden pausar campañas en ejecución" });
  }

  db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(id);
  const updated = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  res.json({ ...updated, greeting_variants: safeParseJson(updated.greeting_variants, []) });
});

// GET /api/campaigns/:id/stats
router.get("/:id/stats", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return res.status(404).json({ error: "Campaña no encontrada" });

  res.json({
    status: campaign.status,
    total_contacts: campaign.total_contacts,
    sent_count: campaign.sent_count,
    delivered_count: campaign.delivered_count,
    read_count: campaign.read_count,
    failed_count: campaign.failed_count,
    replied_count: campaign.replied_count,
    started_at: campaign.started_at,
    completed_at: campaign.completed_at,
  });
});

// GET /api/campaigns/:id/messages
router.get("/:id/messages", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const statusFilter = req.query.status || "";

  let query = `
    SELECT cm.*, cc.name as contact_name, cc.phone as contact_phone, cn.friendly_name as number_name
    FROM campaign_messages cm
    JOIN campaign_contacts cc ON cc.id = cm.contact_id
    LEFT JOIN campaign_numbers cn ON cn.id = cm.number_id
    WHERE cm.campaign_id = ?
  `;
  const params = [id];

  if (statusFilter) {
    query += " AND cm.status = ?";
    params.push(statusFilter);
  }

  query += " ORDER BY cm.id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const messages = db.prepare(query).all(...params);
  const total = db.prepare(
    `SELECT COUNT(*) as count FROM campaign_messages WHERE campaign_id = ?${statusFilter ? " AND status = ?" : ""}`
  ).get(...(statusFilter ? [id, statusFilter] : [id]));

  res.json({ messages, total: total.count });
});

/* ══════════════════════════════════════════════════
   CONTACTS
   ══════════════════════════════════════════════════ */

// GET /api/campaigns/contacts
router.get("/contacts", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const search = req.query.search || "";
  const source = req.query.source || "";
  const optedOut = req.query.opted_out;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;

  let query = "SELECT * FROM campaign_contacts WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR phone LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (source) {
    query += " AND source = ?";
    params.push(source);
  }
  if (optedOut !== undefined && optedOut !== "") {
    query += " AND opted_out = ?";
    params.push(Number(optedOut));
  }

  const total = db.prepare(query.replace("SELECT *", "SELECT COUNT(*) as count")).get(...params);
  query += " ORDER BY id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const contacts = db.prepare(query).all(...params);
  res.json({ contacts, total: total.count });
});

// POST /api/campaigns/contacts
router.post("/contacts", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { phone, name, custom_vars, branch_id } = req.body;
  if (!phone) return res.status(400).json({ error: "Teléfono es requerido" });

  const cleanPhone = phone.replace(/\D/g, "");
  const existing = db.prepare("SELECT id FROM campaign_contacts WHERE phone = ?").get(cleanPhone);
  if (existing) return res.status(409).json({ error: "Este teléfono ya existe en contactos" });

  const result = db.prepare(
    "INSERT INTO campaign_contacts (phone, name, custom_vars, source, branch_id) VALUES (?, ?, ?, 'manual', ?)"
  ).run(cleanPhone, name || "", JSON.stringify(custom_vars || {}), branch_id || null);

  const created = db.prepare("SELECT * FROM campaign_contacts WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(created);
});

// POST /api/campaigns/contacts/import (CSV batch)
router.post("/contacts/import", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { contacts, branch_id } = req.body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: "Lista de contactos vacía" });
  }

  let imported = 0;
  let skipped = 0;
  const ins = db.prepare(
    "INSERT OR IGNORE INTO campaign_contacts (phone, name, custom_vars, source, branch_id) VALUES (?, ?, ?, 'import', ?)"
  );

  for (const c of contacts) {
    const cleanPhone = (c.phone || "").replace(/\D/g, "");
    if (!cleanPhone) { skipped++; continue; }
    const result = ins.run(cleanPhone, c.name || "", JSON.stringify(c.custom_vars || {}), branch_id || null);
    if (result.changes > 0) imported++;
    else skipped++;
  }

  res.json({ imported, skipped, total: contacts.length });
});

// POST /api/campaigns/contacts/sync (from app_users)
router.post("/contacts/sync", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { branch_id } = req.body;

  // Get customers with orders (they have phone numbers)
  let customers;
  if (branch_id) {
    customers = db.prepare(`
      SELECT DISTINCT customer_phone as phone, customer_name as name
      FROM orders WHERE branch_id = ? AND customer_phone != ''
    `).all(branch_id);
  } else {
    customers = db.prepare(`
      SELECT DISTINCT customer_phone as phone, customer_name as name
      FROM orders WHERE customer_phone != ''
    `).all();
  }

  let imported = 0;
  let skipped = 0;
  const ins = db.prepare(
    "INSERT OR IGNORE INTO campaign_contacts (phone, name, source, branch_id) VALUES (?, ?, 'customer', ?)"
  );

  for (const c of customers) {
    const cleanPhone = c.phone.replace(/\D/g, "");
    if (!cleanPhone) { skipped++; continue; }
    const result = ins.run(cleanPhone, c.name || "", branch_id || null);
    if (result.changes > 0) imported++;
    else skipped++;
  }

  res.json({ imported, skipped, total: customers.length });
});

// DELETE /api/campaigns/contacts/:id
router.delete("/contacts/:id", requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  db.prepare("DELETE FROM campaign_contact_lists WHERE contact_id = ?").run(id);
  const result = db.prepare("DELETE FROM campaign_contacts WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Contacto no encontrado" });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   NUMBERS (master only)
   ══════════════════════════════════════════════════ */

// GET /api/campaigns/numbers
router.get("/numbers", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const numbers = db.prepare("SELECT * FROM campaign_numbers ORDER BY id DESC").all();
  res.json(numbers);
});

// POST /api/campaigns/numbers
router.post("/numbers", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const { phone, friendly_name, twilio_sid, daily_limit } = req.body;
  if (!phone) return res.status(400).json({ error: "Teléfono es requerido" });

  const cleanPhone = phone.replace(/\D/g, "");
  const result = db.prepare(
    "INSERT INTO campaign_numbers (phone, friendly_name, twilio_sid, daily_limit) VALUES (?, ?, ?, ?)"
  ).run(cleanPhone, friendly_name || "", twilio_sid || "", daily_limit || 200);

  const created = db.prepare("SELECT * FROM campaign_numbers WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(created);
});

// PUT /api/campaigns/numbers/:id
router.put("/numbers/:id", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM campaign_numbers WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Número no encontrado" });

  const { phone, friendly_name, twilio_sid, daily_limit, status } = req.body;
  db.prepare(`
    UPDATE campaign_numbers SET phone=?, friendly_name=?, twilio_sid=?, daily_limit=?, status=? WHERE id=?
  `).run(
    phone !== undefined ? phone.replace(/\D/g, "") : existing.phone,
    friendly_name !== undefined ? friendly_name : existing.friendly_name,
    twilio_sid !== undefined ? twilio_sid : existing.twilio_sid,
    daily_limit !== undefined ? daily_limit : existing.daily_limit,
    status !== undefined ? status : existing.status,
    id
  );

  const updated = db.prepare("SELECT * FROM campaign_numbers WHERE id = ?").get(id);
  res.json(updated);
});

// DELETE /api/campaigns/numbers/:id
router.delete("/numbers/:id", requireAuth, requireRole("master"), (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM campaign_numbers WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Número no encontrado" });
  res.json({ ok: true });
});

module.exports = router;
