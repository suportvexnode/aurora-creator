// First-touch partner attribution. This is deliberately independent from the
// Supabase client used by each page, so a link can be captured on the landing
// page before the visitor opens the account or pricing area.
(() => {
  const SUPABASE_URL = 'https://buujbhfmpujtlnbncget.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFub24iLCJpYXQiOjE3NzY3MzUyNzQsImV4cCI6MjA5MjMxMTI3NH0.JnKVtBG9FT4FVDGN2CmluNWl-RaRtQ1Yw5LwPCG_4GY';
  const REFERRAL_KEY = 'aurora_partner_referral_v1';
  const VISITOR_KEY = 'aurora_partner_visitor_v1';
  const TTL_MS = 90 * 24 * 60 * 60 * 1000;
  const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  }
  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch { /* storage is optional */ }
  }
  function normalizeCode(value) {
    const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return CODE_PATTERN.test(code) ? code : null;
  }
  function referral() {
    try {
      const value = JSON.parse(storageGet(REFERRAL_KEY) || 'null');
      if (!value || !normalizeCode(value.code) || !Number.isFinite(value.capturedAt)
        || Date.now() - value.capturedAt > TTL_MS) {
        storageRemove(REFERRAL_KEY);
        return null;
      }
      return { code: normalizeCode(value.code), capturedAt: value.capturedAt };
    } catch {
      storageRemove(REFERRAL_KEY);
      return null;
    }
  }
  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
      const random = Math.random() * 16 | 0;
      return (character === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
    });
  }
  function visitorId() {
    const saved = storageGet(VISITOR_KEY);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved || '')) return saved;
    const created = uuid();
    storageSet(VISITOR_KEY, created);
    return created;
  }
  async function rpc(name, body, accessToken) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Partner attribution request failed (${response.status}).`);
    return response.json();
  }
  function cleanPartnerParameter() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('p')) return;
    url.searchParams.delete('p');
    window.history?.replaceState?.({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
  async function captureLanding(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) { cleanPartnerParameter(); return; }
    const current = referral();
    // Keep the original partner during the attribution window. This makes a
    // later redirect incapable of silently replacing the first valid source.
    if (current?.code && current.code !== code) { cleanPartnerParameter(); return; }
    storageSet(REFERRAL_KEY, JSON.stringify({ code, capturedAt: current?.capturedAt || Date.now() }));
    cleanPartnerParameter();
    try {
      const accepted = await rpc('aurora_track_partner_visit', {
        partner_code: code,
        browser_visitor_id: visitorId(),
        path_at_landing: window.location.pathname,
      });
      if (accepted !== true && referral()?.code === code) storageRemove(REFERRAL_KEY);
    } catch {
      // Registration and checkout remain usable if analytics is temporarily unavailable.
    }
  }
  async function captureForSession(sessionOrToken) {
    const current = referral();
    const accessToken = typeof sessionOrToken === 'string'
      ? sessionOrToken
      : sessionOrToken?.access_token;
    if (!current || !accessToken) return false;
    try {
      return await rpc('aurora_capture_partner_attribution', { partner_code: current.code }, accessToken) === true;
    } catch {
      return false;
    }
  }

  window.AuroraPartnerAttribution = {
    getCode: () => referral()?.code || null,
    captureForSession,
  };
  const partnerCode = new URLSearchParams(window.location.search).get('p');
  if (partnerCode !== null) void captureLanding(partnerCode);
})();
