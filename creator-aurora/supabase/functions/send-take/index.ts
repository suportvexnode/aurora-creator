import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type DiscordRole = {
  id: string;
  name: string;
  default?: boolean;
};

type DiscordDestination = {
  id: string;
  name: string;
  webhookUrl: string;
};

const AURORA_ICON = 'https://creator.mcaurora.com.br/aurora-icon.png';
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_TAKE_WEBHOOK_URL')?.trim() || '';
const RATE_LIMIT_MS = 30_000;
const lastSubmission = new Map<string, number>();

function validWebhookUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const allowedHost = url.hostname === 'discord.com' || url.hostname === 'discordapp.com';
    return allowedHost && url.pathname.startsWith('/api/webhooks/') ? url : null;
  } catch {
    return null;
  }
}

function configuredDestinations(): DiscordDestination[] {
  const raw = Deno.env.get('DISCORD_TAKE_DESTINATIONS')?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seenIds = new Set<string>();
        return parsed
          .filter((destination) => {
            const id = String(destination?.id || '').trim();
            const name = String(destination?.name || '').trim();
            const webhook = validWebhookUrl(destination?.webhookUrl);
            if (!/^[a-z0-9_-]{1,50}$/i.test(id) || !name || !webhook || seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
          })
          .map((destination) => ({
            id: String(destination.id).trim(),
            name: String(destination.name).trim().slice(0, 60),
            webhookUrl: String(destination.webhookUrl).trim(),
          }));
      }
    } catch {
      console.error('DISCORD_TAKE_DESTINATIONS must be a valid JSON array.');
    }
  }

  // Compatibilidade com a configuração antiga de apenas um webhook.
  if (validWebhookUrl(DISCORD_WEBHOOK_URL)) {
    return [{ id: 'principal', name: 'Canal principal', webhookUrl: DISCORD_WEBHOOK_URL }];
  }
  return [];
}

function configuredRoles(): DiscordRole[] {
  const raw = Deno.env.get('DISCORD_TAKE_ROLES')?.trim() || '[]';
  try {
    const roles = JSON.parse(raw);
    if (!Array.isArray(roles)) return [];
    return roles
      .filter((role) => role && /^\d{5,25}$/.test(String(role.id)) && String(role.name || '').trim())
      .map((role) => ({
        id: String(role.id),
        name: String(role.name).trim().slice(0, 50),
        default: Boolean(role.default),
      }));
  } catch {
    console.error('DISCORD_TAKE_ROLES must be a valid JSON array.');
    return [];
  }
}

function allowedOrigin(request: Request): string {
  const origin = request.headers.get('origin') || '';
  const extras = (Deno.env.get('TAKE_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = ['https://creator.mcaurora.com.br', ...extras];
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return allowed.includes(origin) || isLocal ? origin : allowed[0];
}

function corsHeaders(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(request),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean || clean.length > maxLength) return null;
  return clean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json(request, { error: 'Método não permitido.' }, 405);
  }

  const user = await authenticatedUser(request);
  if (!user) return json(request, { error: 'Sessão inválida ou expirada.' }, 401);

  const destinations = configuredDestinations();
  if (!destinations.length) {
    console.error('No valid Discord take destination is configured.');
    return json(request, { error: 'A integração com o Discord ainda não foi configurada.' }, 503);
  }

  const roles = configuredRoles();
  if (request.method === 'GET') {
    return json(request, {
      roles,
      destinations: destinations.map(({ id, name }) => ({ id, name })),
    });
  }

  const previousSubmission = lastSubmission.get(user.id) || 0;
  const waitMs = RATE_LIMIT_MS - (Date.now() - previousSubmission);
  if (waitMs > 0) {
    return json(request, { error: `Aguarde ${Math.ceil(waitMs / 1000)}s antes de enviar outro take.` }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'Dados da solicitação inválidos.' }, 400);
  }

  const event = requiredText(body.event, 100);
  const youtuber = requiredText(body.youtuber, 60);
  const description = requiredText(body.description, 1000);
  if (!event || !youtuber || !description) {
    return json(request, { error: 'Preencha evento, YouTuber e descrição dentro dos limites permitidos.' }, 400);
  }

  const destinationId = typeof body.destinationId === 'string' ? body.destinationId.trim() : '';
  const destination = destinations.find((item) => item.id === destinationId)
    || (!destinationId && destinations.length === 1 ? destinations[0] : null);
  if (!destination) {
    return json(request, { error: 'Selecione um canal de destino válido.' }, 400);
  }
  const webhookUrl = validWebhookUrl(destination.webhookUrl);
  if (!webhookUrl) {
    console.error(`Invalid webhook for destination: ${destination.id}`);
    return json(request, { error: 'O canal selecionado está com uma configuração inválida.' }, 503);
  }

  const requestedRoleIds = Array.isArray(body.roleIds) ? body.roleIds.map(String) : [];
  const allowedRoleIds = new Set(roles.map((role) => role.id));
  const roleIds = [...new Set(requestedRoleIds.filter((id) => allowedRoleIds.has(id)))].slice(0, 10);
  const requester = String(
    user.user_metadata?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'Usuário Aurora'
  ).slice(0, 100);

  const discordPayload = {
    username: 'Aurora',
    avatar_url: AURORA_ICON,
    content: roleIds.map((id) => `<@&${id}>`).join(' ') || undefined,
    allowed_mentions: { parse: [], roles: roleIds },
    embeds: [{
      color: 0xA996E0,
      author: { name: 'Aurora Creator · Solicitação de Take', icon_url: AURORA_ICON },
      title: `🎬 Take · ${event}`,
      description,
      fields: [
        { name: '📍 EVENTO', value: event, inline: true },
        { name: '▶️ YOUTUBER SOLICITANTE', value: youtuber, inline: true },
        { name: '👤 SOLICITADO POR', value: requester, inline: false },
      ],
      footer: { text: 'Aurora Creator · Painel de Produção', icon_url: AURORA_ICON },
      timestamp: new Date().toISOString(),
    }],
  };

  webhookUrl.searchParams.set('wait', 'true');
  const discordResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload),
  });

  if (!discordResponse.ok) {
    const responseText = await discordResponse.text();
    console.error(`Discord webhook failed (${discordResponse.status}):`, responseText.slice(0, 500));
    return json(request, { error: 'O Discord não aceitou a solicitação. Tente novamente em instantes.' }, 502);
  }

  lastSubmission.set(user.id, Date.now());
  return json(request, { ok: true }, 201);
});
