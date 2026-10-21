// Ianz Fitness · send-reminders
// Delivers the reminders each device scheduled in public.push_subs (Web Push / VAPID).
// Called every 5 minutes by pg_cron (supabase/push_cron.sql); with {"rest": true} every 5 seconds while a rest
// timer has run out (supabase/rest_alerts.sql), to send 休息结束提醒. Secrets (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are built in)
// Deploy with "Verify JWT" turned OFF — the x-cron-secret header protects it instead.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STALE_MS = 2 * 3600e3; // a reminder more than 2 h late is skipped instead of sent

/** 休息结束提醒 (supabase/rest_alerts.sql): deliver the rest timers that ran out, then remove them. */
// deno-lint-ignore no-explicit-any
async function sendRestAlerts(db: any, now: Date) {
  const { data: due, error } = await db.from('rest_alerts').select('endpoint, fire_at, title, body, push_subs(p256dh, auth, enabled)').lte('fire_at', now.toISOString());
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const a of due ?? []) {
    await db.from('rest_alerts').delete().eq('endpoint', a.endpoint).eq('fire_at', a.fire_at);
    const s = a.push_subs;
    if (!s || !s.enabled || now.getTime() - new Date(a.fire_at).getTime() > 5 * 60e3) continue; // too late to be useful
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: a.title, body: a.body, url: './?go=workout', tag: 'rest' }), { TTL: 120, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subs').delete().eq('endpoint', a.endpoint);
      else console.error('rest push failed', code, (e as Error).message);
    }
  }
  return Response.json({ rest: due?.length ?? 0, sent });
}

Deno.serve(async (req) => {
  if (!Deno.env.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  webpush.setVapidDetails('https://github.com/EthanZhengy/ianz-fitness', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const now = new Date();
  const body = await req.json().catch(() => ({}));
  if (body && body.rest) return sendRestAlerts(db, now);
  const { data: subs, error } = await db.from('push_subs').select('*').eq('enabled', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0, removed = 0;
  for (const s of subs ?? []) {
    const last = new Date(s.last_sent_at).getTime();
    const due = (Array.isArray(s.schedule) ? s.schedule : []).filter((m: { at: string }) => {
      const t = new Date(m.at).getTime();
      return t > last && t <= now.getTime() && now.getTime() - t < STALE_MS;
    }).slice(-3);
    if (!due.length) continue;
    let gone = false;
    for (const m of due) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.url || './', tag: m.tag || m.title }), { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { gone = true; break; } // subscription expired / app removed
        console.error('push failed', code, (e as Error).message);
      }
    }
    if (gone) { await db.from('push_subs').delete().eq('endpoint', s.endpoint); removed++; }
    else await db.from('push_subs').update({ last_sent_at: now.toISOString() }).eq('endpoint', s.endpoint);
  }
  return Response.json({ checked: subs?.length ?? 0, sent, removed });
});
