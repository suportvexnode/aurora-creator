



const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, window.isSharedLinkView
    ? { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } : undefined);

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
        allowed_tabs: ['roteiros', 'board', 'avatar', 'canal', 'assets'],
        max_projects: 1, max_assets: 0, max_motions: 0
    };
}


function applyPlanRestrictions() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        const allowed = canAccessTab(btn.dataset.tab);
        btn.style.display = allowed ? 'flex' : 'none';
        btn.classList.toggle('nav-locked', !allowed);
    });
}

async function loadDefaultPlan() {
    const { data, error } = await sb.from('plans').select('*').eq('id', 'free').maybeSingle();
    if (error) throw error;
    if (data) window.userPlan = data;
    else setFallbackPlan();
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

        if (error) throw error;
        if (data?.plans && (!data.expires_at || new Date(data.expires_at) >= new Date())) {
            window.userPlan    = data.plans;
            _planCache.data    = data.plans;
            _planCache.ts      = Date.now();
        } else {
            await loadDefaultPlan();
        }
    } catch {
        // Fail closed when the saved permissions cannot be verified.
        window.userPlan = { id: 'unavailable', name: 'Indisponível', allowed_tabs: [] };
    }

    applyPlanRestrictions();
}





async function loadUserProfile() {
    if (!window.currentUser || _profileLoaded) return;
    _profileLoaded = true;
    window.userRole = null;

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
        window.userRole = data?.role || null;

    } catch {  }

    updateSidebarUser();
}





let _booting = false;

async function bootApp(user) {
    if (_booting) return;
    _booting = true;

    window.currentUser = user;
    window.userRole    = null;
    _planCache.data = null;

    
    await Promise.all([loadUserProfile(), loadUserSignature()]);

    updateSidebarUser();
    applyPlanRestrictions();
    hideInitialLoading();
    showPanel();

    document.dispatchEvent(new CustomEvent('userReady', { detail: user }));
    selectAccessibleTab();

    _booting = false;
}





(async () => {
    if (window.isSharedLinkView) {
        if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        await loadSharedLink();
        return;
    }
    
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

    
    const { error: profileError } = await sb.from('user_profiles').update({
        email: window.currentUser.email,
        display_name: name,
        updated_at: new Date().toISOString()
    }).eq('id', window.currentUser.id);
    if (profileError) {
        btn.disabled = false; btn.textContent = 'Salvar';
        showToast('Erro ao salvar perfil: ' + profileError.message);
        return;
    }

    const { data, error } = await sb.auth.updateUser({ data: { display_name: name } });

    btn.disabled  = false;
    btn.textContent = 'Salvar';

    if (error) { showToast('Erro ao salvar nome.'); return; }

    window.currentUser = data.user;
    updateSidebarUser();
    closeProfileModal();
    showToast('Nome atualizado!');
}
