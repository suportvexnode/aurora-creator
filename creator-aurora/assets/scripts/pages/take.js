const TAKE_ENDPOINT = `${SUPABASE_URL}/functions/v1/send-take`;

let takeInitialized = false;
let takeRolesLoaded = false;
let takeRoles = [];
let takeDestinations = [];
const TAKE_TEMPLATE_STORAGE_KEY = 'aurora.take.embed-template.v1';
const TAKE_DEFAULT_TEMPLATE = {
    title: '🎬 Take · {evento}',
    author: 'Aurora Creator · Solicitação de Take',
    description: '{descricao}',
    color: '#a996e0',
    thumbnailUrl: '',
    imageUrl: '',
    footer: 'Aurora Creator · Painel de Produção',
    fields: [
        { name: '📍 EVENTO', value: '{evento}', inline: true },
        { name: '▶️ YOUTUBER SOLICITANTE', value: '{youtuber}', inline: true },
        { name: '👤 SOLICITADO POR', value: '{solicitante}', inline: false },
    ],
};
let takeEmbedTemplate = null;

function getTakeEmbedTemplate() {
    if (takeEmbedTemplate) return takeEmbedTemplate;
    try {
        const saved = JSON.parse(localStorage.getItem(TAKE_TEMPLATE_STORAGE_KEY) || 'null');
        if (saved && typeof saved === 'object') {
            takeEmbedTemplate = {
                ...TAKE_DEFAULT_TEMPLATE,
                ...saved,
                fields: Array.isArray(saved.fields) ? saved.fields.slice(0, 25).map(field => ({
                    name: String(field?.name || '').slice(0, 256),
                    value: String(field?.value || '').slice(0, 1024),
                    inline: Boolean(field?.inline),
                })) : TAKE_DEFAULT_TEMPLATE.fields.map(field => ({ ...field })),
            };
        }
    } catch (error) {
        console.warn('Não foi possível carregar o modelo de embed salvo.', error);
    }
    if (!takeEmbedTemplate) takeEmbedTemplate = structuredClone(TAKE_DEFAULT_TEMPLATE);
    return takeEmbedTemplate;
}

function saveTakeEmbedTemplate() {
    try { localStorage.setItem(TAKE_TEMPLATE_STORAGE_KEY, JSON.stringify(getTakeEmbedTemplate())); }
    catch (error) { console.warn('Não foi possível salvar o modelo de embed.', error); }
}

function takeTemplateValue(template) {
    const values = {
        evento: document.getElementById('take-event')?.value.trim() || 'Nome do evento',
        youtuber: document.getElementById('take-youtuber')?.value.trim() || 'Nome do canal ou criador',
        descricao: document.getElementById('take-description')?.value.trim() || 'A descrição do take aparecerá aqui.',
        solicitante: takeCurrentUserName(),
    };
    return String(template || '').replace(/\{(evento|youtuber|descricao|solicitante)\}/g, (_, name) => values[name]);
}

function renderTakeTemplateEditor() {
    const template = getTakeEmbedTemplate();
    const title = document.getElementById('take-template-title');
    if (!title) return;
    title.value = template.title;
    document.getElementById('take-template-author').value = template.author;
    document.getElementById('take-template-description').value = template.description;
    document.getElementById('take-template-color').value = /^#[0-9a-f]{6}$/i.test(template.color) ? template.color : TAKE_DEFAULT_TEMPLATE.color;
    document.getElementById('take-template-thumbnail').value = template.thumbnailUrl || '';
    document.getElementById('take-template-image').value = template.imageUrl || '';
    document.getElementById('take-template-footer').value = template.footer;
    const list = document.getElementById('take-template-fields');
    list.innerHTML = template.fields.map((field, index) => `
        <div class="take-template-field" data-index="${index}">
          <label>Nome<input data-template-key="name" maxlength="256" value="${escapeHtml(field.name)}" placeholder="Nome do campo"></label>
          <label>Valor<input data-template-key="value" maxlength="1024" value="${escapeHtml(field.value)}" placeholder="Texto ou variável"></label>
          <label class="take-template-inline"><input data-template-key="inline" type="checkbox" ${field.inline ? 'checked' : ''}> Em linha</label>
          <div class="take-template-actions">
            <button type="button" class="take-template-move" data-direction="-1" aria-label="Mover campo ${index + 1} para cima" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="take-template-move" data-direction="1" aria-label="Mover campo ${index + 1} para baixo" ${index === template.fields.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="take-template-remove" aria-label="Remover campo ${index + 1}">Remover</button>
          </div>
        </div>
    `).join('') || '<p class="take-template-empty">Sem campos. Adicione um para exibir mais informações.</p>';
    list.querySelectorAll('.take-template-field').forEach(row => {
        row.querySelectorAll('[data-template-key]').forEach(input => input.addEventListener('input', updateTakeTemplateFromEditor));
        row.querySelector('.take-template-remove')?.addEventListener('click', () => {
            getTakeEmbedTemplate().fields.splice(Number(row.dataset.index), 1);
            saveTakeEmbedTemplate();
            renderTakeTemplateEditor();
        });
        row.querySelectorAll('.take-template-move').forEach(button => button.addEventListener('click', () => {
            const fields = getTakeEmbedTemplate().fields;
            const from = Number(row.dataset.index);
            const to = from + Number(button.dataset.direction);
            if (to < 0 || to >= fields.length) return;
            [fields[from], fields[to]] = [fields[to], fields[from]];
            saveTakeEmbedTemplate();
            renderTakeTemplateEditor();
        }));
    });
    updateTakePreview();
}

