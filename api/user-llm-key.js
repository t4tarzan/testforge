// /api/user-llm-key — manage the signed-in user's BYOK LLM key for MANAGED
// Tier-2 (hosted Generate & Run uses the user's own OpenRouter key + billing).
//   GET    → { set, mask, baseUrl, model, updatedAt }   (never the plaintext)
//   POST   { key, baseUrl?, model? } → { ok, mask }      (validates + encrypts)
//   DELETE → { ok }
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';
import { getUserLlmKeyMeta, setUserLlmKey, deleteUserLlmKey } from './_llm-key.js';

async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return; // 401 already sent
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  const userId = session.userId;

  try {
    if (req.method === 'GET') {
      return res.json(await getUserLlmKeyMeta(userId));
    }

    if (req.method === 'POST') {
      const { key, baseUrl, model } = req.body || {};
      const k = (key || '').trim();
      if (!k) return res.status(400).json({ error: 'key required' });
      if (k.length < 16) return res.status(400).json({ error: 'That key looks too short — paste your full OpenRouter key (sk-or-…).' });
      // Light sanity: OpenRouter keys start with sk-or-. Allow others for
      // OpenAI-compatible endpoints, but block obvious junk.
      if (/\s/.test(k)) return res.status(400).json({ error: 'Key must not contain whitespace.' });
      const mask = await setUserLlmKey(userId, k, (baseUrl || '').trim(), (model || '').trim());
      return res.json({ ok: true, mask });
    }

    if (req.method === 'DELETE') {
      await deleteUserLlmKey(userId);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to save key' });
  }
}

export default withSecurity(handler);
