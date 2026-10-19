export async function sendDiscordAlert(message: string) {
  await sendDiscordMessage(process.env.DISCORD_ALERTS_WEBHOOK_URL, message)
}

export async function sendDiscordMessage(webhookUrl: string | undefined, message: string) {
  if (!webhookUrl) {
    console.error('Discord webhook URL not set; skipping message:', message)
    return
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Never ping: messages can quote user text such as project titles
      body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }),
    })
  } catch (e) {
    console.error('Failed to send Discord message', e)
  }
}
