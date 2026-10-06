const { createClient: createPlansClient } = supabase;
const plansSb = createPlansClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let billing = 'monthly';
let publicPlans = [];
let checkoutTimer = null;
let checkoutPaymentId = null;

function escapePlanHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function brlFromCents(cents, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format((Number(cents) || 0) / 100);
}

function priceFor(plan, cycle) {
  return cycle === 'annual' ? plan.annual_price_cents : plan.monthly_price_cents;
}

function checkoutButton(plan) {
  if (plan.id === 'free') {
    return '<a href="../cliente/" class="plan-cta cta-free">Criar conta grátis</a>';
  }
  const price = priceFor(plan, billing);
  if (!plan.purchasable) {
    return '<button class="plan-cta cta-free" type="button" disabled>Atribuído pelo administrador</button>';
  }
  if (!Number.isInteger(price) || price <= 0) {
    return '<button class="plan-cta cta-free" type="button" disabled>Indisponível neste período</button>';
  }
  const ctaClass = plan.checkout_highlighted ? 'cta-pro' : 'cta-team';
  return `<button class="plan-cta ${ctaClass}" type="button" data-checkout-plan="${escapePlanHtml(plan.id)}">Pagar com Pix →</button>`;
}

function renderPlans() {
  const grid = document.getElementById('plansGrid');
  if (!grid) return;
  grid.classList.add('loaded');
  if (!publicPlans.length) {
    grid.innerHTML = '<div class="plans-empty">Nenhum plano público foi configurado ainda.</div>';
    return;
  }

  grid.innerHTML = publicPlans.map((plan) => {
    const rawPrice = priceFor(plan, billing);
    const isFree = Number(rawPrice) === 0;
    const hasPrice = Number.isInteger(rawPrice) && rawPrice >= 0;
    const monthlyEquivalent = billing === 'annual' && rawPrice > 0 ? rawPrice / 12 : rawPrice;
    const features = Array.isArray(plan.checkout_features)
      ? plan.checkout_features.filter((feature) => typeof feature === 'string' && feature.trim())
      : [];
    const badge = plan.checkout_badge || (plan.purchasable ? 'Pix' : 'Plano especial');
    const badgeClass = plan.checkout_highlighted ? 'badge-pro' : (plan.id === 'free' ? 'badge-free' : 'badge-team');
    const amount = hasPrice ? brlFromCents(monthlyEquivalent) : '—';
    const annualNote = billing === 'annual' && rawPrice > 0
      ? `<div class="plan-annual-note visible">Cobrança única de R$ ${brlFromCents(rawPrice)} por 1 ano</div>`
      : (isFree ? '<div class="plan-annual-note visible">Gratuito para sempre</div>' : '');

    return `<article class="plan ${plan.checkout_highlighted ? 'featured' : ''}">
      <span class="plan-badge ${badgeClass}">${escapePlanHtml(badge)}</span>
      <div class="plan-name">${escapePlanHtml(plan.name)}</div>
      <div class="plan-desc">${escapePlanHtml(plan.checkout_description || '')}</div>
      <div class="plan-price">
        <div class="plan-price-row"><span class="plan-currency">R$</span><span class="plan-amount">${amount}</span><span class="plan-period">/mês</span></div>
        ${annualNote}
      </div>
      <div class="plan-divider"></div>
      <ul class="plan-features">${features.map((feature) => `<li class="plan-feature"><span class="feat-icon feat-check"></span>${escapePlanHtml(feature)}</li>`).join('')}</ul>
      ${checkoutButton(plan)}
    </article>`;
  }).join('');

  grid.querySelectorAll('[data-checkout-plan]').forEach((button) => {
    button.addEventListener('click', () => startCheckout(button.dataset.checkoutPlan));
  });
}

function setBilling(type) {
  billing = type === 'annual' ? 'annual' : 'monthly';
  document.getElementById('btnMonthly')?.classList.toggle('active', billing === 'monthly');
  document.getElementById('btnAnnual')?.classList.toggle('active', billing === 'annual');
  renderPlans();
}
window.setBilling = setBilling;

function showPlansError(message) {
  const error = document.getElementById('plansError');
  error.textContent = message;
  error.hidden = false;
}

async function loadPlans() {
  const { data, error } = await plansSb.from('plans').select([
    'id', 'name', 'public_visible', 'purchasable', 'monthly_price_cents', 'annual_price_cents',
    'checkout_description', 'checkout_features', 'checkout_badge', 'checkout_highlighted', 'checkout_position',
  ].join(',')).eq('public_visible', true).order('checkout_position').order('name');
  if (error) throw error;
  publicPlans = data || [];
  renderPlans();
}

function checkoutModal(open) {
  document.getElementById('pixModal')?.classList.toggle('open', open);
  document.body.classList.toggle('modal-open', open);
  if (!open) {
    clearInterval(checkoutTimer);
    checkoutTimer = null;
    checkoutPaymentId = null;
  }
}

