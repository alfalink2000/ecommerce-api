const API = 'http://127.0.0.1:8000/api/v1';

const state = {
    accessToken: localStorage.getItem('accessToken') || null,
    refreshToken: localStorage.getItem('refreshToken') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    currentSection: 'auth',
    logs: [],
};

// ===== TOKEN MANAGEMENT =====
function saveTokens(access, refresh) {
    state.accessToken = access;
    state.refreshToken = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    logToken('ACCESS_TOKEN', 'Guardado en memoria (y localStorage)');
    logToken('REFRESH_TOKEN', 'Guardado en memoria (y localStorage)');
}

function saveUser(user) {
    state.user = user;
    localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
    state.accessToken = null;
    state.refreshToken = null;
    state.user = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    logToken('SESION', 'Tokens eliminados de memoria y localStorage');
}

function decodeJWT(token) {
    try {
        const base64 = token.split('.')[1];
        const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(json);
    } catch { return null; }
}

// ===== API CALL + LOGGING =====
async function api(method, path, body = null, useAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth && state.accessToken) {
        headers['Authorization'] = `Bearer ${state.accessToken}`;
    }

    const url = `${API}${path}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    logHttp(method, url, headers, body, 'ENVIANDO...');

    const res = await fetch(url, opts);
    let resHeaders = {};
    res.headers.forEach((v, k) => resHeaders[k] = v);

    if (res.status === 401 && useAuth && state.refreshToken) {
        logHttp(method, url, headers, body, `401 - Token expirado, intentando refresh...`);
        const refreshed = await tryRefresh();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${state.accessToken}`;
            logHttp(method, url, headers, body, 'Reintentando con nuevo token...');
            const retry = await fetch(url, { method, headers, body: opts.body });
            const retryData = retry.status === 204 ? null : await retry.json();
            logHttp(method, url, headers, body, `${retry.status} OK`, retryData);
            if (!retry.ok) throw { status: retry.status, data: retryData };
            return retryData;
        }
    }

    if (res.status === 204) {
        logHttp(method, url, headers, body, '204 No Content', null);
        return { ok: true };
    }

    const data = await res.json();
    logHttp(method, url, headers, body, `${res.status} ${res.statusText}`, data);

    if (!res.ok) throw { status: res.status, data };
    return data;
}

