const TAKE_ENDPOINT = `${SUPABASE_URL}/functions/v1/send-take`;

let takeInitialized = false;
let takeRolesLoaded = false;
let takeRoles = [];
let takeDestinations = [];

function takeCurrentUserName() {
    const user = window.currentUser;
    return user?.user_metadata?.display_name
        || user?.user_metadata?.full_name
        || user?.email?.split('@')[0]
        || 'Usuário Aurora';
}

function setTakeConnectionStatus(connected, text) {
    const status = document.getElementById('take-header-status');
    if (!status) return;
    status.classList.toggle('is-offline', !connected);
    status.lastChild.textContent = ` ${text}`;
}

function selectedTakeRoles() {
    return [...document.querySelectorAll('#take-role-list input[name="take-role"]:checked')]
        .map(input => input.value);
}

function updateTakePreview() {
    const event = document.getElementById('take-event')?.value.trim() || '';
    const youtuber = document.getElementById('take-youtuber')?.value.trim() || '';
    const description = document.getElementById('take-description')?.value.trim() || '';

    const previewTitle = document.getElementById('take-preview-title');
    const previewEvent = document.getElementById('take-preview-event');
    const previewYoutuber = document.getElementById('take-preview-youtuber');
    const previewDescription = document.getElementById('take-preview-description');
    const previewUser = document.getElementById('take-preview-user');
    const previewMentions = document.getElementById('take-preview-mentions');
    const previewChannel = document.getElementById('take-preview-channel');

    if (previewTitle) previewTitle.textContent = event ? `Take · ${event}` : 'Novo take solicitado';
    if (previewEvent) previewEvent.textContent = event || 'Não informado';
    if (previewYoutuber) previewYoutuber.textContent = youtuber || 'Não informado';
    if (previewDescription) previewDescription.textContent = description || 'A descrição do take aparecerá aqui.';
    if (previewUser) previewUser.textContent = takeCurrentUserName();
    if (previewChannel) {
        const destinationId = document.getElementById('take-destination')?.value;
        const destination = takeDestinations.find(item => item.id === destinationId);
        previewChannel.textContent = destination ? `# ${destination.name}` : 'Discord';
    }

    const selectedIds = selectedTakeRoles();
    const selectedNames = takeRoles
        .filter(role => selectedIds.includes(role.id))
        .map(role => `@${role.name}`);
    if (previewMentions) {
        previewMentions.textContent = selectedNames.length ? selectedNames.join('  ') : 'Nenhum cargo marcado';
        previewMentions.classList.toggle('has-mentions', selectedNames.length > 0);
    }

    const eventCount = document.getElementById('take-event-count');
    const descriptionCount = document.getElementById('take-description-count');
    if (eventCount) eventCount.textContent = String(document.getElementById('take-event')?.value.length || 0);
    if (descriptionCount) descriptionCount.textContent = String(document.getElementById('take-description')?.value.length || 0);
}

function renderTakeDestinations() {
    const select = document.getElementById('take-destination');
    if (!select) return;

    if (!takeDestinations.length) {
        select.innerHTML = '<option value="">Nenhum canal disponível</option>';
        select.disabled = true;
        updateTakePreview();
        return;
    }

    select.innerHTML = takeDestinations.map(destination =>
        `<option value="${escapeHtml(destination.id)}"># ${escapeHtml(destination.name)}</option>`
    ).join('');
    select.disabled = false;
    updateTakePreview();
}

function renderTakeRoles() {
    const list = document.getElementById('take-role-list');
    if (!list) return;

    if (!takeRoles.length) {
        list.innerHTML = '<div class="take-role-empty">Nenhum cargo foi configurado para este servidor. A solicitação ainda pode ser enviada sem menções.</div>';
        updateTakePreview();
        return;
    }

    list.innerHTML = takeRoles.map(role => `
        <label class="take-role-option">
            <input type="checkbox" name="take-role" value="${escapeHtml(role.id)}" ${role.default ? 'checked' : ''}>
            <span>${escapeHtml(role.name)}</span>
        </label>
    `).join('');

    list.querySelectorAll('input').forEach(input => input.addEventListener('change', updateTakePreview));
    updateTakePreview();
}

