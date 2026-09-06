import 'dotenv/config';
import express from 'express';
import { runTfcManager } from './agents.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const sharedSecret = process.env.TFC_AI_SHARED_SECRET || '';

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function requireAuth(req, res, next) {
  if (!sharedSecret) {
    return res.status(503).json({ ok: false, error: 'TFC_AI_SHARED_SECRET is not configured' });
  }

  const supplied = req.get('x-tfc-ai-secret') || '';
  if (supplied !== sharedSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'Toronto Finance Company AI', version: '0.1.0' });
});

app.post('/v1/deals/review', requireAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.applicationId) {
      return res.status(400).json({ ok: false, error: 'applicationId is required' });
    }

    const result = await runTfcManager(payload);
    res.json({
      ok: true,
      applicationId: String(payload.applicationId),
      reviewedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('TFC AI review failed', error);
    res.status(500).json({ ok: false, error: 'AI review failed' });
  }
});

app.listen(port, () => {
  console.log(`TFC AI service listening on port ${port}`);
});
