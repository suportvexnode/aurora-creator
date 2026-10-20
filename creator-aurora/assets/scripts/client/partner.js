function partnerCurrency(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
        .format(Number(cents || 0) / 100);
}

function partnerDate(value) {
    return value ? new Date(value).toLocaleDateString('pt-BR') : 'Ainda não entrou';
}

async function copyPartnerLink(link) {
    try {
        await navigator.clipboard.writeText(link);
        showToast('Link de parceiro copiado!');
    } catch {
        showToast('Não foi possível copiar o link.');
    }
}

async function renderPartnerDashboard() {
    const body = document.getElementById('partner-body');
    if (!body || !isPartner()) return;
    body.innerHTML = '<div class="loading-state"><span class="spinner"></span> Carregando estatísticas…</div>';

    const [summaryResult, referralsResult] = await Promise.all([
        sb.rpc('aurora_my_partner_summary'),
        sb.rpc('aurora_my_partner_referrals'),
    ]);
    if (summaryResult.error || !summaryResult.data?.[0]) {
        body.innerHTML = '<div class="admin-empty">Não foi possível carregar suas estatísticas agora.</div>';
        return;
    }
    const summary = summaryResult.data[0];
    window.partnerSummary = summary;
    const referrals = referralsResult.error ? [] : (referralsResult.data || []);
    const link = `${window.location.origin}/?p=${encodeURIComponent(summary.code)}`;

    body.innerHTML = `
        <div class="partner-dashboard-shell">
        <section class="partner-hero">
            <div class="partner-hero-copy">
                <div class="partner-kicker">PROGRAMA DE PARCERIA</div>
                <h2>${escapeHtml(summary.display_name)}</h2>
                <p>Seu painel reúne as indicações feitas pelo seu link e a previsão de comissão para o repasse manual.</p>
            </div>
            <div class="partner-rate-badge"><span>SUA COMISSÃO</span><strong>${Number(summary.commission_percentage || 0).toLocaleString('pt-BR')}%</strong><small>por compra aprovada</small></div>
            <div class="partner-link-card">
                <div class="partner-link-copy"><div class="partner-kicker">SEU LINK EXCLUSIVO</div><code>${escapeHtml(link)}</code><p>Compartilhe este link para atribuir novas indicações à sua parceria.</p></div>
                <button class="action-btn primary" id="partner-copy-link">Copiar link</button>
            </div>
        </section>

        <section class="partner-overview">
            <div class="partner-section-heading"><div><span>RESULTADO ACUMULADO</span><h3>Seu funil de indicações</h3></div><p>Do primeiro acesso à compra confirmada.</p></div>
            <div class="partner-stats-grid">
                <article class="partner-stat"><span class="partner-stat-step">01</span><div><span>Visitantes</span><strong>${Number(summary.unique_visitors || 0).toLocaleString('pt-BR')}</strong><small>Acessos únicos pelo link</small></div></article>
                <article class="partner-stat"><span class="partner-stat-step">02</span><div><span>Cadastros</span><strong>${Number(summary.registrations || 0).toLocaleString('pt-BR')}</strong><small>Contas indicadas</small></div></article>
                <article class="partner-stat"><span class="partner-stat-step">03</span><div><span>Entraram</span><strong>${Number(summary.users_logged_in || 0).toLocaleString('pt-BR')}</strong><small>Indicados que acessaram</small></div></article>
                <article class="partner-stat"><span class="partner-stat-step">04</span><div><span>Compras pagas</span><strong>${Number(summary.approved_purchases || 0).toLocaleString('pt-BR')}</strong><small>Pix aprovados</small></div></article>
                <article class="partner-stat accent"><span>COMISSÃO ESTIMADA</span><strong>${partnerCurrency(summary.estimated_commission_cents)}</strong><small>Disponível para repasse manual</small></article>
            </div>
            <div class="partner-revenue-note">Vendas atribuídas: <strong>${partnerCurrency(summary.approved_revenue_cents)}</strong>. A comissão é apenas um demonstrativo; o pagamento é feito manualmente pela administração.</div>
        </section>
        <section class="partner-referrals">
            <div class="partner-section-heading"><div><span>DETALHAMENTO</span><h3>Suas indicações</h3></div><p>Cadastros e compras atribuídos ao seu link.</p></div>
            <div class="admin-users-table-wrap"><table class="admin-users-table">
                <thead><tr><th>Usuário</th><th>Cadastro</th><th>Login</th><th>Compras</th><th>Comissão estimada</th></tr></thead>
                <tbody>${referrals.length ? referrals.map(referral => `
                    <tr>
                        <td><div class="admin-user-name">${escapeHtml(referral.display_name || 'Usuário')}</div></td>
                        <td>${partnerDate(referral.registered_at)}</td>
                        <td>${partnerDate(referral.first_login_at)}</td>
                        <td><span class="admin-tab-chip ${Number(referral.approved_purchases) > 0 ? 'on' : 'off'}">${Number(referral.approved_purchases) > 0 ? `${referral.approved_purchases} paga(s)` : 'Sem compra'}</span></td>
                        <td>${partnerCurrency(referral.estimated_commission_cents)}</td>
                    </tr>`).join('') : '<tr><td colspan="5" class="partner-empty-row">Ainda não há indicações registradas pelo seu link.</td></tr>'}</tbody>
            </table></div>
        </section>
        </div>`;
    document.getElementById('partner-copy-link')?.addEventListener('click', () => copyPartnerLink(link));
}