function updateTakeTemplateFromEditor() {
    const template = getTakeEmbedTemplate();
    template.title = document.getElementById('take-template-title').value.slice(0, 256);
    template.author = document.getElementById('take-template-author').value.slice(0, 256);
    template.description = document.getElementById('take-template-description').value.slice(0, 4000);
    template.color = document.getElementById('take-template-color').value || TAKE_DEFAULT_TEMPLATE.color;
    template.thumbnailUrl = document.getElementById('take-template-thumbnail').value.slice(0, 500);
    template.imageUrl = document.getElementById('take-template-image').value.slice(0, 500);
    template.footer = document.getElementById('take-template-footer').value.slice(0, 2048);
    document.querySelectorAll('#take-template-fields .take-template-field').forEach(row => {
        const index = Number(row.dataset.index);
        if (!template.fields[index]) return;
        template.fields[index] = {
            name: row.querySelector('[data-template-key="name"]').value.slice(0, 256),
            value: row.querySelector('[data-template-key="value"]').value.slice(0, 1024),
            inline: row.querySelector('[data-template-key="inline"]').checked,
        };
    });
    saveTakeEmbedTemplate();
    updateTakePreview();
}

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
    const previewDescription = document.getElementById('take-preview-description');
    const previewAuthor = document.getElementById('take-preview-author');
    const previewFooter = document.getElementById('take-preview-footer');
    const previewFields = document.getElementById('take-preview-fields');
    const previewThumbnail = document.getElementById('take-preview-thumbnail');
    const previewImage = document.getElementById('take-preview-image');
    const embed = document.querySelector('.take-embed');
    const previewMentions = document.getElementById('take-preview-mentions');
    const previewChannel = document.getElementById('take-preview-channel');
    const template = getTakeEmbedTemplate();

    if (previewTitle) previewTitle.textContent = takeTemplateValue(template.title);
    if (previewAuthor) previewAuthor.textContent = template.author;
    if (previewDescription) {
        previewDescription.textContent = takeTemplateValue(template.description);
        previewDescription.hidden = !template.description;
    }
    if (previewFooter) {
        previewFooter.innerHTML = `${template.footer ? '<img src="../aurora-icon.png" alt="">' : ''}${escapeHtml(template.footer)}`;
        previewFooter.hidden = !template.footer;
    }
    if (previewFields) {
        previewFields.innerHTML = template.fields.filter(field => field.name.trim() || field.value.trim()).map(field => `
            <div class="${field.inline ? 'is-inline' : ''}"><span>${escapeHtml(takeTemplateValue(field.name))}</span><strong>${escapeHtml(takeTemplateValue(field.value))}</strong></div>
        `).join('');
        previewFields.hidden = !previewFields.children.length;
    }
    const safeImageUrl = value => {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' ? url.href : '';
        } catch { return ''; }
    };
    if (previewThumbnail) {
        const imageUrl = safeImageUrl(template.thumbnailUrl);
        if (imageUrl) previewThumbnail.src = imageUrl;
        else previewThumbnail.removeAttribute('src');
        previewThumbnail.hidden = !imageUrl;
    }
    if (previewImage) {
        const imageUrl = safeImageUrl(template.imageUrl);
        if (imageUrl) previewImage.src = imageUrl;
        else previewImage.removeAttribute('src');
        previewImage.hidden = !imageUrl;
    }
    if (embed) embed.style.setProperty('--take-embed-color', /^#[0-9a-f]{6}$/i.test(template.color) ? template.color : TAKE_DEFAULT_TEMPLATE.color);
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
    if (!canAccessTab('take')) { openUpgradeModal('take'); return; }
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
            embedTemplate: getTakeEmbedTemplate(),
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
    if (!canAccessTab('take')) { openUpgradeModal('take'); return; }
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
        ['take-template-title', 'take-template-author', 'take-template-description', 'take-template-color', 'take-template-thumbnail', 'take-template-image', 'take-template-footer']
            .forEach(id => document.getElementById(id)?.addEventListener('input', updateTakeTemplateFromEditor));
        document.getElementById('take-template-add')?.addEventListener('click', () => {
            const fields = getTakeEmbedTemplate().fields;
            if (fields.length >= 25) { showToast('A embed pode ter no máximo 25 campos.'); return; }
            fields.push({ name: 'Novo campo', value: 'Texto do campo', inline: false });
            saveTakeEmbedTemplate();
            renderTakeTemplateEditor();
        });
        document.getElementById('take-template-reset')?.addEventListener('click', () => {
            takeEmbedTemplate = structuredClone(TAKE_DEFAULT_TEMPLATE);
            saveTakeEmbedTemplate();
            renderTakeTemplateEditor();
            showToast('Embed modelo restaurada.');
        });
        form?.addEventListener('submit', submitTake);
        takeInitialized = true;
    }

    renderTakeTemplateEditor();
    updateTakePreview();
    if (takeRolesLoaded) {
        setTakeConnectionStatus(true, 'Discord conectado');
    } else {
        loadTakeRoles();
    }
}

window.renderTakePage = renderTakePage;