function renderCheckoutState(payment) {
  const loading = document.getElementById('pixLoading');
  const content = document.getElementById('pixContent');
  const success = document.getElementById('pixSuccess');
  const error = document.getElementById('pixError');
  loading.hidden = true;
  content.hidden = true;
  success.hidden = true;
  error.hidden = true;

  if (payment.status === 'approved') {
    success.hidden = false;
    document.getElementById('pixSuccessExpiry').textContent = payment.entitlement_expires_at
      ? `Acesso liberado até ${new Date(payment.entitlement_expires_at).toLocaleDateString('pt-BR')}.`
      : 'Seu acesso já foi liberado.';
    clearInterval(checkoutTimer);
    checkoutTimer = null;
    return;
  }
  if (['rejected', 'cancelled', 'expired', 'refunded', 'error'].includes(payment.status)) {
    error.hidden = false;
    document.getElementById('pixErrorText').textContent = payment.status === 'expired'
      ? 'Este Pix expirou. Feche a janela e gere um novo.'
      : 'O pagamento não pôde ser concluído. Feche a janela e tente novamente.';
    clearInterval(checkoutTimer);
    checkoutTimer = null;
    return;
  }

  if (!payment.qr_code && !payment.qrCode) {
    loading.hidden = false;
    document.getElementById('pixLoadingText').textContent = 'O Mercado Pago está preparando seu Pix…';
    return;
  }
  const qrCode = payment.qr_code || payment.qrCode;
  const qrBase64 = payment.qr_code_base64 || payment.qrCodeBase64;
  const ticketUrl = payment.ticket_url || payment.ticketUrl;
  content.hidden = false;
  document.getElementById('pixCode').value = qrCode;
  const image = document.getElementById('pixQrImage');
  if (qrBase64 && /^[a-z0-9+/=\r\n]+$/i.test(qrBase64)) {
    image.src = `data:image/png;base64,${qrBase64.replace(/\s/g, '')}`;
    image.hidden = false;
  } else image.hidden = true;
  const link = document.getElementById('pixTicketLink');
  try {
    const target = new URL(ticketUrl);
    const mercadoPagoHost = target.hostname === 'mercadopago.com.br' || target.hostname.endsWith('.mercadopago.com.br');
    link.href = target.protocol === 'https:' && mercadoPagoHost ? target.href : '#';
    link.hidden = link.href.endsWith('#');
  } catch { link.hidden = true; }
}

async function pollPayment() {
  if (!checkoutPaymentId) return;
  const { data, error } = await plansSb.from('plan_payments')
    .select('id,status,qr_code,qr_code_base64,ticket_url,expires_at,entitlement_expires_at')
    .eq('id', checkoutPaymentId).maybeSingle();
  if (!error && data) renderCheckoutState(data);
}

async function startCheckout(planId) {
  const plan = publicPlans.find((item) => item.id === planId);
  if (!plan?.purchasable || !Number.isInteger(priceFor(plan, billing)) || priceFor(plan, billing) <= 0) return;
  const { data: { session } } = await plansSb.auth.getSession();
  if (!session) {
    const resume = new URL(window.location.href);
    resume.searchParams.set('checkout', planId);
    resume.searchParams.set('billing', billing);
    const returnTo = resume.pathname + resume.search;
    window.location.href = `../cliente/?returnTo=${encodeURIComponent(returnTo)}`;
    return;
  }

  checkoutModal(true);
  document.getElementById('pixLoading').hidden = false;
  document.getElementById('pixContent').hidden = true;
  document.getElementById('pixSuccess').hidden = true;
  document.getElementById('pixError').hidden = true;
  document.getElementById('pixLoadingText').textContent = 'Gerando seu Pix com segurança…';

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ planId, billingCycle: billing }),
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || 'Não foi possível gerar o Pix.');
    checkoutPaymentId = result.id;
    renderCheckoutState(result);
    clearInterval(checkoutTimer);
    if (!['approved', 'rejected', 'cancelled', 'expired', 'refunded', 'error'].includes(result.status)) {
      checkoutTimer = setInterval(pollPayment, 3000);
    }
  } catch (error) {
    renderCheckoutState({ status: 'error' });
    document.getElementById('pixErrorText').textContent = error.message || 'Não foi possível gerar o Pix.';
  }
}
window.startCheckout = startCheckout;

async function copyPixCode() {
  const input = document.getElementById('pixCode');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand('copy');
  }
  const button = document.getElementById('pixCopyButton');
  button.textContent = 'Copiado!';
  setTimeout(() => { button.textContent = 'Copiar código Pix'; }, 1800);
}

async function resumeCheckoutFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const planId = params.get('checkout');
  if (!planId) return;
  setBilling(params.get('billing') === 'annual' ? 'annual' : 'monthly');
  const clean = new URL(window.location.href);
  clean.searchParams.delete('checkout');
  clean.searchParams.delete('billing');
  history.replaceState({}, '', clean.pathname + clean.search + clean.hash);
  const { data: { session } } = await plansSb.auth.getSession();
  if (session && publicPlans.some((plan) => plan.id === planId)) startCheckout(planId);
}

document.getElementById('pixModalClose')?.addEventListener('click', () => checkoutModal(false));
document.getElementById('pixCopyButton')?.addEventListener('click', copyPixCode);
document.getElementById('pixModal')?.addEventListener('click', (event) => {
  if (event.target.id === 'pixModal') checkoutModal(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') checkoutModal(false);
});

loadPlans().then(resumeCheckoutFromUrl).catch((error) => {
  console.error('Could not load public plans:', error);
  document.getElementById('plansGrid').classList.add('loaded');
  document.getElementById('plansGrid').innerHTML = '';
  showPlansError('Não foi possível carregar os planos agora. Tente novamente em instantes.');
});
