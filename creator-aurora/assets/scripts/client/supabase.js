



const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.sb = sb;


window.currentUser = null;
window.userRole    = null;
window.userPlan    = null;

let _planCache     = { data: null, ts: 0, TTL: 300_000 };
let _profileLoaded = false; 





function hideInitialLoading() {
  const el = document.getElementById('initial-loading');
  if (!el) return;

  const minTime = 2900;
  const elapsed = Date.now() - (window._introStart || Date.now());
  const delay = Math.max(0, minTime - elapsed);

  setTimeout(() => {
    
    el.classList.add('fade-out');

    
    const curtain = document.createElement('div');
    curtain.className = 'intro-curtain';
    document.body.appendChild(curtain);

    
    setTimeout(() => {
      el.remove();
      curtain.style.transition = 'opacity .3s ease';
      curtain.style.opacity = '0';
      setTimeout(() => curtain.remove(), 320);
    }, 520);

  }, delay);
}


window._introStart = Date.now();

function showPanel() {
    document.getElementById('auth-screen').style.display  = 'none';
    document.getElementById('auth-screen').classList.remove('active');

    const panel = document.getElementById('panel');
    panel.classList.add('active');
    panel.classList.add('panel-entering');

    
    setTimeout(() => panel.classList.remove('panel-entering'), 800);
}

function showAuth() {
    document.getElementById('panel').classList.remove('active');
    const a = document.getElementById('auth-screen');
    a.style.display = 'flex';
    a.classList.add('active');
}





function setFallbackPlan() {
    window.userPlan = {
        id: 'free', name: 'Free',
        allowed_tabs: ['roteiros', 'board', 'take', 'avatar','titulos','assets'],
        max_projects: 1, max_assets: 0, max_motions: 0
    };
}


function applyPlanRestrictions() {
    const allowed = window.userPlan?.allowed_tabs || [];
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    
    const navLabel = nav.querySelector('.nav-label');
    const items = [...nav.querySelectorAll('.nav-item[data-tab]:not([data-tab="admin"])')];

    items.forEach(btn => {
        const locked = btn.dataset.tab !== 'take' && allowed.length > 0 && !allowed.includes(btn.dataset.tab);
        btn.classList.toggle('nav-locked', locked);
    });

    
    const unlocked = items.filter(b => !b.classList.contains('nav-locked'));
    const locked   = items.filter(b =>  b.classList.contains('nav-locked'));

    
    items.forEach(b => b.remove());

    
    unlocked.forEach(b => nav.appendChild(b));

    
    if (locked.length > 0) {
        
        nav.querySelector('.nav-locked-divider')?.remove();

        const divider = document.createElement('div');
        divider.className = 'nav-locked-divider';
        divider.innerHTML = `
            <button class="nav-locked-toggle" id="nav-locked-toggle" title="Mostrar/ocultar bloqueados">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     style="width:10px;height:10px;transition:transform .2s">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
                <span id="nav-locked-label">Bloqueados</span>
                <span class="nav-locked-count">${locked.length}</span>
            </button>
        `;
        nav.appendChild(divider);

        const lockedWrap = document.createElement('div');
        lockedWrap.className = 'nav-locked-wrap';
        lockedWrap.id = 'nav-locked-wrap';
        locked.forEach(b => lockedWrap.appendChild(b));
        nav.appendChild(lockedWrap);

        
        const savedState = localStorage.getItem('nav-locked-open') === 'true';
        lockedWrap.classList.toggle('open', savedState);
        divider.querySelector('svg').style.transform = savedState ? 'rotate(0deg)' : 'rotate(-90deg)';

        divider.querySelector('#nav-locked-toggle').addEventListener('click', () => {
            const isOpen = lockedWrap.classList.toggle('open');
            divider.querySelector('svg').style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            localStorage.setItem('nav-locked-open', isOpen);
        });
    }
}

