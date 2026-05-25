import { withSecurity } from './_security.js';
// Slack/Discord notification webhook
async function handler(req, res) {
  const { platform, webhookUrl, repo, score, summary, findings } = req.body || {};
  if (!webhookUrl || !platform) return res.status(400).json({ error: 'platform and webhookUrl required' });

  const color = score >= 80 ? '#574a7d' : score >= 50 ? '#EAB308' : '#EF4444';

  try {
    if (platform === 'slack') {
      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `🧪 TestForge Analysis: ${repo || 'Repository'}` } },
        { type: 'section', text: { type: 'mrkdwn', text: `*Score: ${score || 'N/A'}/100*\n${summary || ''}` } },
      ];
      if (findings?.length) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Top Findings:*\n${findings.slice(0,5).map((f,i) => `${i+1}. [${f.severity?.toUpperCase()}] ${f.title}`).join('\n')}` } });
      }
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `🔗 <https://testforge.run|View full report on TestForge>` }] });
      await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks, attachments: [{ color, text: `TestForge Score: ${score}/100` }] }) });
    } else if (platform === 'discord') {
      await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        embeds: [{
          title: `🧪 TestForge: ${repo || 'Repository'} — ${score || 'N/A'}/100`,
          description: summary || '',
          color: parseInt(color.replace('#', ''), 16),
          fields: findings?.slice(0,5).map(f => ({ name: `[${f.severity?.toUpperCase()}] ${f.title}`, value: f.filePath || '' })) || [],
          url: 'https://testforge.run',
        }]
      }) });
    }

    return res.json({ sent: true, platform });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default withSecurity(handler);
