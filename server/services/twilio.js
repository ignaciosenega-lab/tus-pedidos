const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

let client = null;

function getClient() {
  if (!client && accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

/**
 * Send a WhatsApp message using a pre-approved template.
 * @param {string} from - Sender phone (e.g. "+5491112345678")
 * @param {string} to   - Recipient phone (e.g. "+5491198765432")
 * @param {string} templateSid - Twilio Content Template SID
 * @param {object} variables - Template variables (e.g. { "1": "Juan", "2": "20%" })
 * @returns {{ ok: boolean, sid?: string, error?: string }}
 */
async function sendTemplate(from, to, templateSid, variables) {
  const c = getClient();
  if (!c) return { ok: false, error: "Twilio no configurado" };

  try {
    const msg = await c.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${to}`,
      contentSid: templateSid,
      contentVariables: JSON.stringify(variables || {}),
    });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code };
  }
}

/**
 * Send a free-form WhatsApp message (only works within 24h session window or sandbox).
 * @param {string} from - Sender phone
 * @param {string} to   - Recipient phone
 * @param {string} body - Message text
 * @returns {{ ok: boolean, sid?: string, error?: string }}
 */
async function sendMessage(from, to, body) {
  const c = getClient();
  if (!c) return { ok: false, error: "Twilio no configurado" };

  try {
    const msg = await c.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${to}`,
      body,
    });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code };
  }
}

function isConfigured() {
  return !!(accountSid && authToken);
}

module.exports = { sendTemplate, sendMessage, isConfigured };