async function loadUserSignature() {
    if (!window.currentUser) return;

    
    if (_planCache.data && (Date.now() - _planCache.ts) < _planCache.TTL) {
        window.userPlan = _planCache.data;
        applyPlanRestrictions();
        return;
    }

    try {
        const { data, error } = await Promise.race([
            sb.from('signatures')
                .select('*, plans(*)')
                .eq('user_id', window.currentUser.id)
                .maybeSingle(),
            new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), 4000))
        ]);

        if (!error && data?.plans && (!data.expires_at || new Date(data.expires_at) >= new Date())) {
            window.userPlan    = data.plans;
            _planCache.data    = data.plans;
            _planCache.ts      = Date.now();
        } else {
            setFallbackPlan();
        }
    } catch {
        setFallbackPlan();
    }

    applyPlanRestrictions();
}





async function loadUserProfile() {
    if (!window.currentUser || _profileLoaded) return;
    _profileLoaded = true;

    try {
        const { data } = await Promise.race([
            sb.from('user_profiles')
                .select('display_name, role')
                .eq('id', window.currentUser.id)
                .maybeSingle(),
            new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), 4000))
        ]);

        if (data?.display_name) {
            
            window.currentUser.user_metadata = window.currentUser.user_metadata || {};
            window.currentUser.user_metadata.display_name = data.display_name;
        }
        if (data?.role) window.userRole = data.role;

    } catch {  }

    updateSidebarUser();
}





let _booting = false;

async function bootApp(user) {
    if (_booting) return;
    _booting = true;

    window.currentUser = user;
    window.userRole    = user?.app_metadata?.role || null;

    
    await Promise.all([loadUserProfile(), loadUserSignature()]);

    updateSidebarUser();
    applyPlanRestrictions();
    hideInitialLoading();
    showPanel();

    document.dispatchEvent(new CustomEvent('userReady', { detail: user }));

    _booting = false;
}





(async () => {
    
    const { data: { session } } = await sb.auth.getSession();

    if (session?.user) {
        await bootApp(session.user);
    } else {
        hideInitialLoading();
        showAuth();
    }

    
    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            
            if (!window.currentUser || window.currentUser.id !== session.user.id) {
                _profileLoaded = false; 
                _booting       = false;
                window._dashboardRendered = false;
                await bootApp(session.user);
            }
        } else if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            window.userRole    = null;
            window.userPlan    = null;
            _profileLoaded     = false;
            _booting           = false;
            window._dashboardRendered = false;
            _planCache         = { data: null, ts: 0, TTL: 300_000 };
            hideInitialLoading();
            showAuth();
        }
        
    });
})();





let _loginInProgress = false;

async function doLogin() {
    if (_loginInProgress) return;
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showAuthError('Preencha e-mail e senha.'); return; }

    const btn = document.getElementById('login-btn');
    _loginInProgress = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
        showAuthError(error.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos.' : error.message);
        btn.disabled = false;
        btn.textContent = 'Entrar';
    } else {
        hideAuthError();
        document.getElementById('login-password').value = '';
    }
    _loginInProgress = false;
}

async function doGoogleLogin() {
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // O painel é quem conclui o callback e inicializa a sessão.
            // Voltar para a raiz deixava o usuário autenticado fora da aplicação.
            redirectTo: new URL('/painel/', window.location.origin).href
        }
    });

    if (error) showAuthError(error.message);
}

async function doLogout() {
    if (typeof closeProfileModal === 'function') closeProfileModal();
    await sb.auth.signOut();
    
}





function openProfileModal() {
    if (!window.currentUser) return;
    document.getElementById('profile-email-display').textContent = window.currentUser.email;
    document.getElementById('profile-display-name').value = getDisplayName(window.currentUser);
    document.getElementById('profile-modal').classList.add('open');
}

function closeProfileModal() {
    document.getElementById('profile-modal')?.classList.remove('open');
}

async function saveProfileName() {
    const name = document.getElementById('profile-display-name').value.trim();
    if (!name) { showToast('Digite um nome!'); return; }

    const btn = document.getElementById('profile-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    
    await sb.from('user_profiles').upsert({
        id: window.currentUser.id,
        email: window.currentUser.email,
        display_name: name,
        updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    
    const { data, error } = await sb.auth.updateUser({ data: { display_name: name } });

    btn.disabled  = false;
    btn.textContent = 'Salvar';

    if (error) { showToast('Erro ao salvar nome.'); return; }

    window.currentUser = data.user;
    updateSidebarUser();
    closeProfileModal();
    showToast('Nome atualizado!');
}