async function tryRefresh() {
    logToken('REFRESH', 'Enviando refresh_token a POST /auth/refresh');
    try {
        const res = await fetch(`${API}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: state.refreshToken }),
        });
        if (!res.ok) {
            logToken('REFRESH', `Falló (${res.status}) - Sesión expirada`);
            clearSession();
            return false;
        }
        const data = await res.json();
        saveTokens(data.access_token, data.refresh_token);
        logToken('REFRESH', 'Nuevo access_token y refresh_token recibidos');
        return true;
    } catch (e) {
        logToken('REFRESH', `Error de red: ${e.message}`);
        clearSession();
        return false;
    }
}

// ===== CONSOLE LOGGING =====
function logHttp(method, url, headers, body, status, response) {
    const entry = {
        time: new Date().toLocaleTimeString(),
        method,
        url: url.replace(API, '/api/v1'),
        status,
        hasAuth: !!headers['Authorization'],
        body: body ? JSON.stringify(body) : null,
        response: response ? JSON.stringify(response).substring(0, 200) : null,
    };
    state.logs.push(entry);
    if (state.logs.length > 50) state.logs.shift();
    renderLog(entry);
}

function logToken(action, detail) {
    const entry = {
        time: new Date().toLocaleTimeString(),
        method: 'TOKEN',
        url: action,
        status: detail,
        hasAuth: false,
        body: null,
        response: null,
    };
    state.logs.push(entry);
    renderLog(entry);
}

function renderLog(entry) {
    const consoles = document.querySelectorAll('.api-console');
    if (!consoles.length) return;

    let methodColor = '#10b981';
    if (entry.method === 'POST') methodColor = '#3b82f6';
    if (entry.method === 'PUT' || entry.method === 'PATCH') methodColor = '#f59e0b';
    if (entry.method === 'DELETE') methodColor = '#ef4444';

    const html = `
        <span class="log-time">${entry.time}</span>
        <span class="log-method" style="color:${methodColor}">${entry.method}</span>
        <span class="log-url">${entry.url}</span>
        <span class="log-status">${entry.status}</span>
        ${entry.hasAuth ? '<span class="log-badge log-badge-auth">🔑 Bearer</span>' : ''}
        ${entry.body ? `<details class="log-details"><summary>Body</summary><pre>${entry.body}</pre></details>` : ''}
        ${entry.response ? `<details class="log-details"><summary>Response</summary><pre>${entry.response}</pre></details>` : ''}
    `;

    consoles.forEach(console => {
        if (console.querySelector('.console-empty, .log-empty')) {
            console.innerHTML = '';
        }
        const div = document.createElement('div');
        div.className = `log-entry log-${entry.method === 'TOKEN' ? 'token' : 'http'}`;
        div.innerHTML = html;
        console.appendChild(div);
        console.scrollTop = console.scrollHeight;
    });
}

// ===== UI HELPERS =====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showAlert(container, msg, type = 'error') {
    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    container.prepend(el);
    setTimeout(() => el.remove(), 5000);
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('es-ES', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function statusBadge(status) {
    const map = {
        pending: ['Pendiente', 'warning'],
        processing: ['Procesando', 'info'],
        shipped: ['Enviado', 'info'],
        delivered: ['Entregado', 'success'],
        cancelled: ['Cancelado', 'danger'],
    };
    const [label, cls] = map[status] || [status, 'info'];
    return `<span class="badge badge-${cls}">${label}</span>`;
}

// ===== TOKEN STATE DISPLAY =====
function updateTokenDisplay() {
    const el = document.getElementById('token-state');
    if (!el) return;

    if (state.accessToken) {
        const payload = decodeJWT(state.accessToken);
        const exp = payload ? new Date(payload.exp * 1000).toLocaleTimeString() : '?';
        const remaining = payload ? Math.round((payload.exp * 1000 - Date.now()) / 60000) : 0;

        el.innerHTML = `
            <div class="token-state-grid">
                <div class="token-state-item">
                    <span class="token-state-label">Access Token</span>
                    <span class="token-state-value ${remaining < 5 ? 'token-expiring' : ''}">
                        ${remaining > 0 ? `Expira en ${remaining}min` : 'Expirado'}
                    </span>
                </div>
                <div class="token-state-item">
                    <span class="token-state-label">Expira a las</span>
                    <span class="token-state-value">${exp}</span>
                </div>
                <div class="token-state-item">
                    <span class="token-state-label">Refresh Token</span>
                    <span class="token-state-value">${state.refreshToken ? '✅ Activo' : '❌ No hay'}</span>
                </div>
            </div>
            <div class="token-box">
                <div class="token-label">ACCESS TOKEN (JWT)</div>
                <button class="copy-btn" onclick="navigator.clipboard.writeText('${state.accessToken}')">Copiar</button>
                ${state.accessToken.substring(0, 50)}...
            </div>
        `;
    } else {
        el.innerHTML = `
            <div class="alert alert-info" style="margin:0">
                No hay sesion activa. Inicia sesion para obtener tokens.
            </div>
        `;
    }
}

// ===== NAVIGATION =====
function showSection(name) {
    state.currentSection = name;
    $$('.section').forEach(s => s.classList.remove('active'));
    $$('.nav-item').forEach(n => n.classList.remove('active'));

    const section = $(`#section-${name}`);
    const nav = $(`[data-nav="${name}"]`);
    if (section) section.classList.add('active');
    if (nav) nav.classList.add('active');

    if (name === 'products') loadProducts();
    if (name === 'orders') loadOrders();
    if (name === 'users') loadUsers();
    updateRoleBanner();
}

function updateSidebarUser() {
    const footer = $('.sidebar-footer');
    if (state.user) {
        const initials = state.user.full_name.split(' ').map(w => w[0]).join('').toUpperCase();
        const roleClass = state.user.role === 'admin' ? 'role-admin' : 'role-customer';
        footer.innerHTML = `
            <div class="user-badge">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <div class="user-name">${state.user.full_name}</div>
                    <span class="user-role ${roleClass}">${state.user.role}</span>
                </div>
            </div>
        `;
    } else {
        footer.innerHTML = `
            <div class="user-badge">
                <div class="user-avatar">?</div>
                <div class="user-info">
                    <div class="user-name">Sin sesion</div>
                    <span class="user-role role-none">no autenticado</span>
                </div>
            </div>
        `;
    }
}

function updateNavVisibility() {
    const isAdmin = state.user && state.user.role === 'admin';
    $$('.nav-admin').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
    if (!isAdmin && state.currentSection === 'users') showSection('auth');
}

function updateRoleBanner() {
    const banner = $('#role-banner');
    if (!banner) return;

    if (!state.user) {
        banner.innerHTML = '';
        return;
    }

    const isAdmin = state.user.role === 'admin';
    if (isAdmin) {
        banner.innerHTML = `
            <div class="alert alert-success" style="margin-bottom:20px">
                <strong>👑 Tienes rol ADMIN.</strong> Puedes crear/editar/eliminar productos, gestionar usuarios y ver todas las ordenes.
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="alert alert-info" style="margin-bottom:20px">
                <strong>🛒 Eres CUSTOMER.</strong> Puedes ver productos, crear ordenes y ver tus propias ordenes.
                Solo los administradores pueden crear productos o gestionar usuarios.
            </div>
        `;
    }
}

// ===== AUTH =====
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const alertBox = form.querySelector('.alert-box');
    alertBox.innerHTML = '';

    logToken('LOGIN', `POST /auth/login con email="${form.email.value}"`);

    try {
        const data = await api('POST', '/auth/login', {
            email: form.email.value,
            password: form.password.value,
        }, false);

        saveTokens(data.access_token, data.refresh_token);

        const payload = decodeJWT(data.access_token);
        logToken('LOGIN', `Token decodificado: sub=${payload.sub}, type=${payload.type}, exp=${new Date(payload.exp * 1000).toLocaleTimeString()}`);

        const user = { id: parseInt(payload.sub), role: 'customer' };
        try {
            const users = await api('GET', '/users/');
            const me = users.items.find(u => u.id === user.id);
            if (me) {
                user.full_name = me.full_name;
                user.email = me.email;
                user.role = me.role;
            }
        } catch {
            user.full_name = form.email.value.split('@')[0];
            user.email = form.email.value;
        }

        saveUser(user);
        updateSidebarUser();
        updateNavVisibility();
        updateTokenDisplay();
        updateRoleBanner();
        showSection('products');
        form.reset();

        showAlert(alertBox, `Sesion iniciada como ${user.email} (rol: ${user.role})`, 'success');
    } catch (err) {
        showAlert(alertBox, err.data?.detail || 'Error al iniciar sesion');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const alertBox = form.querySelector('.alert-box');
    alertBox.innerHTML = '';

    logToken('REGISTER', `POST /auth/register con email="${form.email.value}"`);

    try {
        await api('POST', '/auth/register', {
            email: form.email.value,
            password: form.password.value,
            full_name: form.full_name.value,
        }, false);

        showAlert(alertBox, 'Usuario registrado. Ahora inicia sesion con esas credenciales.', 'success');
        form.reset();
    } catch (err) {
        showAlert(alertBox, err.data?.detail || 'Error al registrar');
    }
}

async function handleLogout() {
    if (!state.accessToken) {
        clearSession();
        updateSidebarUser();
        updateNavVisibility();
        updateTokenDisplay();
        showSection('auth');
        return;
    }
    logToken('LOGOUT', `POST /auth/logout con access_token y refresh_token`);
    try {
        await api('POST', `/auth/logout?access_token=${encodeURIComponent(state.accessToken)}&refresh_token=${encodeURIComponent(state.refreshToken)}`, null, false);
        logToken('LOGOUT', 'Tokens eliminados de Redis (invalidados)');
    } catch (e) {
        logToken('LOGOUT', 'Error al invalidar en Redis, pero limpiando localmente');
    }
    clearSession();
    updateSidebarUser();
    updateNavVisibility();
    updateTokenDisplay();
    updateRoleBanner();
    showSection('auth');
}

async function handleRefreshToken() {
    if (!state.refreshToken) {
        showAlert($('#section-auth .alert-box'), 'No hay refresh token para renovar');
        return;
    }
    logToken('REFRESH', 'Boton pulsado - enviando refresh_token...');
    const ok = await tryRefresh();
    if (ok) {
        const payload = decodeJWT(state.accessToken);
        try {
            const users = await api('GET', '/users/');
            const me = users.items.find(u => u.id === parseInt(payload.sub));
            if (me) saveUser({ id: me.id, full_name: me.full_name, email: me.email, role: me.role });
        } catch {}
        updateSidebarUser();
        updateNavVisibility();
        updateTokenDisplay();
    }
}

// ===== PRODUCTS =====
let productsPage = 1;

async function loadProducts(page = 1) {
    productsPage = page;
    const container = $('#products-list');
    try {
        const data = await api('GET', `/products/?page=${page}&page_size=10`, null, false);
        if (data.items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>No hay productos aun</p></div>';
            return;
        }
        let html = `<div class="table-wrapper"><table>
            <thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Categoria</th>${state.user?.role === 'admin' ? '<th>Acciones</th>' : ''}</tr></thead>
            <tbody>`;
        for (const p of data.items) {
            html += `<tr>
                <td><strong>#${p.id}</strong></td>
                <td><strong>${p.name}</strong><br><small style="color:var(--text-muted)">${p.description || ''}</small></td>
                <td>$${parseFloat(p.price).toFixed(2)}</td>
                <td>${p.stock > 0 ? `<span class="badge badge-success">${p.stock}</span>` : '<span class="badge badge-danger">Agotado</span>'}</td>
                <td>${p.category || '-'}</td>
                ${state.user?.role === 'admin' ? `<td><button class="btn btn-sm btn-outline" onclick="editProduct(${p.id})">Editar</button> <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Eliminar</button></td>` : ''}
            </tr>`;
        }
        html += '</tbody></table></div>';
        html += renderPagination(data.page, data.pages, 'loadProducts');
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-error">${err.data?.detail || 'Error al cargar productos'}</div>`;
    }
}

async function handleCreateProduct(e) {
    e.preventDefault();
    const form = e.target;
    const alertBox = $('#create-product-alert');
    alertBox.innerHTML = '';

    logToken('CREATE_PRODUCT', 'POST /products/ - Requiere rol admin en el token JWT');

    try {
        await api('POST', '/products/', {
            name: form.name.value,
            description: form.description.value,
            price: parseFloat(form.price.value),
            stock: parseInt(form.stock.value),
            category: form.category.value || undefined,
        });
        showAlert(alertBox, 'Producto creado exitosamente', 'success');
        logToken('201', 'Producto creado correctamente por admin');
        form.reset();
        loadProducts();
    } catch (err) {
        if (err.status === 403) {
            showAlert(alertBox, '403 - No tienes permisos de admin. Tu token JWT tiene rol "customer". Solicita a un admin que te promueva.', 'error');
            logToken('403', 'require_admin() rechazo la peticion: el rol en el token no es "admin"');
        } else if (err.status === 401) {
            showAlert(alertBox, '401 - Token no valido. Inicia sesion de nuevo.', 'error');
            logToken('401', 'get_current_user() rechazo la peticion: token no existe o expiro');
        } else {
            showAlert(alertBox, err.data?.detail || 'Error al crear producto');
        }
    }
}

async function deleteProduct(id) {
    if (!confirm('Eliminar este producto?')) return;
    try {
        await api('DELETE', `/products/${id}`);
        loadProducts();
    } catch (err) {
        alert(err.data?.detail || 'Error al eliminar');
    }
}

function editProduct(id) {
    const newName = prompt('Nuevo nombre:');
    if (!newName) return;
    const newPrice = prompt('Nuevo precio:');
    if (!newPrice) return;
    const newStock = prompt('Nuevo stock:');
    if (newStock === null) return;
    api('PUT', `/products/${id}`, {
        name: newName,
        price: parseFloat(newPrice),
        stock: parseInt(newStock),
    }).then(() => loadProducts()).catch(err => alert(err.data?.detail || 'Error'));
}

// ===== ORDERS =====
let ordersPage = 1;

async function loadOrders(page = 1) {
    ordersPage = page;
    const container = $('#orders-list');
    try {
        const data = await api('GET', `/orders/?page=${page}&page_size=10`);
        if (data.items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">🛒</div><p>No hay ordenes aun</p></div>';
            return;
        }
        let html = `<div class="table-wrapper"><table>
            <thead><tr><th>#</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Items</th><th>Acciones</th></tr></thead>
            <tbody>`;
        for (const o of data.items) {
            html += `<tr>
                <td>${o.id}</td>
                <td>${formatDate(o.created_at)}</td>
                <td><strong>$${parseFloat(o.total_amount).toFixed(2)}</strong></td>
                <td>${statusBadge(o.status)}</td>
                <td>${o.items.length} producto(s)</td>
                <td>
                    ${o.status === 'pending' ? `<button class="btn btn-sm btn-outline" onclick="cancelOrder(${o.id})">Cancelar</button>` : ''}
                </td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        html += renderPagination(data.page, data.pages, 'loadOrders');
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-error">${err.data?.detail || 'Error al cargar ordenes'}</div>`;
    }
}

async function handleCreateOrder(e) {
    e.preventDefault();
    const form = e.target;
    const alertBox = $('#create-order-alert');
    alertBox.innerHTML = '';

    logToken('CREATE_ORDER', 'POST /orders/ - Requiere token JWT valido');

    try {
        const data = await api('POST', '/orders/', {
            items: [{ product_id: parseInt(form.product_id.value), quantity: parseInt(form.quantity.value) }],
        });
        showAlert(alertBox, `Orden #${data.id} creada - Total: $${parseFloat(data.total_amount).toFixed(2)}`, 'success');
        form.reset();
        loadOrders();
    } catch (err) {
        if (err.status === 401) {
            showAlert(alertBox, '401 - Token no valido o expirado. El middleware de auth te bloqueo.');
            logToken('401', 'Middleware de auth rechazo: token no existe en Redis o expiro');
        } else if (err.status === 400) {
            showAlert(alertBox, `400 - ${err.data?.detail || 'Error en la solicitud'}. Verifica que el producto exista y tenga stock suficiente.`);
        } else if (err.status === 404) {
            showAlert(alertBox, `404 - ${err.data?.detail || 'Producto no encontrado'}. Usa un ID de producto valido de la lista.`);
        } else {
            showAlert(alertBox, err.data?.detail || 'Error al crear orden');
        }
    }
}

async function cancelOrder(id) {
    if (!confirm('Cancelar esta orden?')) return;
    try {
        await api('POST', `/orders/${id}/cancel`);
        loadOrders();
    } catch (err) {
        alert(err.data?.detail || 'Error al cancelar');
    }
}

// ===== USERS (admin) =====
let usersPage = 1;

async function loadUsers(page = 1) {
    usersPage = page;
    const container = $('#users-list');
    try {
        const data = await api('GET', `/users/?page=${page}&page_size=10`);
        let html = `<div class="table-wrapper"><table>
            <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>`;
        for (const u of data.items) {
            const roleBadge = u.role === 'admin' ? '<span class="badge badge-danger">admin</span>' : '<span class="badge badge-info">customer</span>';
            const activeBadge = u.is_active ? '<span class="badge badge-success">activo</span>' : '<span class="badge badge-warning">inactivo</span>';
            html += `<tr>
                <td>${u.id}</td>
                <td>${u.full_name}</td>
                <td>${u.email}</td>
                <td>${roleBadge}</td>
                <td>${activeBadge}</td>
                <td>
                    ${u.id !== state.user?.id ? `
                        <button class="btn btn-sm btn-outline" onclick="toggleRole(${u.id}, '${u.role}')">Cambiar Rol</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Eliminar</button>
                    ` : '<small style="color:var(--text-muted)">tu cuenta</small>'}
                </td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        html += renderPagination(data.page, data.pages, 'loadUsers');
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="alert alert-error">${err.data?.detail || 'Error al cargar usuarios'}</div>`;
    }
}

async function toggleRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin';
    try {
        await api('PUT', `/users/${id}/role`, { role: newRole });
        loadUsers();
    } catch (err) {
        alert(err.data?.detail || 'Error al cambiar rol');
    }
}

async function deleteUser(id) {
    if (!confirm('Eliminar este usuario?')) return;
    try {
        await api('DELETE', `/users/${id}`);
        loadUsers();
    } catch (err) {
        alert(err.data?.detail || 'Error al eliminar');
    }
}

// ===== PAGINATION =====
function renderPagination(current, total, fnName) {
    if (total <= 1) return '';
    let html = '<div class="pagination">';
    if (current > 1) html += `<button onclick="${fnName}(${current - 1})">Anterior</button>`;
    html += `<span>Pagina ${current} de ${total}</span>`;
    if (current < total) html += `<button onclick="${fnName}(${current + 1})">Siguiente</button>`;
    html += '</div>';
    return html;
}

// ===== CLEAR CONSOLE =====
function clearConsole() {
    state.logs = [];
    document.querySelectorAll('.api-console').forEach(console => {
        console.innerHTML = '<div class="log-empty">Consola limpiada. Las acciones posteriores se registraran aqui.</div>';
    });
}

// ===== PROBE BUTTONS =====
function probe(action) {
    const actions = {
        products_get: () => {
            logToken('PROBE', 'GET /products/ es PUBLICO - no envia Authorization header (sin Bearer)');
            loadProducts();
        },
        products_post: () => {
            showSection('products');
            if (!state.user || state.user.role !== 'admin') {
                logToken('BLOQUEADO', 'POST /products/ requiere rol admin. require_admin() lo rechazaria si envias esta peticion ahora.');
            }
            const card = $('#admin-product-form');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (card.style.display !== 'none') card.querySelector('input[name="name"]').focus();
        },
        products_put: async () => {
            const id = prompt('ID del producto a editar:');
            if (!id) return;
            const name = prompt('Nuevo nombre:');
            if (!name) return;
            const price = prompt('Nuevo precio:');
            if (!price) return;
            const stock = prompt('Nuevo stock:');
            if (stock === null) return;
            try {
                await api('PUT', `/products/${id}`, { name, price: parseFloat(price), stock: parseInt(stock) });
                loadProducts();
            } catch (err) { alert(err.data?.detail || 'Error al actualizar'); }
        },
        products_delete: async () => {
            const id = prompt('ID del producto a eliminar:');
            if (!id) return;
            try {
                await api('DELETE', `/products/${id}`);
                loadProducts();
            } catch (err) { alert(err.data?.detail || 'Error al eliminar'); }
        },

        orders_post: () => {
            showSection('orders');
            $('#create-order-form').product_id.focus();
        },
        orders_get: () => {
            logToken('PROBE', 'GET /orders/ filtra por user_id extraido del token JWT (solo tus ordenes)');
            loadOrders();
        },
        orders_cancel: async () => {
            const id = prompt('ID de tu orden a cancelar:');
            if (!id) return;
            try {
                await api('POST', `/orders/${id}/cancel`);
                loadOrders();
            } catch (err) { alert(err.data?.detail || 'Error al cancelar'); }
        },
        orders_status: async () => {
            const id = prompt('ID de la orden:');
            if (!id) return;
            const status = prompt('Nuevo estado (pending, paid, shipped, delivered, cancelled):');
            if (!status) return;
            try {
                await api('PUT', `/orders/${id}/status`, { status });
                loadOrders();
            } catch (err) { alert(err.data?.detail || 'Error al cambiar estado'); }
        },

        users_get: () => {
            logToken('PROBE', 'GET /users/ solo lo puede ejecutar el rol admin');
            loadUsers();
        },
        users_role: async () => {
            const id = prompt('ID del usuario:');
            if (!id) return;
            const role = prompt('Nuevo rol (admin o customer):');
            if (!role) return;
            try {
                await api('PUT', `/users/${id}/role`, { role });
                loadUsers();
            } catch (err) { alert(err.data?.detail || 'Error al cambiar rol'); }
        },
        users_delete: async () => {
            const id = prompt('ID del usuario a eliminar:');
            if (!id) return;
            if (!confirm(`Eliminar el usuario ${id}? (no puedes eliminarte a ti mismo)`)) return;
            try {
                await api('DELETE', `/users/${id}`);
                loadUsers();
            } catch (err) { alert(err.data?.detail || 'Error al eliminar'); }
        },
    };
    const fn = actions[action];
    if (fn) fn();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    updateSidebarUser();
    updateNavVisibility();
    updateTokenDisplay();
    updateRoleBanner();

    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => showSection(item.dataset.nav));
    });

    $('#login-form').addEventListener('submit', handleLogin);
    $('#register-form').addEventListener('submit', handleRegister);
    $('#logout-btn').addEventListener('click', handleLogout);
    $('#refresh-btn').addEventListener('click', handleRefreshToken);
    $('#clear-console').addEventListener('click', clearConsole);

    $$('.probe-btn').forEach(btn => {
        btn.addEventListener('click', () => probe(btn.dataset.probe));
    });

    const createProductForm = $('#create-product-form');
    if (createProductForm) createProductForm.addEventListener('submit', handleCreateProduct);

    const createOrderForm = $('#create-order-form');
    if (createOrderForm) createOrderForm.addEventListener('submit', handleCreateOrder);

    if (state.user && state.accessToken) {
        showSection('products');
    } else {
        showSection('auth');
    }

    setInterval(updateTokenDisplay, 30000);
});
