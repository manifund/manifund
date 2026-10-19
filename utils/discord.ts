export async function sendDiscordAlert(message: string) {
  const webhookUrl = process.env.DISCORD_ALERTS_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('DISCORD_ALERTS_WEBHOOK_URL not set; skipping alert:', message)
    return
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Never ping: alerts can quote user text such as project titles
      body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }),
    })
  } catch (e) {
    console.error('Failed to send Discord alert', e)
  }
}