async function takeAuthHeaders() {
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sua sessão expirou. Entre novamente para enviar o take.');
    return {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
    };
}

async function loadTakeRoles() {
    if (takeRolesLoaded) return;
    const list = document.getElementById('take-role-list');
    if (list) list.innerHTML = '<div class="take-roles-loading"><span class="spinner"></span> Carregando cargos…</div>';
    setTakeConnectionStatus(true, 'Verificando Discord');

    try {
        const headers = await takeAuthHeaders();
        const response = await fetch(TAKE_ENDPOINT, { method: 'GET', headers });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os cargos.');

        takeRoles = Array.isArray(result.roles)
            ? result.roles.filter(role => role && /^\d{5,25}$/.test(String(role.id)) && String(role.name || '').trim())
                .map(role => ({ id: String(role.id), name: String(role.name).trim(), default: Boolean(role.default) }))
            : [];
        takeDestinations = Array.isArray(result.destinations)
            ? result.destinations
                .filter(destination => destination && String(destination.id || '').trim() && String(destination.name || '').trim())
                .map(destination => ({ id: String(destination.id).trim(), name: String(destination.name).trim() }))
            : [];
        takeRolesLoaded = true;
        renderTakeDestinations();
        renderTakeRoles();
        setTakeConnectionStatus(true, 'Discord conectado');
    } catch (error) {
        console.error('Take roles:', error);
        if (list) list.innerHTML = '<div class="take-role-empty">Não foi possível carregar os cargos do Discord. Tente novamente ao abrir esta aba.</div>';
        setTakeConnectionStatus(false, 'Discord indisponível');
    }
}

function validateTakeForm() {
    const fields = [
        { id: 'take-event', label: 'evento' },
        { id: 'take-youtuber', label: 'YouTuber solicitante' },
        { id: 'take-description', label: 'descrição' },
    ];
    let firstInvalid = null;

    fields.forEach(({ id }) => {
        const input = document.getElementById(id);
        const invalid = !input?.value.trim();
        input?.classList.toggle('is-invalid', invalid);
        if (invalid && !firstInvalid) firstInvalid = input;
    });

    const destination = document.getElementById('take-destination');
    if (!destination?.value) {
        showToast('Selecione um canal de destino.');
        destination?.focus();
        return false;
    }

    if (firstInvalid) {
        firstInvalid.focus();
        showToast('Preencha todos os campos obrigatórios.');
        return false;
    }
    return true;
}

async function submitTake(event) {
    event.preventDefault();
    if (!validateTakeForm()) return;

    const button = document.getElementById('take-submit');
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Enviando…';

    try {
        const headers = await takeAuthHeaders();
        const payload = {
            event: document.getElementById('take-event').value.trim(),
            youtuber: document.getElementById('take-youtuber').value.trim(),
            description: document.getElementById('take-description').value.trim(),
            destinationId: document.getElementById('take-destination').value,
            roleIds: selectedTakeRoles(),
        };
        const response = await fetch(TAKE_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'O Discord não confirmou o envio.');

        document.getElementById('take-form').reset();
        document.querySelectorAll('#take-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
        updateTakePreview();
        showToast('Take enviado para o Discord!');
        setTakeConnectionStatus(true, 'Discord conectado');
    } catch (error) {
        console.error('Submit take:', error);
        showToast(error.message || 'Não foi possível enviar o take.');
        setTakeConnectionStatus(false, 'Falha no último envio');
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function renderTakePage() {
    if (!takeInitialized) {
        const form = document.getElementById('take-form');
        const inputs = ['take-event', 'take-youtuber', 'take-description'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            input?.addEventListener('input', () => {
                input.classList.remove('is-invalid');
                updateTakePreview();
            });
        });
        document.getElementById('take-destination')?.addEventListener('change', updateTakePreview);
        form?.addEventListener('submit', submitTake);
        takeInitialized = true;
    }

    updateTakePreview();
    if (takeRolesLoaded) {
        setTakeConnectionStatus(true, 'Discord conectado');
    } else {
        loadTakeRoles();
    }
}

window.renderTakePage = renderTakePage;
