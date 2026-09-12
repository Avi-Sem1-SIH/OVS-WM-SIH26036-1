const state = {
    role: 'User',
    page: 'dashboard',
    user: { name: 'Rahul Das', email: 'rahul@example.com' },
    settings: {
        maintenance: false,
        emailNotifications: true,
        autoAssignment: true
    }
};

let applications = [
    {
        id: 'OVS/2026/00021',
        applicant: 'Rahul Das',
        instrument: 'Digital Weighing Scale',
        officer: 'Amit Sharma',
        status: 'Verified',
        date: '28 Aug 2026',
        location: 'Kolkata'
    },
    {
        id: 'OVS/2026/00022',
        applicant: 'Metro Stores',
        instrument: 'Platform Scale',
        officer: 'Amit Sharma',
        status: 'Inspection Required',
        date: '29 Aug 2026',
        location: 'Kolkata'
    },
    {
        id: 'OVS/2026/00024',
        applicant: 'Green Foods',
        instrument: 'Electronic Balance',
        officer: 'Unassigned',
        status: 'Pending',
        date: '30 Aug 2026',
        location: 'Howrah'
    }
];

let instruments = [
    {
        id: 'INS-001',
        owner: 'Rahul Das',
        name: 'Digital Weighing Scale',
        category: 'Weighing Instrument',
        location: 'Kolkata',
        status: 'Verified',
        validUntil: '19 Aug 2027'
    },
    {
        id: 'INS-002',
        owner: 'Rahul Das',
        name: 'Platform Scale',
        category: 'Weighing Instrument',
        location: 'Howrah',
        status: 'Pending',
        validUntil: 'Inspection required'
    },
    {
        id: 'INS-003',
        owner: 'Rahul Das',
        name: 'Electronic Balance',
        category: 'Measuring Instrument',
        location: 'Kolkata',
        status: 'Verified',
        validUntil: '11 Jul 2027'
    }
];

let certificates = [
    {
        id: 'W&M/26-27/00045',
        applicationId: 'OVS/2026/00021',
        applicant: 'Rahul Das',
        instrument: 'Digital Weighing Scale',
        issuedOn: '19 Aug 2026',
        validUntil: '19 Aug 2027',
        issuedBy: 'Amit Sharma',
        status: 'Active'
    }
];

let users = [
    { name: 'Rahul Das', email: 'rahul@example.com', role: 'User', status: 'Active' },
    { name: 'Amit Sharma', email: 'amit@ovs-wm.com', role: 'Officer', status: 'Active' },
    { name: 'Kolkata GATC', email: 'gatc@ovs-wm.com', role: 'GATC', status: 'Active' },
    { name: 'Mumbai GATC', email: 'mumbai.gatc@ovs-wm.com', role: 'GATC', status: 'Active' },
    { name: 'Delhi GATC', email: 'delhi.gatc@ovs-wm.com', role: 'GATC', status: 'Active' },
    { name: 'Bengaluru GATC', email: 'bengaluru.gatc@ovs-wm.com', role: 'GATC', status: 'Active' }
];

let officers = [
    { name: 'Amit Sharma', email: 'amit@ovs-wm.com', assigned: 12, status: 'Active' },
    { name: 'Neha Roy', email: 'neha@ovs-wm.com', assigned: 8, status: 'Active' },
    { name: 'Rakesh Kumar', email: 'rakesh@ovs-wm.com', assigned: 0, status: 'On Leave' },
    { name: 'Kolkata GATC', email: 'gatc@ovs-wm.com', assigned: 0, status: 'Active' },
    { name: 'Mumbai GATC', email: 'mumbai.gatc@ovs-wm.com', assigned: 0, status: 'Active' },
    { name: 'Delhi GATC', email: 'delhi.gatc@ovs-wm.com', assigned: 0, status: 'Active' },
    { name: 'Bengaluru GATC', email: 'bengaluru.gatc@ovs-wm.com', assigned: 0, status: 'Active' }
];

let officerRequests = [];
let enforcementCases = [];

const $ = selector => document.querySelector(selector);

window.getNotificationContext = () => ({ applications, state });

async function apiRequest(path, options = {}) {
    let response;
    try {
        response = await fetch(path, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
    } catch {
        throw new Error('Unable to reach the server. Open this app through the Node server with `npm start`, then try again.');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Request failed');
    return payload;
}

function applyServerData(data) {
    applications = data.applications || [];
    instruments = data.instruments || [];
    certificates = data.certificates || [];
    users = data.users || [];
    officers = data.officers || [];
    officerRequests = data.officerRequests || [];
    enforcementCases = data.enforcementCases || [];
    Object.assign(state.settings, data.settings || {});
}

function finishLogin(result) {
    applyServerData(result.data);
    state.role = result.user.role;
    state.user = result.user;
    $('#loginError').hidden = true;
    $('#loginPage').style.display = 'none';
    $('#app').style.display = 'block';
    go('dashboard');
    flushPendingState();
}

let persistTimer;
const pendingStateKey = () => `ovsPendingState:${state.user?.email || 'anonymous'}`;

function currentStatePayload() {
    const payload = { applications, certificates };
    if (state.role === 'User' || state.role === 'Admin') payload.instruments = instruments;
    if (state.role === 'Admin') {
        payload.users = users;
        payload.officers = officers;
        payload.enforcementCases = enforcementCases;
        payload.settings = state.settings;
    }
    return payload;
}

async function flushPendingState() {
    const queued = localStorage.getItem(pendingStateKey());
    if (!queued || !state.user?.email) return;
    try {
        const payload = JSON.parse(queued);
            const result = await apiRequest('/api/state', { method: 'PUT', body: JSON.stringify(payload) });
            applyServerData(result.data);
        localStorage.removeItem(pendingStateKey());
        toast('Offline changes synchronized');
    } catch {
        // Keep the queued state for the next online event.
    }
}

function persistState() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
        try {
            const payload = currentStatePayload();
            const result = await apiRequest('/api/state', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            applyServerData(result.data);
        } catch (error) {
            localStorage.setItem(pendingStateKey(), JSON.stringify(currentStatePayload()));
            toast(`Changes queued offline: ${error.message}`);
        }
    }, 150);
}

function escapeHtml(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function jsArg(value) {
    return escapeHtml(JSON.stringify(String(value)));
}

function today() {
    return new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function dateAfterMonths(months) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function certificateLifecycle(certificate) {
    const expiry = new Date(certificate.validUntil);
    if (Number.isNaN(expiry.getTime())) return { label: certificate.status || 'Unknown', days: null };
    const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    if (certificate.status !== 'Active') return { label: certificate.status, days };
    if (days < 0) return { label: 'Expired', days };
    if (days <= 30) return { label: 'Expiring Soon', days };
    return { label: 'Active', days };
}

function instrumentValidity(instrument) {
    const expiry = new Date(instrument.validUntil);
    if (Number.isNaN(expiry.getTime())) {
        return { label: instrument.status === 'Pending' ? 'Awaiting verification' : instrument.status, days: null };
    }

    const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: 'Expired', days };
    if (days <= 30) return { label: 'Expiring Soon', days };
    return { label: instrument.status === 'Verified' ? 'Valid' : instrument.status, days };
}

window.getNotificationContext = () => ({ applications, certificates, state });

function recordId(prefix) {
    const suffix = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12)
        || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return `${prefix}${suffix.toUpperCase()}`;
}

function badge(value) {
    const text = String(value);
    const lower = text.toLowerCase();
    let className = 'info';

    if (lower.includes('verified') || lower.includes('active') ||
        lower.includes('ready') || lower.includes('operational')) {
        className = 'verified';
    } else if (lower.includes('reject') || lower.includes('suspend') || lower.includes('ban')) {
        className = 'rejected';
    } else if (lower.includes('pending') || lower.includes('leave') ||
        lower.includes('inspection') || lower.includes('assigned') ||
        lower.includes('scheduled') || lower.includes('required') ||
        lower.includes('field') || lower.includes('under')) {
        className = 'pending';
    }

    return `<span class="status ${className}">${escapeHtml(text)}</span>`;
}

function officerSuccessRate(officerName) {
    const completed = applications.filter(application =>
        (application.officer === officerName || application.assignedLMO === officerName || application.assignedGATC === officerName) &&
        ['Verified', 'Verification Rejected', 'Completed', 'Certificate Generated'].includes(application.status)
    );
    const successful = completed.filter(application => application.status === 'Verified').length;
    const percentage = completed.length ? Math.round((successful / completed.length) * 100) : 0;

    return {
        percentage,
        detail: `${successful} successful of ${completed.length} completed`
    };
}

function toast(message) {
    document.querySelector('.toast')?.remove();

    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    document.body.appendChild(node);

    setTimeout(() => node.remove(), 2800);
}

function closeModal() {
    document.querySelector('.modalbg')?.remove();
}

function showModal(title, content, buttons = '') {
    closeModal();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modalbg" onclick="if(event.target === this)closeModal()">
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
                <button class="close" aria-label="Close dialog" onclick="closeModal()">×</button>
                <h2 id="modalTitle">${title}</h2>
                ${content}
                ${buttons}
            </div>
        </div>
    `);
    const modal = document.querySelector('.modalbg .modal');
    modal?.focus();
    modal?.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeModal();
    });
}

const menus = {
    User: [
        ['dashboard', '▣', 'Owner Dashboard'],
        ['applications', '▤', 'Verification Applications'],
        ['instruments', '⚖', 'Registered Instruments'],
        ['certificates', '▧', 'Digital Certificates'],
        ['profile', '◉', 'Profile']
    ],
    Officer: [
        ['dashboard', '▣', 'Dashboard'],
        ['applications', '▤', 'Assigned Cases'],
        ['inspections', '⚖', 'Market Inspections'],
        ['certificates', '▧', 'Certificates'],
        ['reports', '▤', 'Reports'],
        ['profile', '◉', 'Profile']
    ],
    GATC: [
        ['dashboard', '▣', 'Dashboard'],
        ['applications', '▤', 'Assigned Applications'],
        ['inspections', '⚖', 'Centre Testing'],
        ['certificates', '▧', 'Certificates'],
        ['reports', '▤', 'Reports'],
        ['profile', '◉', 'Profile']
    ],
    Admin: [
        ['dashboard', '▣', 'Dashboard'],
        ['applications', '▤', 'Applications & Assignments'],
        ['officers', '⚖', 'Manage Officers'],
        ['enforcement', '⚠', 'Complaints & Decisions'],
        ['settings', '⚙', 'System Settings'],
        ['profile', '◉', 'Profile']
    ]
};

function shell(title, content) {
    $('#app').innerHTML = `
        <aside class="sidebar" id="side">
            <div class="brand">
                <div class="brandmark">⚖</div>
                <div>
                    <b>OVS-WM</b>
                    <small>${state.role === 'Officer' ? 'STATE LMO' : state.role.toUpperCase()} PORTAL</small>
                </div>
            </div>

            <div class="nav">
                ${menus[state.role].map(([page, icon, label]) => `
                    <button class="${state.page === page ? 'active' : ''}"
                            onclick="go('${page}')">
                        ${icon} &nbsp; ${label}
                    </button>
                `).join('')}

                <div class="section">Account</div>
                <button onclick="go('profile')">◉ &nbsp; Profile</button>
                <button onclick="logout()">↪ &nbsp; Logout</button>
            </div>
        </aside>

        <main class="main">
            <header class="topbar">
                <div style="display:flex;align-items:center;gap:12px">
                    <button class="mobilemenu"
                            onclick="$('#side').classList.toggle('open')">☰</button>
                    <h2>${escapeHtml(title)}</h2>
                </div>

                <div class="topright">
                    <button class="profile-topbar" type="button" onclick="go('profile')">
                        ◉ <span>Profile</span>
                    </button>
                    <button class="bell" onclick="showNotifications()">
                        🔔 <i class="badge">${applications.length}</i>
                    </button>
                    <span class="usertext" style="font-size:12px;text-align:right">
                        <b>${escapeHtml(state.user.name)}</b><br>
                        <span class="muted">${state.role === 'Officer' ? 'State LMO' : state.role}</span>
                    </span>
                    <div class="avatar">
                        ${state.user.name.split(' ').map(word => word[0]).join('')}
                    </div>
                </div>
            </header>

            <section class="content">${content}</section>
        </main>
    `;
}

function go(page) {
    state.page = page;

    const pages = {
        User: {
            dashboard: userDashboard,
            applications: userApplications,
            instruments: userInstruments,
            certificates: userCertificates,
            profile: profilePage
        },
        Officer: {
            dashboard: officerDashboard,
            applications: officerApplications,
            inspections: officerInspections,
            certificates: officerCertificates,
            reports: officerReports,
            profile: profilePage
        },
        GATC: {
            dashboard: officerDashboard,
            applications: officerApplications,
            inspections: officerInspections,
            certificates: officerCertificates,
            reports: officerReports,
            profile: profilePage
        },
        Admin: {
            dashboard: adminDashboard,
            users: adminUsers,
            officers: adminOfficers,
            applications: adminApplications,
            enforcement: adminEnforcement,
            certificates: adminCertificates,
            settings: adminSettings,
            profile: profilePage
        }
    };

    (pages[state.role][page] || pages[state.role].dashboard)();
}

function card(label, value, detail) {
    return `
        <div class="card">
            <span class="muted">${escapeHtml(label)}</span>
            <h2 style="margin:10px 0;color:var(--navy)">${escapeHtml(value)}</h2>
            <span class="muted">${escapeHtml(detail)}</span>
        </div>
    `;
}

function table(headers, rows) {
    return `
        <div class="card">
            <div class="tablewrap">
                <table class="table">
                    <thead>
                        <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows || `
                            <tr>
                                <td colspan="${headers.length}" class="muted">
                                    No records found.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function profilePage() {
    const ownApplications = applications.filter(item => item.applicant === state.user.name);
    const ownCertificates = certificates.filter(item => item.applicant === state.user.name);
    const verifierAssignments = applications.filter(item => item.officer === state.user.name);
    const activityCount = ['Officer', 'GATC'].includes(state.role) ? verifierAssignments.length : ownApplications.length;

    shell('Profile', `
        <div class="pagehead">
            <div>
                <h1>Profile</h1>
                <span class="muted">Manage your account and review your activity.</span>
            </div>
            <button class="btn primary" onclick="editProfile()">Edit Profile</button>
        </div>
        <div class="profile-layout">
            <section class="card profile-summary">
                <div class="profile-avatar">${escapeHtml(state.user.name.split(' ').map(word => word[0]).join(''))}</div>
                <h2>${escapeHtml(state.user.name)}</h2>
                <p class="muted">${escapeHtml(state.user.email)}</p>
                <span class="status info">${escapeHtml(state.role === 'Officer' ? 'State LMO' : state.role)}</span>
            </section>
            <section class="card">
                <h3>Account Overview</h3>
                <div class="profile-facts">
                    <div><span class="muted">Account type</span><strong>${escapeHtml(state.role)}</strong></div>
                    <div><span class="muted">Applications</span><strong>${activityCount}</strong></div>
                    <div><span class="muted">Certificates</span><strong>${ownCertificates.length}</strong></div>
                    <div><span class="muted">Access status</span><strong>Active</strong></div>
                </div>
            </section>
        </div>
    `);
}

function filterRows(input) {
    const term = input.value.trim().toLowerCase();
    input.closest('.content')?.querySelectorAll('.table tbody tr').forEach(row => {
        row.hidden = Boolean(term) && !row.textContent.toLowerCase().includes(term);
    });
}

function searchField(label = 'Search records') {
    return `<div class="field search-field"><label for="recordSearch">${label}</label><input id="recordSearch" type="search" placeholder="Search by ID, applicant, instrument, or status" oninput="filterRows(this)"></div>`;
}

/* User pages */

function userDashboard() {
    const ownApplications = applications.filter(x => x.applicant === state.user.name);
    const ownCertificates = certificates.filter(x => x.applicant === state.user.name);
    const ownInstruments = instruments.filter(x => x.owner === state.user.name);
    const renewalAlerts = ownInstruments.filter(x => ['Expired', 'Expiring Soon', 'Awaiting verification'].includes(instrumentValidity(x).label));
    const gatcActions = ownApplications.filter(x => x.status === 'GATC Assigned' || x.status === 'GATC Verification Required');

    shell('Instrument Owner Dashboard', `
        <div class="welcome">
            <div>
                <span class="eyebrow dark">INSTRUMENT OWNER / BUSINESS USER</span>
                <h1>Good morning, ${escapeHtml(state.user.name)} 👋</h1>
                <span class="muted">Keep your regulated instruments registered, verified, and ready for trade.</span>
            </div>
            <button class="btn primary" onclick="newApplication()">＋ Start Verification</button>
        </div>

        <div class="cards">
                ${card('Registered Instruments', ownInstruments.length, 'Your instrument register')}
                ${card('Verification Applications', ownApplications.length, 'Submitted requests')}
            ${card('Verified', ownApplications.filter(x => x.status === 'Verified').length, 'Successfully verified')}
                ${card('Certificates', ownCertificates.length, 'Digital certificates')}
                ${card('Renewal Alerts', renewalAlerts.length, 'Due for re-verification')}
        </div>

        <div class="grid2">
            <div class="card">
                <h3>Owner actions</h3>
                <div style="display:grid;gap:10px">
                    <button class="btn primary" onclick="newApplication()">＋ Apply for Verification</button>
                    <button class="btn secondary" onclick="addInstrument()">⚖ Register Instrument</button>
                    <button class="btn secondary" onclick="go('applications')">▤ Track Requests</button>
                    <button class="btn secondary" onclick="go('certificates')">▧ Open Certificates</button>
                </div>
            </div>
            <div class="card">
                <h3>Compliance watch</h3>
                <p class="notice">Keep instrument details and supporting documents current. Start re-verification before a certificate expires to avoid disruption to regulated trade.</p>
            </div>
        </div>
        ${gatcActions.map(item => `<div class="notice" style="margin-top:18px"><b>${item.applicationType === 'RE_VERIFICATION' ? 'LMO Field Verification Completed — GATC Verification Required' : 'GATC Verification Required'}</b><p>Application ${escapeHtml(item.id)} for ${escapeHtml(item.instrument)} must be taken to the assigned Government Approved Test Centre.</p><p><b>Assigned GATC:</b> ${escapeHtml(item.assignedGATC || item.officer || 'To be assigned')}<br><b>Next action:</b> Transport the instrument to the assigned GATC for inspection and testing.<br><b>Status:</b> ${badge(item.status)}</p>${item.fieldVerification?.observations ? `<p><b>LMO observations:</b> ${escapeHtml(item.fieldVerification.observations)}</p>` : ''}</div>`).join('')}
        <div class="owner-context" role="note">
            <div class="owner-context-mark">OWN</div>
            <div>
                <strong>Manage your instrument register</strong>
                <p>Register weighing and measuring instruments used in commercial transactions or other regulated activities. Submit verification or re-verification requests, provide supporting documents, schedule activities, and follow each decision through to its digital certificate.</p>
                <small>Expiry reminders help you begin renewal before validity lapses.</small>
            </div>
        </div>
        ${ownerValidityPanel(ownInstruments)}
    `);
}

function ownerValidityPanel(ownInstruments) {
    const rows = ownInstruments.map(instrument => {
        const lifecycle = instrumentValidity(instrument);
        const attention = ['Expired', 'Expiring Soon', 'Awaiting verification'].includes(lifecycle.label);
        return `
            <tr data-validity-row="${attention ? 'attention' : 'valid'}">
                <td><b>${escapeHtml(instrument.name)}</b><small>${escapeHtml(instrument.category)}</small></td>
                <td>${escapeHtml(instrument.location)}</td>
                <td><b>${escapeHtml(instrument.validUntil)}</b></td>
                <td>${badge(lifecycle.label)}</td>
            </tr>
        `;
    }).join('');

    return `
        <section class="owner-validity" aria-labelledby="validityTitle">
            <div class="owner-validity-head">
                <div>
                    <span class="eyebrow dark">VALIDITY REGISTER</span>
                    <h2 id="validityTitle">Instrument due dates</h2>
                    <p class="muted">Review validity and expiry dates for each registered instrument.</p>
                </div>
                <button class="btn secondary" onclick="go('instruments')">Open register</button>
            </div>
            <div class="validity-tabs" role="tablist" aria-label="Instrument validity views">
                <button class="validity-tab active" type="button" role="tab" aria-selected="true" data-validity-tab="all" onclick="showOwnerValidityTab('all')">All instruments <span>${ownInstruments.length}</span></button>
                <button class="validity-tab" type="button" role="tab" aria-selected="false" data-validity-tab="attention" onclick="showOwnerValidityTab('attention')">Due for attention <span>${ownInstruments.filter(instrument => ['Expired', 'Expiring Soon', 'Awaiting verification'].includes(instrumentValidity(instrument).label)).length}</span></button>
            </div>
            <div class="tablewrap">
                <table class="table owner-validity-table">
                    <thead><tr><th>Instrument</th><th>Location</th><th>Valid until</th><th>Status</th></tr></thead>
                    <tbody>${rows || `<tr><td colspan="4" class="muted">No instruments registered yet.</td></tr>`}</tbody>
                </table>
            </div>
        </section>
    `;
}

function showOwnerValidityTab(tab) {
    document.querySelectorAll('[data-validity-tab]').forEach(button => {
        const active = button.dataset.validityTab === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-validity-row]').forEach(row => {
        row.hidden = tab === 'attention' && row.dataset.validityRow !== 'attention';
    });
}

function userApplications() {
    const rows = applications
        .filter(x => x.applicant === state.user.name)
        .map(x => `
            <tr>
                <td><b>${escapeHtml(x.id)}</b></td>
                <td>${escapeHtml(x.instrument)}</td>
                <td>${escapeHtml(x.applicationType === 'FIRST_VERIFICATION' ? 'First Verification' : 'Re-verification')}</td>
                <td>${escapeHtml(x.date)}</td>
                <td>${badge(x.status)}</td>
                <td>
                    <button class="btn secondary" onclick="viewApplication(${jsArg(x.id)})">View</button>
                    <button class="btn danger" onclick="deleteApplication(${jsArg(x.id)})">Delete</button>
                </td>
            </tr>
        `).join('');

    shell('Verification Applications', `
        <div class="pagehead">
            <div>
                <h1>Verification Applications</h1>
                <span class="muted">Track Verification and Re-verification requests from submission to certificate.</span>
            </div>
            <button class="btn primary" onclick="newApplication()">＋ Start Application</button>
        </div>
        ${searchField('Search applications')}
        ${table(['Application ID', 'Instrument', 'Application Type', 'Applied On', 'Status', 'Actions'], rows)}
    `);
}

function userInstruments() {
    const rows = instruments
        .filter(x => x.owner === state.user.name)
        .map(x => `
            <tr>
                <td><b>${escapeHtml(x.name)}</b></td>
                <td>${escapeHtml(x.category)}</td>
                <td>${escapeHtml(x.location)}</td>
                <td>${badge(x.status)}</td>
                <td>${escapeHtml(x.validUntil)}</td>
                <td>
                    <button class="btn secondary" onclick="viewInstrumentDocuments(${jsArg(x.id)})">Documents (${x.documents?.length || 0})</button>
                    <button class="btn secondary" onclick="editInstrument(${jsArg(x.id)})">Edit</button>
                    <button class="btn danger" onclick="deleteInstrument(${jsArg(x.id)})">Delete</button>
                </td>
            </tr>
        `).join('');

    shell('Registered Instruments', `
        <div class="pagehead">
            <div>
                <h1>Registered Instruments</h1>
                <span class="muted">Maintain the instruments used by your business or regulated activity.</span>
            </div>
            <button class="btn primary" onclick="addInstrument()">＋ Register Instrument</button>
        </div>
        ${table(['Instrument', 'Category', 'Location', 'Status', 'Validity', 'Actions'], rows)}
    `);
}

function userCertificates() {
    certificatesPage(
        'My Certificates',
        'View and download your verification certificates.',
        certificates.filter(x => x.applicant === state.user.name)
    );
}

/* Officer pages */

function officerDashboard() {
    const assigned = applications.filter(x => x.officer === state.user.name);
    const successRate = officerSuccessRate(state.user.name);
    const isGatc = state.role === 'GATC';
    const workspace = isGatc ? 'GATC Verification Desk' : 'State LMO Operations';

    shell(workspace, `
        <div class="welcome">
            <div>
                <span class="eyebrow dark">${isGatc ? 'GOVERNMENT APPROVED TEST CENTRE' : 'STATE LEGAL METROLOGY'}</span>
                <h1>${workspace}</h1>
                <span class="muted">${isGatc ? 'Manage centre-based testing and certification.' : 'Enforce fair trade through inspections, verification, and compliance action.'}</span>
            </div>
            <button class="btn primary" onclick="go('applications')">Open queue</button>
        </div>

        <div class="cards">
            ${card('Pending Applications', applications.filter(x => x.status === 'Pending').length, 'Waiting for review')}
            ${card(isGatc ? 'Centre Queue' : 'Assigned Inspections', assigned.length, isGatc ? 'Testing records assigned' : 'Your assignments')}
            ${card('Certificates Issued', certificates.filter(x => x.issuedBy === state.user.name).length, 'Issued by you')}
            ${card('Success Rate', `${successRate.percentage}%`, successRate.detail)}
        </div>

        <div class="card" style="margin-top:18px">
            <h3>${isGatc ? 'Centre workflow' : 'Enforcement workflow'}</h3>
            <div style="display:flex;flex-wrap:wrap;gap:10px">
                <button class="btn secondary" onclick="go('applications')">${isGatc ? 'Review queue' : 'Review assigned cases'}</button>
                <button class="btn secondary" onclick="go('inspections')">${isGatc ? 'Run centre checks' : 'Conduct market inspections'}</button>
                <button class="btn secondary" onclick="go('certificates')">View Certificates</button>
                <button class="btn secondary" onclick="go('reports')">View Reports</button>
            </div>
        </div>
        ${isGatc ? `
            <div class="gatc-context" role="note">
                <div class="gatc-context-mark">GATC</div>
                <div>
                    <strong>Authorized testing centre</strong>
                    <p>Operate as a decentralized extension of Legal Metrology enforcement. Verify, test, and stamp approved instruments at your centre to support faster trade compliance.</p>
                    <small>Typical scope: utility meters, weighbridges, medical devices, and commercial measuring instruments.</small>
                </div>
            </div>
        ` : `
            <div class="lmo-context" role="note">
                <div class="lmo-context-mark">LMO</div>
                <div>
                    <strong>Statutory enforcement authority</strong>
                    <p>Protect consumers and fair trade through surprise market inspections, package-label checks, and verification and stamping of commercial instruments.</p>
                    <small>Enforcement actions may include search, seizure, penal notices, and prosecution for non-compliance.</small>
                </div>
            </div>
        `}
    `);
}

function officerApplications() {
    const isGatc = state.role === 'GATC';
    const assigned = applications.filter(x => isGatc
        ? (x.assignedGATC === state.user.name || x.officer === state.user.name)
        : (x.assignedLMO === state.user.name || x.officer === state.user.name));
    const rows = assigned.map(x => `
        <tr>
            <td><b>${escapeHtml(x.id)}</b></td>
            <td>${escapeHtml(x.applicant)}</td>
            <td>${escapeHtml(x.instrument)}</td>
            <td>${escapeHtml(x.applicationType === 'FIRST_VERIFICATION' ? 'First Verification' : 'Re-verification')}</td>
            <td>${badge(x.status)}</td>
            <td>
                <button class="btn secondary" onclick="viewApplication(${jsArg(x.id)})">View</button>
                <button class="btn danger" onclick="fileComplaint(${jsArg(x.id)})">Report owner</button>
            </td>
        </tr>
    `).join('');

    shell(isGatc ? 'Assigned Applications' : 'Assigned Cases', `
        <div class="pagehead">
            <div>
                <h1>${isGatc ? 'Assigned Applications' : 'Assigned Cases'}</h1>
                <span class="muted">${isGatc ? 'Review the testing records assigned to your centre.' : 'Review businesses, instruments, and compliance actions assigned to you.'}</span>
            </div>
            <button class="btn secondary" onclick="go('applications')">↻ Refresh</button>
        </div>
        ${searchField('Search assigned applications')}
        ${table(['ID', 'Applicant', 'Instrument', 'Type', 'Status', 'Action'], rows)}
    `);
}

function officerInspections() {
    const isGatc = state.role === 'GATC';
    const rows = applications
        .filter(x => isGatc
            ? (x.assignedGATC === state.user.name || x.officer === state.user.name)
            : (x.assignedLMO === state.user.name || x.officer === state.user.name))
        .map(x => `
            <tr>
                <td>${escapeHtml(x.id)}</td>
                <td>${escapeHtml(x.instrument)}</td>
                <td>${escapeHtml(x.location)}</td>
                <td>${badge(x.status)}</td>
                <td>
                    ${(!isGatc && ['LMO Assigned', 'Verification Scheduled', 'Field Verification', 'Inspection Required', 'Inspection Scheduled'].includes(x.status)) ||
                        (isGatc && ['GATC Assigned', 'GATC Verification Scheduled', 'Under GATC Verification', 'Inspection Required', 'Inspection Scheduled'].includes(x.status)) ? `<button class="btn primary"
                            onclick="completeInspection(${jsArg(x.id)})">
                        Complete
                    </button>` : '<span class="muted">No action</span>'}
                </td>
            </tr>
        `).join('');

    shell(isGatc ? 'Centre Checks' : 'Market Inspections', `
        <div class="pagehead">
            <div>
                <h1>${isGatc ? 'Centre Checks' : 'Market Inspections'}</h1>
                <span class="muted">${isGatc ? 'Record measurements and evidence from the test centre.' : 'Plan inspections, verify instruments, and record evidence from the field.'}</span>
            </div>
            <button class="btn primary" onclick="scheduleInspection()">＋ Schedule Inspection</button>
        </div>
        ${table(['Application', 'Instrument', 'Location', 'Status', 'Action'], rows)}
    `);
}

function officerCertificates() {
    certificatesPage(
        'Certificates',
        'View and issue verification certificates.',
        certificates,
        true
    );
}

function officerReports() {
    shell('Reports', `
        <div class="pagehead">
            <div>
                <h1>Reports</h1>
                <span class="muted">Verification performance overview.</span>
            </div>
            <button class="btn primary" onclick="downloadReport()">⬇ Export Report</button>
            <button class="btn secondary" onclick="downloadCsvReport()">▤ Export CSV</button>
        </div>

        <div class="cards">
            ${card('Applications', applications.length, 'Current records')}
            ${card('Verified', applications.filter(x => x.status === 'Verified').length, 'Completed inspections')}
            ${card('Certificates', certificates.length, 'Issued certificates')}
        </div>

        <div class="card" style="margin-top:18px">
            <h3>Application Summary</h3>
            ${table(
                ['Status', 'Count'],
                ['Pending', 'Inspection Required', 'Inspection Scheduled', 'Verified', 'Application Rejected', 'Verification Rejected']
                    .map(item => `
                        <tr>
                            <td>${badge(item)}</td>
                            <td>${applications.filter(x => x.status === item).length}</td>
                        </tr>
                    `).join('')
            )}
        </div>
    `);
}

/* Admin pages */

function adminAssignmentArea() {
    const unassigned = applications.filter(application => {
        const assignment = application.applicationType === 'FIRST_VERIFICATION'
            ? application.assignedGATC
            : application.assignedLMO;
        return assignment === 'Unassigned' &&
            !['Verified', 'Completed', 'Application Rejected', 'Verification Rejected'].includes(application.status);
    });
    const assigned = applications.filter(application =>
        !['Verified', 'Completed', 'Application Rejected', 'Verification Rejected'].includes(application.status)
    );
    const rows = [...unassigned, ...assigned.filter(application => !unassigned.includes(application))].map(application => {
        const isGatc = application.applicationType === 'FIRST_VERIFICATION' || application.gatcRequired;
        const verifier = isGatc ? application.assignedGATC : application.assignedLMO;
        return `
            <tr>
                <td><b>${escapeHtml(application.id)}</b></td>
                <td>${escapeHtml(application.applicant)}</td>
                <td>${escapeHtml(application.applicationType === 'FIRST_VERIFICATION' ? 'GATC' : 'LMO')}</td>
                <td>${escapeHtml(verifier || 'Unassigned')}</td>
                <td>${badge(application.status)}</td>
                <td><button class="btn secondary" onclick="reviewApplication(${jsArg(application.id)})">Manage</button></td>
            </tr>
        `;
    }).join('');

    return `
        <div class="assignment-panel">
            <div class="assignment-panel-head">
                <div>
                    <span class="eyebrow dark">WORK ALLOCATION</span>
                    <h2>Assignment desk</h2>
                    <p class="muted">Route first verifications to GATCs and re-verifications to State LMOs.</p>
                </div>
                <button class="btn primary" onclick="go('applications')">Open full queue</button>
            </div>
            <div class="assignment-stats">
                <div><b>${unassigned.length}</b><span>Needs assignment</span></div>
                <div><b>${applications.filter(application => application.assignedLMO && application.assignedLMO !== 'Unassigned').length}</b><span>LMO assigned</span></div>
                <div><b>${applications.filter(application => application.assignedGATC && application.assignedGATC !== 'Unassigned').length}</b><span>GATC assigned</span></div>
            </div>
            <div class="tablewrap">
                <table class="table">
                    <thead><tr><th>Application</th><th>Applicant</th><th>Route</th><th>Assigned to</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6" class="muted">No active applications require allocation.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;
}

function adminDashboard() {
    const verifierAccounts = users.filter(user => ['Officer', 'GATC'].includes(user.role));
    const pendingCases = applications.filter(item => ['Pending', 'Inspection Required', 'Inspection Scheduled'].includes(item.status));

    shell('Administration Control Desk', `
        <div class="welcome">
            <div>
                <span class="eyebrow dark">PLATFORM ADMINISTRATION</span>
                <h1>Administration Control Desk</h1>
                <span class="muted">Govern access, verification activity, system reliability, and compliance records from one secure workspace.</span>
            </div>
            <button class="btn primary" onclick="go('settings')">Review controls</button>
        </div>

        <div class="cards">
            ${card('Stakeholder Accounts', users.length, 'Registered users and administrators')}
            ${card('Active Verifiers', verifierAccounts.filter(x => x.status === 'Active').length, 'LMOs and GATCs with access')}
            ${card('Verification Records', applications.length, 'Applications in repository')}
            ${card('Digital Certificates', certificates.length, 'Issued certificates')}
            ${card('Pending Cases', pendingCases.length, 'Current verification pendency')}
            ${card('Verifier Requests', officerRequests.filter(x => x.status === 'Pending').length, 'Awaiting approval')}
            ${card('Expired Certificates', certificates.filter(x => certificateLifecycle(x).label === 'Expired').length, 'Require re-verification')}
            ${card('Open Enforcement', enforcementCases.filter(x => x.status === 'Open').length, 'Compliance actions')}
            ${card('Awaiting LMO', applications.filter(x => ['LMO Assigned', 'Verification Scheduled', 'Field Verification'].includes(x.status)).length, 'Re-verification field work')}
            ${card('Awaiting GATC', applications.filter(x => ['GATC Assigned', 'GATC Verification Required', 'GATC Verification Scheduled', 'Under GATC Verification'].includes(x.status)).length, 'Centre testing queue')}
            ${card('Rejected', applications.filter(x => x.status === 'Verification Rejected').length, 'Failed verification outcomes')}
        </div>

        <div class="card" style="margin-top:18px">
            <h3>Control centre</h3>
            <div style="display:flex;flex-wrap:wrap;gap:10px">
                <button class="btn primary" onclick="go('applications')">Open assignment desk</button>
                <button class="btn secondary" onclick="go('officers')">LMO / GATC approvals</button>
                <button class="btn secondary" onclick="go('enforcement')">Review complaints</button>
                <button class="btn secondary" onclick="go('settings')">Security and system controls</button>
            </div>
        </div>
        ${adminAssignmentArea()}
        <div class="admin-context" role="note">
            <div class="admin-context-mark">ADM</div>
            <div>
                <strong>Authorized platform oversight</strong>
                <p>Maintain stakeholder accounts, roles, permissions, configurations, and security controls while monitoring applications, LMOs, GATCs, certificates, enforcement activity, and system access.</p>
                <small>Use the control centre to keep the digital repository accurate, reliable, and available to authorized users.</small>
            </div>
        </div>
    `);
}

function adminUsers() {
    const rows = users.map((user, index) => `
        <tr>
            <td><b>${escapeHtml(user.name)}</b></td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${badge(user.status)}</td>
            <td>${user.role === 'Admin' ? '<span class="muted">Protected account</span>' : `
                <button class="btn secondary" onclick="editUser(${index})">Edit</button>
                <button class="btn secondary" onclick="toggleUser(${index})">
                    ${user.status === 'Active' ? 'Suspend' : 'Activate'}
                </button>
                <button class="btn danger" onclick="deleteUser(${index})">Delete</button>
            `}</td>
        </tr>
    `).join('');

    shell('Manage Users', `
        <div class="pagehead">
            <div>
                <h1>Manage Users</h1>
                <span class="muted">Manage stakeholder identities, roles, permissions, and account status.</span>
            </div>
            <button class="btn primary" onclick="addUser()">＋ Add Account</button>
        </div>
        ${table(['Name', 'Email', 'Role', 'Status', 'Actions'], rows)}
    `);
}

function adminOfficers() {
    const rows = officers.map((officer, index) => `
        <tr>
            <td><b>${escapeHtml(officer.name)}</b></td>
            <td>${escapeHtml(officer.email)}</td>
            <td>${officer.assigned}</td>
            <td>${badge(officer.status)}</td>
            <td>
                <button class="btn secondary" onclick="editOfficer(${index})">Edit</button>
                <button class="btn secondary" onclick="toggleOfficer(${index})">
                    ${officer.status === 'Active' ? 'Set Leave' : 'Activate'}
                </button>
                <button class="btn danger" onclick="removeOfficer(${index})">Remove</button>
            </td>
        </tr>
    `).join('');

    shell('Manage Officers', `
        <div class="pagehead">
            <div>
                <h1>Manage Officers</h1>
                <span class="muted">Approve LMO and GATC access, manage verifier availability, and monitor assignments.</span>
            </div>
            <button class="btn secondary" onclick="go('officers')">↻ Refresh</button>
        </div>
        ${officerRequestPanel()}
        ${table(['Name', 'Email', 'Assignments', 'Status', 'Actions'], rows)}
    `);
}

function officerRequestPanel() {
    const pending = officerRequests.filter(request => request.status === 'Pending');
    if (!pending.length) return '<div class="notice" style="margin-bottom:18px">No Officer registration requests are waiting for review.</div>';

    const rows = pending.map(request => `
        <tr>
            <td><b>${escapeHtml(request.id)}</b></td>
            <td>${escapeHtml(request.name)}</td>
            <td>${escapeHtml(request.email)}</td>
            <td>${escapeHtml(request.role === 'GATC' ? 'GATC' : 'State LMO')}</td>
            <td>${escapeHtml(request.submittedOn)}</td>
            <td>
                <button class="btn primary" onclick="reviewOfficerRequest(${jsArg(request.id)}, 'Accept')">Accept</button>
                <button class="btn danger" onclick="reviewOfficerRequest(${jsArg(request.id)}, 'Reject')">Reject</button>
            </td>
        </tr>
    `).join('');

    return `<div class="request-panel"><div class="request-panel-head"><div><h3>Verifier Registration Requests</h3><span class="muted">Review State LMO and GATC applications before granting access.</span></div><span class="request-count">${pending.length} pending</span></div>${table(['Request ID', 'Applicant', 'Email', 'Type', 'Submitted', 'Decision'], rows)}</div>`;
}

async function reviewOfficerRequest(id, decision) {
    const action = decision === 'Accept' ? 'accept' : 'reject';
    if (!confirm(`${decision} this verifier registration?`)) return;

    try {
        const result = await apiRequest(`/api/admin/officer-requests/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify({ decision })
        });
        applyServerData(result.data);
        toast(`Verifier registration ${action}ed`);
        adminOfficers();
    } catch (error) {
        toast(error.message);
    }
}

function adminApplications() {
    const rows = applications.map(x => `
        <tr data-application-type="${escapeHtml(x.applicationType)}" data-application-stage="${escapeHtml(x.currentStage || '')}" data-application-status="${escapeHtml(x.status)}">
            <td><b>${escapeHtml(x.id)}</b></td>
            <td>${escapeHtml(x.applicant)}</td>
            <td>${escapeHtml(x.instrument)}</td>
            <td>${escapeHtml(x.applicationType === 'FIRST_VERIFICATION' ? (x.assignedGATC || x.officer) : (x.assignedLMO || x.officer))}</td>
            <td>${badge(x.status)}</td>
            <td>
                <button class="btn secondary" onclick="reviewApplication(${jsArg(x.id)})">Manage</button>
                <button class="btn danger" onclick="deleteApplication(${jsArg(x.id)})">Delete</button>
            </td>
        </tr>
    `).join('');

    shell('All Applications', `
        <div class="pagehead">
            <div>
                <h1>All Applications</h1>
                <span class="muted">Monitor every application in the system.</span>
            </div>
            <button class="btn secondary" onclick="go('applications')">↻ Refresh</button>
        </div>
        ${searchField('Search applications')}
        <div class="formgrid" style="margin-bottom:18px">
            <div class="field"><label for="adminTypeFilter">Application Type</label><select id="adminTypeFilter" onchange="filterApplicationTable()"><option value="">All types</option><option value="FIRST_VERIFICATION">First Verification</option><option value="RE_VERIFICATION">Re-verification</option></select></div>
            <div class="field"><label for="adminStageFilter">Current Stage</label><select id="adminStageFilter" onchange="filterApplicationTable()"><option value="">All stages</option><option value="LMO">LMO</option><option value="GATC">GATC</option><option value="Certificate">Certificate</option><option value="Completed">Completed</option><option value="Rejected">Rejected</option></select></div>
        </div>
        ${table(['ID', 'Applicant', 'Instrument', 'Officer', 'Status', 'Actions'], rows)}
    `);
}

function filterApplicationTable() {
    const term = $('#recordSearch')?.value.trim().toLowerCase() || '';
    const type = $('#adminTypeFilter')?.value || '';
    const stage = $('#adminStageFilter')?.value || '';
    document.querySelectorAll('.content .table tbody tr').forEach(row => {
        const textMatch = !term || row.textContent.toLowerCase().includes(term);
        const typeMatch = !type || row.dataset.applicationType === type;
        const value = `${row.dataset.applicationStage} ${row.dataset.applicationStatus}`.toLowerCase();
        const stageMatch = !stage || value.includes(stage.toLowerCase());
        row.hidden = !(textMatch && typeMatch && stageMatch);
    });
}

function adminEnforcement() {
    const rows = enforcementCases.map(item => `
        <tr>
            <td><b>${escapeHtml(item.id)}</b></td>
            <td>${escapeHtml(item.owner)}</td>
            <td>${escapeHtml(item.applicationId)}</td>
            <td>${escapeHtml(item.action)}</td>
            <td>${badge(item.status)}</td>
            <td>${escapeHtml(item.openedOn)}</td>
            <td>${item.status === 'Pending Admin Decision' ? `
                <button class="btn danger" onclick="decideComplaint(${jsArg(item.id)}, 'Suspend')">Suspend</button>
                <button class="btn danger" onclick="decideComplaint(${jsArg(item.id)}, 'Ban')">Ban</button>
                <button class="btn secondary" onclick="decideComplaint(${jsArg(item.id)}, 'Reject')">Reject</button>
            ` : `<span class="muted">${escapeHtml(item.decidedBy || 'Reviewed')}</span>`}</td>
        </tr>
    `).join('');

    shell('Complaints & Disciplinary Decisions', `
        <div class="pagehead">
            <div>
                <h1>Complaints & Disciplinary Decisions</h1>
                <span class="muted">Review complaints filed by LMOs and GATCs before suspending or banning an instrument owner.</span>
            </div>
        </div>
        <div class="notice complaint-notice">Officers submit evidence-based complaints. The Administrator makes the final account decision.</div>
        ${searchField('Search complaints')}
        ${table(['Complaint', 'Owner', 'Application', 'Officer action', 'Status', 'Filed', 'Decision'], rows)}
    `);
}

function fileComplaint(id) {
    const item = applications.find(application => application.id === id);
    if (!item) return;

    showModal('Report Instrument Owner', `
        <p><b>Owner:</b> ${escapeHtml(item.applicant)}</p>
        <p><b>Instrument:</b> ${escapeHtml(item.instrument)}</p>
        <p>Submit the observed non-compliance for Administrator review. Do not decide the account sanction here.</p>
        <form id="complaintForm">
            <div class="field"><label for="complaintAction">Officer action / finding</label><input id="complaintAction" placeholder="Unverified instrument, false label, obstruction" required></div>
            <div class="field"><label for="complaintNotes">Evidence and notes</label><textarea id="complaintNotes" required></textarea></div>
            <button class="btn danger" style="width:100%;margin-top:18px">Submit Complaint</button>
        </form>
    `);

    $('#complaintForm').addEventListener('submit', async event => {
        event.preventDefault();
        try {
            await apiRequest('/api/complaints', {
                method: 'POST',
                body: JSON.stringify({
                    applicationId: id,
                    action: $('#complaintAction').value.trim(),
                    notes: $('#complaintNotes').value.trim()
                })
            });
            closeModal();
            toast('Complaint submitted for Administrator decision');
        } catch (error) {
            toast(error.message);
        }
    });
}

async function decideComplaint(id, decision) {
    const message = decision === 'Reject' ? 'Reject this complaint?' : `${decision} this instrument owner account?`;
    if (!confirm(message)) return;
    try {
        const result = await apiRequest(`/api/admin/complaints/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify({ decision })
        });
        applyServerData(result.data);
        toast(`Complaint ${decision.toLowerCase()}ed`);
        adminEnforcement();
    } catch (error) {
        toast(error.message);
    }
}

function addEnforcementCase() {
    showModal('New Enforcement Case', `
        <form id="enforcementForm">
            <div class="field">
                <label for="enforcementApplication">Application</label>
                <select id="enforcementApplication" required>
                    <option value="">Select an application</option>
                    ${applications.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} - ${escapeHtml(item.applicant)}</option>`).join('')}
                </select>
            </div>
            <div class="field"><label for="enforcementJurisdiction">Jurisdiction</label><input id="enforcementJurisdiction" required></div>
            <div class="field"><label for="enforcementAction">Compliance action</label><input id="enforcementAction" placeholder="Notice, seizure, penalty, follow-up" required></div>
            <div class="field"><label for="enforcementNotes">Notes</label><textarea id="enforcementNotes" required></textarea></div>
            <button class="btn primary" style="width:100%;margin-top:18px">Create Case</button>
        </form>
    `);
    $('#enforcementForm').addEventListener('submit', event => {
        event.preventDefault();
        const applicationId = $('#enforcementApplication').value;
        if (!applicationId) return toast('Select an application');
        enforcementCases.push({
            id: recordId('ENF/2026/'),
            applicationId,
            jurisdiction: $('#enforcementJurisdiction').value.trim(),
            action: $('#enforcementAction').value.trim(),
            notes: $('#enforcementNotes').value.trim(),
            status: 'Open',
            openedOn: today(),
            openedBy: state.user.name
        });
        persistState();
        closeModal();
        adminEnforcement();
        toast('Enforcement case created');
    });
}

function adminCertificates() {
    certificatesPage(
        'All Certificates',
        'View, download, and issue verification certificates.',
        certificates,
        true
    );
}

function adminSettings() {
    const checkbox = (key, label) => `
        <label style="display:flex;align-items:center;gap:10px;margin:17px 0">
            <input type="checkbox"
                   ${state.settings[key] ? 'checked' : ''}
                   onchange="changeSetting('${key}', this.checked)">
            ${label}
        </label>
    `;

    shell('System Settings', `
        <div class="pagehead">
            <div>
                <h1>System Settings</h1>
                <span class="muted">Configure system operations.</span>
            </div>
            <button class="btn primary" onclick="saveSettings()">Save Settings</button>
        </div>

        <div class="card">
            <h3>Application Configuration</h3>
            ${checkbox('emailNotifications', 'Enable email notifications')}
            ${checkbox('autoAssignment', 'Automatically assign applications')}
            ${checkbox('maintenance', 'Enable maintenance mode')}
            <div class="notice">Settings are saved for this browser session.</div>
        </div>
    `);
}

/* Shared certificate functions */

function certificateRows(records) {
    return records.map(x => `
        <tr>
            <td><b>${escapeHtml(x.id)}</b></td>
            <td>${escapeHtml(x.applicant)}</td>
            <td>${escapeHtml(x.instrument)}</td>
            <td>${escapeHtml(x.issuedOn)}</td>
            <td>${escapeHtml(x.validUntil)}</td>
            <td>${badge(x.status)}</td>
            <td>
                <button class="btn secondary" onclick="viewCertificate(${jsArg(x.id)})">View</button>
                <button class="btn secondary" onclick="downloadCertificate(${jsArg(x.id)})">Download</button>
            </td>
        </tr>
    `).join('');
}

function certificatesPage(title, subtitle, records, canIssue = false) {
    shell(title, `
        <div class="pagehead">
            <div>
                <h1>${escapeHtml(title)}</h1>
                <span class="muted">${escapeHtml(subtitle)}</span>
            </div>
            ${canIssue ? '<button class="btn primary" onclick="issueCertificate()">＋ Issue Certificate</button>' : ''}
        </div>

        ${table(
            ['Certificate ID', 'Applicant', 'Instrument', 'Issued On', 'Valid Until', 'Status', 'Actions'],
            certificateRows(records)
        )}
    `);
}

function viewCertificate(id) {
    const certificate = certificates.find(x => x.id === id);
    if (!certificate) return toast('Certificate not found');

    showModal(`Certificate ${escapeHtml(certificate.id)}`, `
        <div class="cert">
            <div class="certhead">
                <div class="certseal">⚖</div>
                <span class="cert-kicker">OFFICIAL RECORD · OVS-WM</span>
                <h1>Verification Certificate</h1>
                <span class="cert-subtitle">Online Verification System for Weighing &amp; Measurement Instruments</span>
            </div>
            <div class="cert-idline">
                <span>Certificate number</span>
                <strong>${escapeHtml(certificate.id)}</strong>
            </div>
            <div class="certbody">
                <div class="certdetails">
                    <div class="certrow"><b>Certificate holder</b><span>${escapeHtml(certificate.applicant)}</span></div>
                    <div class="certrow"><b>Verified instrument</b><span>${escapeHtml(certificate.instrument)}</span></div>
                    <div class="certrow"><b>Application ID</b><span>${escapeHtml(certificate.applicationId)}</span></div>
                    <div class="certrow"><b>Issued on</b><span>${escapeHtml(certificate.issuedOn)}</span></div>
                    <div class="certrow"><b>Valid until</b><span>${escapeHtml(certificate.validUntil)}</span></div>
                </div>
                <div class="cert-status">
                    <span class="cert-status-label">Current status</span>
                    <strong>${escapeHtml(certificate.status)}</strong>
                    <small>Verified by ${escapeHtml(certificate.issuedBy)}</small>
                </div>
            </div>
            <div class="cert-footer">
                <div><span>Authorized officer</span><strong>${escapeHtml(certificate.issuedBy)}</strong></div>
                <div><span>Digital record</span><strong>Authentic &amp; traceable</strong></div>
            </div>
        </div>
    `, `
        <button class="btn primary" style="width:100%;margin-top:20px"
                onclick="downloadCertificate(${jsArg(certificate.id)})">
            ⬇ Download Certificate
        </button>
        <button class="btn secondary" style="width:100%;margin-top:10px"
                onclick="printCertificate()">
            ⎙ Print Certificate
        </button>
    `);
}

function printCertificate() {
    window.print();
}

function downloadCertificate(id) {
    const certificate = certificates.find(x => x.id === id);
    if (!certificate) return toast('Certificate not found');

    const value = key => escapeHtml(certificate[key]);
    const content = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>OVS-WM Certificate ${value('id')}</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:48px;background:#edf3f8;color:#1d3049;font-family:Arial,sans-serif}.certificate{max-width:900px;margin:auto;padding:58px;background:#fff;border:12px solid #123b6e;box-shadow:0 18px 50px #102f5622;position:relative}.certificate:before{content:"";position:absolute;inset:20px;border:1px solid #b7cce2;pointer-events:none}.seal{width:76px;height:76px;margin:auto;border:2px solid #2878d1;border-radius:50%;display:grid;place-items:center;color:#123b6e;font-size:36px}.kicker{text-align:center;color:#2878d1;font-size:11px;font-weight:bold;letter-spacing:3px;margin-top:20px}.title{text-align:center;color:#102b4e;font-family:Georgia,serif;font-size:42px;margin:12px 0 8px}.subtitle{text-align:center;color:#6b7b91;font-size:13px}.number{margin:34px 0 26px;padding:14px 18px;background:#eef5fc;border-left:4px solid #2878d1}.number span,.label{display:block;color:#6b7b91;font-size:10px;text-transform:uppercase;letter-spacing:1px}.number strong{display:block;margin-top:5px;font-family:monospace;font-size:18px;color:#102b4e}.details{display:grid;grid-template-columns:1fr 1fr;gap:0 34px}.row{padding:16px 0;border-bottom:1px dotted #bdcad8}.row strong{display:block;margin-top:5px;font-size:15px}.status{margin:30px 0;padding:18px;text-align:center;background:#e5f6ec;border:1px solid #b7e3c8;color:#197343}.status b{display:block;font-size:18px}.status small{display:block;margin-top:6px}.footer{display:flex;justify-content:space-between;gap:24px;padding-top:28px;border-top:1px solid #dce5ef}.footer span{display:block;color:#6b7b91;font-size:10px;text-transform:uppercase;letter-spacing:1px}.footer strong{display:block;margin-top:7px;font-size:13px}@media print{body{padding:0;background:#fff}.certificate{box-shadow:none;max-width:none}}
</style></head><body><main class="certificate"><div class="seal">⚖</div><div class="kicker">OFFICIAL RECORD · OVS-WM</div><h1 class="title">Verification Certificate</h1><div class="subtitle">Online Verification System for Weighing &amp; Measurement Instruments</div><div class="number"><span>Certificate number</span><strong>${value('id')}</strong></div><section class="details"><div class="row"><span class="label">Certificate holder</span><strong>${value('applicant')}</strong></div><div class="row"><span class="label">Verified instrument</span><strong>${value('instrument')}</strong></div><div class="row"><span class="label">Application ID</span><strong>${value('applicationId')}</strong></div><div class="row"><span class="label">Issued on</span><strong>${value('issuedOn')}</strong></div><div class="row"><span class="label">Valid until</span><strong>${value('validUntil')}</strong></div></section><div class="status"><b>${value('status')}</b><small>Verified by ${value('issuedBy')}</small></div><footer class="footer"><div><span>Authorized officer</span><strong>${value('issuedBy')}</strong></div><div><span>Digital record</span><strong>Authentic &amp; traceable</strong></div></footer></main></body></html>`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
    link.download = `${certificate.id.replaceAll('/', '-')}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Certificate downloaded');
}

/* User actions */

function newApplication() {
    const options = instruments
        .filter(x => x.owner === state.user.name)
        .map(x => `<option value="${escapeHtml(x.name)}">${escapeHtml(x.name)}</option>`)
        .join('');

    if (!options) {
        return showModal('No Instruments Found', `
            <p class="notice">Add an instrument before submitting an application.</p>
        `, `<button class="btn primary" onclick="closeModal();addInstrument()">Add Instrument</button>`);
    }

    showModal('Start Verification Request', `
        <form id="applicationForm" class="formgrid">
            <div class="field full">
                <label for="applicationInstrument">Registered Instrument</label>
                <select id="applicationInstrument" required>
                    <option value="">Select an instrument</option>${options}
                </select>
            </div>
            <div class="field full">
                <label for="applicationType">Application Type</label>
                <select id="applicationType" required>
                    <option value="FIRST_VERIFICATION">First Verification</option>
                    <option value="RE_VERIFICATION">Re-verification</option>
                </select>
            </div>
            <div class="field">
                <label for="applicationLocation">Verification Location</label>
                <input id="applicationLocation" required>
            </div>
            <div class="field">
                <label for="applicationDate">Preferred Verification Date</label>
                <input id="applicationDate" type="date" required>
            </div>
            <div class="field full">
                <label for="applicationNotes">Additional Notes</label>
                <textarea id="applicationNotes"></textarea>
            </div>
            <div class="full" style="display:flex;justify-content:flex-end;gap:10px">
                <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn primary">Submit Application</button>
            </div>
        </form>
    `);

    $('#applicationForm').addEventListener('submit', event => {
        event.preventDefault();

        const instrument = $('#applicationInstrument').value;
        const applicationType = $('#applicationType').value;
        const location = $('#applicationLocation').value.trim();
        const date = $('#applicationDate').value;

        if (!instrument || !location || !date) {
            return toast('Please complete all required fields');
        }

        applications.push({
            id: recordId('OVS/2026/'),
            applicant: state.user.name,
            instrument,
            applicationType,
            officer: 'Unassigned',
            assignedLMO: 'Unassigned',
            assignedGATC: 'Unassigned',
            currentStage: 'DOCUMENT_VERIFICATION',
            gatcRequired: false,
            status: 'Application Submitted',
            date: new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            preferredDate: new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            location,
            notes: $('#applicationNotes').value.trim()
        });

        closeModal();
        persistState();
        toast('Application submitted successfully');
        go('applications');
    });
}

function addInstrument(existing = null) {
    showModal(existing ? 'Edit Instrument' : 'Add New Instrument', `
        <form id="instrumentForm" class="formgrid">
            <div class="field full">
                <label for="instrumentName">Instrument Name</label>
                <input id="instrumentName" value="${escapeHtml(existing?.name || '')}" required>
            </div>
            <div class="field">
                <label for="instrumentCategory">Category</label>
                <select id="instrumentCategory" required>
                    ${['Weighing Instrument', 'Measuring Instrument', 'Length Measuring Instrument', 'Other']
                        .map(x => `<option ${existing?.category === x ? 'selected' : ''}>${x}</option>`).join('')}
                </select>
            </div>
            <div class="field">
                <label for="instrumentLocation">Location</label>
                <input id="instrumentLocation" value="${escapeHtml(existing?.location || '')}" required>
            </div>
            <div class="field full">
                <label for="instrumentDocuments">Supporting Documents</label>
                <input id="instrumentDocuments" type="file" multiple
                       accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                <small class="muted">Upload certificates, invoices, or calibration documents. Maximum 10 MB per file.</small>
                <div id="instrumentDocumentList" class="document-list">
                    ${(existing?.documents || []).map(document => `
                        <div class="document-item">
                            <span>▧</span>
                            <span>${escapeHtml(document.name)}</span>
                            <small>${escapeHtml(document.sizeLabel || '')}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="full" style="display:flex;justify-content:flex-end;gap:10px">
                <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn primary">${existing ? 'Save Changes' : 'Add Instrument'}</button>
            </div>
        </form>
    `);

    $('#instrumentDocuments').addEventListener('change', event => {
        const files = [...event.target.files];
        const invalid = files.find(file => file.size > 10 * 1024 * 1024);
        if (invalid) {
            event.target.value = '';
            return toast(`${invalid.name} is larger than 10 MB`);
        }

        const existingDocuments = existing?.documents || [];
        $('#instrumentDocumentList').innerHTML = [...existingDocuments, ...files.map(file => ({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            sizeLabel: formatFileSize(file.size),
            uploadedOn: today()
        }))].map(document => `
            <div class="document-item">
                <span>▧</span>
                <span>${escapeHtml(document.name)}</span>
                <small>${escapeHtml(document.sizeLabel || '')}</small>
            </div>
        `).join('');
    });

    $('#instrumentForm').addEventListener('submit', async event => {
        event.preventDefault();

        const name = $('#instrumentName').value.trim();
        const category = $('#instrumentCategory').value;
        const location = $('#instrumentLocation').value.trim();
        const uploadedDocuments = await Promise.all([...$('#instrumentDocuments').files].map(async file => ({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            sizeLabel: formatFileSize(file.size),
            uploadedOn: today(),
            dataUrl: await readFileAsDataUrl(file)
        })));

        if (!name || !category || !location) {
            return toast('Please complete all required fields');
        }

        if (existing) {
            Object.assign(existing, {
                name,
                category,
                location,
                documents: [...(existing.documents || []), ...uploadedDocuments]
            });
            toast('Instrument updated');
        } else {
            instruments.push({
                id: `INS-${String(instruments.length + 1).padStart(3, '0')}`,
                owner: state.user.name,
                name,
                category,
                location,
                status: 'Pending',
                validUntil: 'Awaiting verification',
                documents: uploadedDocuments
            });
            toast('Instrument added');
        }

        closeModal();
        persistState();
        go('instruments');
    });
}

function formatFileSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
        reader.readAsDataURL(file);
    });
}

function viewInstrumentDocuments(id) {
    const instrument = instruments.find(item => item.id === id);
    if (!instrument) return toast('Instrument not found');

    const documents = instrument.documents || [];
    showModal(`${escapeHtml(instrument.name)} Documents`, documents.length ? `
        <div class="document-list document-list-large">
            ${documents.map(document => `
                <div class="document-item">
                    <span class="document-icon">▧</span>
                    <div><b>${escapeHtml(document.name)}</b><small>${escapeHtml(document.type)} · ${escapeHtml(document.sizeLabel || '')}</small></div>
                    ${document.dataUrl ? `<a class="btn secondary" download="${escapeHtml(document.name)}" href="${escapeHtml(document.dataUrl)}">Download</a>` : ''}
                    <span class="muted">${escapeHtml(document.uploadedOn || '')}</span>
                </div>
            `).join('')}
        </div>
    ` : '<p class="notice">No supporting documents uploaded for this instrument.</p>');
}

function editInstrument(id) {
    const item = instruments.find(x => x.id === id);
    if (item) addInstrument(item);
}

function deleteInstrument(id) {
    const index = instruments.findIndex(x => x.id === id);
    if (index < 0) return;
    if (instruments[index].status === 'Verified') return toast('Verified instruments cannot be deleted');

    if (!confirm('Delete this instrument?')) return;
    instruments.splice(index, 1);
    persistState();
    toast('Instrument deleted');
    go('instruments');
}

function deleteApplication(id) {
    const index = applications.findIndex(x => x.id === id);
    if (index < 0 || !confirm('Delete this application?')) return;
    if (['Verified', 'Verification Rejected'].includes(applications[index].status)) {
        return toast('Completed applications cannot be deleted');
    }

    applications.splice(index, 1);
    persistState();
    toast('Application deleted');
    go(state.role === 'User' ? 'applications' : 'applications');
}

function viewApplication(id) {
    const item = applications.find(x => x.id === id);
    if (!item) return;

    showModal(escapeHtml(item.id), `
        <p><b>Applicant:</b> ${escapeHtml(item.applicant)}</p>
        <p><b>Instrument:</b> ${escapeHtml(item.instrument)}</p>
        <p><b>Application type:</b> ${escapeHtml(item.applicationType || 'Verification')}</p>
        <p><b>Current stage:</b> ${escapeHtml(item.currentStage || item.status)}</p>
        <p><b>Assigned LMO:</b> ${escapeHtml(item.assignedLMO || 'Unassigned')}<br><b>Assigned GATC:</b> ${escapeHtml(item.assignedGATC || 'Unassigned')}</p>
        <p><b>Applied on:</b> ${escapeHtml(item.date)}</p>
        <p><b>Location:</b> ${escapeHtml(item.location)}</p>
        <p><b>Preferred date:</b> ${escapeHtml(item.preferredDate || 'Not recorded')}</p>
        ${item.notes ? `<p><b>Additional notes:</b> ${escapeHtml(item.notes)}</p>` : ''}
        ${item.scheduledDate ? `<p><b>Scheduled date:</b> ${escapeHtml(item.scheduledDate)} at ${escapeHtml(item.scheduledTime || 'Time not set')}</p>
        <p><b>Scheduled by:</b> ${escapeHtml(item.scheduledBy || 'Not recorded')}</p>` : ''}
        <p><b>Status:</b> ${badge(item.status)}</p>
        ${item.inspection ? `<p><b>Inspection standard:</b> ${escapeHtml(item.inspection.standard)}</p>
        <p><b>Observed reading:</b> ${escapeHtml(item.inspection.observedReading)}</p>
        <p><b>Permissible error:</b> ${escapeHtml(item.inspection.permissibleError)}</p>
        <p><b>Observations:</b> ${escapeHtml(item.inspection.observations)}</p>
        <p><b>Recorded by:</b> ${escapeHtml(item.inspection.conductedBy)} on ${escapeHtml(item.inspection.conductedOn)}</p>
        ${item.inspection.location ? `<p><b>GPS:</b> ${escapeHtml(item.inspection.location.latitude)}, ${escapeHtml(item.inspection.location.longitude)} (accuracy ${escapeHtml(item.inspection.location.accuracy)}m)</p>` : ''}
        ${(item.inspection.evidence || []).length ? `<p><b>Evidence:</b> ${(item.inspection.evidence || []).map(file => `<a href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.name)}">${escapeHtml(file.name)}</a>`).join(', ')}</p>` : ''}` : ''}
        ${item.applicationRejectionReason ? `<p><b>Application rejection reason:</b> ${escapeHtml(item.applicationRejectionReason)}</p>` : ''}
        ${item.verificationRejectionReason ? `<p><b>Verification rejection reason:</b> ${escapeHtml(item.verificationRejectionReason)}</p>` : ''}
        ${item.fieldVerification ? `<div class="notice"><b>Previous LMO Field Verification</b><p><b>Reason:</b> ${escapeHtml(item.fieldVerification.reason || 'Verified at field')}</p><p><b>Observations:</b> ${escapeHtml(item.fieldVerification.observations)}</p><p><b>Remarks:</b> ${escapeHtml(item.fieldVerification.remarks || 'None')}</p></div>` : ''}
    `);
}

/* Officer and administrator actions */

function applicationNeedsGatc(application) {
    return application.applicationType === 'FIRST_VERIFICATION' ||
        application.gatcRequired ||
        application.status === 'GATC Verification Required';
}

function reviewApplication(id) {
    const item = applications.find(x => x.id === id);
    if (!item) return;

    const needsGatc = applicationNeedsGatc(item);
    const matchingVerifiers = officers.filter(verifier => {
        const account = users.find(user => user.name === verifier.name);
        return (!account || account.role === (needsGatc ? 'GATC' : 'Officer'));
    });
    const eligibleVerifiers = matchingVerifiers.filter(verifier => verifier.status === 'Active');
    const unavailableVerifiers = matchingVerifiers.filter(verifier => verifier.status !== 'Active');
    const noEligibleMessage = eligibleVerifiers.length ? '' : `
        <div class="notice" style="margin-top:16px">
            No active ${needsGatc ? 'GATC' : 'LMO'} is available for assignment.
            <button class="btn secondary" type="button" style="margin-top:10px" onclick="closeModal();go('officers')">
                Manage verifier availability
            </button>
        </div>
    `;
    showModal(`Review ${escapeHtml(item.id)}`, `
        <p><b>Applicant:</b> ${escapeHtml(item.applicant)}</p>
        <p><b>Instrument:</b> ${escapeHtml(item.instrument)}</p>
        <p><b>Application type:</b> ${needsGatc ? 'First Verification' : 'Re-verification'}</p>
        <p><b>Location:</b> ${escapeHtml(item.location)}</p>
        <p><b>Status:</b> ${badge(item.status)}</p>
        <div class="field">
            <label for="officerSelect">Assign ${needsGatc ? 'GATC' : 'LMO'}</label>
            <select id="officerSelect">
                <option value="Unassigned">Unassigned</option>
                ${eligibleVerifiers.map(x => `<option value="${escapeHtml(x.name)}" ${(needsGatc ? item.assignedGATC : item.assignedLMO) === x.name ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}
                ${unavailableVerifiers.map(x => `<option disabled>${escapeHtml(x.name)} (On Leave)</option>`).join('')}
            </select>
        </div>
        ${noEligibleMessage}
    `, `
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
            <button class="btn primary" onclick="approveApplication(${jsArg(id)})">Approve</button>
            <button class="btn secondary" ${eligibleVerifiers.length ? '' : 'disabled'} onclick="assignApplication(${jsArg(id)})">Assign</button>
            <button class="btn danger" onclick="rejectApplication(${jsArg(id)})">Reject</button>
        </div>
    `);
}

function approveApplication(id) {
    const item = applications.find(x => x.id === id);
    if (!item) return;

    item.status = 'Document Verification';
    item.currentStage = 'DOCUMENT_VERIFICATION';
    persistState();
    closeModal();
    toast('Application approved for inspection');
    go('applications');
}

function assignApplication(id) {
    const item = applications.find(x => x.id === id);
    const officer = $('#officerSelect')?.value;

    if (!item || !officer || officer === 'Unassigned') {
        return toast('Please select an officer');
    }

    item.officer = officer;
    if (applicationNeedsGatc(item)) {
        item.assignedGATC = officer;
        item.assignedLMO = 'Unassigned';
        item.status = 'GATC Assigned';
        item.currentStage = 'GATC_ASSIGNED';
    } else {
        item.assignedLMO = officer;
        item.assignedGATC = 'Unassigned';
        item.status = 'LMO Assigned';
        item.currentStage = 'LMO_ASSIGNED';
    }
    persistState();
    closeModal();
    toast(`Application assigned to ${officer}`);
    go('applications');
}

function rejectApplication(id) {
    const item = applications.find(x => x.id === id);
    if (!item) return;

    showModal('Reject Application', `
        <p>Record why the submitted information is improper or incomplete.</p>
        <div class="field">
            <label for="applicationRejectionReason">Reason</label>
            <textarea id="applicationRejectionReason" required></textarea>
        </div>
    `, `<button class="btn danger" style="width:100%;margin-top:18px" onclick="confirmApplicationRejection(${jsArg(id)})">Reject Application</button>`);
}

function confirmApplicationRejection(id) {
    const item = applications.find(x => x.id === id);
    const reason = $('#applicationRejectionReason')?.value.trim();
    if (!item || !reason) return toast('Please provide an application rejection reason');

    item.status = 'Application Rejected';
    item.applicationRejectionReason = reason;
    item.rejectedBy = state.user.name;
    item.rejectedOn = today();
    persistState();
    closeModal();
    toast('Application rejected');
    go('applications');
}

function completeInspection(id) {
    const item = applications.find(x => x.id === id);
    if (!item) return;
    const isGatc = state.role === 'GATC';

    showModal(isGatc ? 'Record GATC Verification Result' : 'Record LMO Field Verification Result', `
        <p><b>Application:</b> ${escapeHtml(item.id)}</p>
        ${isGatc && item.fieldVerification ? `<div class="notice"><b>Previous LMO Field Verification</b><p><b>Reason for GATC:</b> ${escapeHtml(item.fieldVerification.reason)}</p><p><b>Observations:</b> ${escapeHtml(item.fieldVerification.observations)}</p><p><b>Measurements:</b> ${escapeHtml(item.fieldVerification.measurements || 'Not recorded')}</p>${(item.fieldVerification.evidence || []).map(file => `<a href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.name)}">${escapeHtml(file.name)}</a>`).join(', ')}</div>` : ''}
        <div class="field">
            <label for="inspectionDecision">${isGatc ? 'Final verification result' : 'Verification Outcome'}</label>
            <select id="inspectionDecision">
                <option value="Verified">${isGatc ? 'Pass - issue certificate' : 'Verified at Field'}</option>
                ${isGatc ? '' : '<option value="GATC Verification Required">GATC Verification Required</option>'}
                <option value="Verification Rejected">Verification Rejected</option>
            </select>
        </div>
        ${!isGatc ? `<div class="field" id="gatcTransferReasonField" style="display:none"><label for="gatcTransferReason">Reason GATC verification is required</label><textarea id="gatcTransferReason"></textarea><label for="gatcAssignment">Recommended / assigned GATC</label><select id="gatcAssignment"><option value="Unassigned">Select a GATC</option>${officers.filter(verifier => users.find(user => user.name === verifier.name)?.role === 'GATC').map(verifier => `<option value="${escapeHtml(verifier.name)}">${escapeHtml(verifier.name)}</option>`).join('')}</select></div>` : ''}
        <div class="field">
            <label for="inspectionStandard">Reference standard or test method</label>
            <input id="inspectionStandard" required placeholder="e.g. Standard weights / test method">
        </div>
        <div class="formgrid">
            <div class="field">
                <label for="observedReading">Observed reading</label>
                <input id="observedReading" required>
            </div>
            <div class="field">
                <label for="permissibleError">Permissible error</label>
                <input id="permissibleError" required>
            </div>
        </div>
        <div class="field">
            <label for="inspectionObservations">Inspection observations</label>
            <textarea id="inspectionObservations" required></textarea>
        </div>
        ${!isGatc ? '<div class="field"><label for="inspectionRemarks">Optional remarks</label><textarea id="inspectionRemarks"></textarea></div>' : ''}
        <div class="field">
            <label for="inspectionEvidence">Field photographs or evidence</label>
            <input id="inspectionEvidence" type="file" accept="image/*,.pdf" capture="environment" multiple>
            <small class="muted">Images are captured from the device camera when available. Maximum 5 MB per file.</small>
        </div>
        <div class="field">
            <button class="btn secondary" type="button" id="captureLocation">Use current GPS location</button>
            <small class="muted" id="inspectionLocationStatus">Location has not been captured.</small>
            <input id="inspectionLatitude" type="hidden">
            <input id="inspectionLongitude" type="hidden">
            <input id="inspectionAccuracy" type="hidden">
        </div>
        <div class="field" id="verificationReasonField" style="display:none">
            <label for="verificationRejectionReason">Rejection reason</label>
            <textarea id="verificationRejectionReason"></textarea>
        </div>
    `, `<button class="btn primary" style="width:100%;margin-top:18px" onclick="saveInspectionResult(${jsArg(id)})">Save Inspection Result</button>`);

    $('#inspectionDecision').addEventListener('change', event => {
        $('#verificationReasonField').style.display = event.target.value === 'Verification Rejected' ? 'block' : 'none';
        if (!isGatc) $('#gatcTransferReasonField').style.display = event.target.value === 'GATC Verification Required' ? 'block' : 'none';
    });
    $('#captureLocation').addEventListener('click', () => {
        if (!navigator.geolocation) return toast('GPS is not available on this device');
        navigator.geolocation.getCurrentPosition(position => {
            $('#inspectionLatitude').value = position.coords.latitude;
            $('#inspectionLongitude').value = position.coords.longitude;
            $('#inspectionAccuracy').value = position.coords.accuracy;
            $('#inspectionLocationStatus').textContent = 'GPS location captured';
        }, () => toast('Unable to capture GPS location'), { enableHighAccuracy: true, timeout: 10000 });
    });
}

async function saveInspectionResult(id) {
    const item = applications.find(x => x.id === id);
    const isGatc = state.role === 'GATC';
    const decision = $('#inspectionDecision')?.value;
    const reason = $('#verificationRejectionReason')?.value.trim();
    const gatcReason = $('#gatcTransferReason')?.value.trim();
    const gatcAssignment = $('#gatcAssignment')?.value || 'Unassigned';
    const inspectionRemarks = $('#inspectionRemarks')?.value.trim() || '';
    const inspectionStandard = $('#inspectionStandard')?.value.trim();
    const observedReading = $('#observedReading')?.value.trim();
    const permissibleError = $('#permissibleError')?.value.trim();
    const inspectionObservations = $('#inspectionObservations')?.value.trim();
    const files = [...($('#inspectionEvidence')?.files || [])];
    if (!item) return;
    if (decision === 'Verification Rejected' && !reason) return toast('Please provide a verification rejection reason');
    if (decision === 'GATC Verification Required' && !gatcReason) return toast('Please explain why GATC verification is required');
    if (decision === 'GATC Verification Required' && gatcAssignment === 'Unassigned') return toast('Please select a GATC');
    if (!inspectionStandard || !observedReading || !permissibleError || !inspectionObservations) {
        return toast('Please record all inspection observations');
    }
    if (files.some(file => file.size > 5 * 1024 * 1024)) return toast('Each evidence file must be 5 MB or smaller');
    let evidence;
    try {
        evidence = await Promise.all(files.map(async file => ({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            sizeLabel: formatFileSize(file.size),
            uploadedOn: today(),
            dataUrl: await readFileAsDataUrl(file)
        })));
    } catch (error) {
        return toast(error.message);
    }

    item.status = decision;
    item.inspectedBy = state.user.name;
    item.inspectedOn = today();
    item.inspection = {
        standard: inspectionStandard,
        observedReading,
        permissibleError,
        observations: inspectionObservations,
        result: decision,
        conductedBy: state.user.name,
        conductedOn: today(),
        location: $('#inspectionLatitude').value ? {
            latitude: Number($('#inspectionLatitude').value),
            longitude: Number($('#inspectionLongitude').value),
            accuracy: Number($('#inspectionAccuracy').value)
        } : null,
        evidence
    };
    if (!isGatc) {
        item.fieldVerification = {
            reason: decision === 'GATC Verification Required' ? gatcReason : '',
            remarks: inspectionRemarks,
            observations: inspectionObservations,
            measurements: `${observedReading}; permissible error: ${permissibleError}`,
            evidence,
            result: decision,
            conductedBy: state.user.name,
            conductedOn: today()
        };
    } else {
        item.gatcVerificationResult = decision;
    }
    if (decision === 'Verification Rejected') {
        item.verificationRejectionReason = reason;
        item.currentStage = 'REJECTED';
    } else if (decision === 'GATC Verification Required') {
        item.gatcRequired = true;
        item.assignedGATC = gatcAssignment;
        item.currentStage = 'GATC_REQUIRED';
        item.status = 'GATC Verification Required';
    } else {
        delete item.verificationRejectionReason;
        item.currentStage = 'VERIFIED';
        const instrument = instruments.find(x => x.owner === item.applicant && x.name === item.instrument);
        if (instrument) {
            instrument.status = 'Verified';
            instrument.validUntil = dateAfterMonths(12);
        }
    }

    closeModal();
    persistState();
    toast(decision === 'Verified' ? 'Verification completed successfully' : decision === 'GATC Verification Required' ? 'GATC verification required; owner instruction recorded' : 'Verification rejected');
    go('inspections');
}

function scheduleInspection() {
    const assigned = applications.filter(x => (state.role === 'GATC'
        ? (x.assignedGATC === state.user.name || x.officer === state.user.name)
        : (x.assignedLMO === state.user.name || x.officer === state.user.name)) &&
        !['Verified', 'Application Rejected', 'Verification Rejected'].includes(x.status));

    if (!assigned.length) {
        return toast('No applications are assigned to you');
    }

    showModal('Schedule Inspection', `
        <form id="scheduleForm">
            <div class="field">
                <label for="scheduleApplication">Application</label>
                <select id="scheduleApplication" required>
                    ${assigned.map(x => `<option value="${x.id}">${escapeHtml(x.id)} — ${escapeHtml(x.instrument)} (requested ${escapeHtml(x.preferredDate || x.date)})</option>`).join('')}
                </select>
            </div>
            <div class="field">
                <label for="scheduleDate">Inspection Date</label>
                <input id="scheduleDate" type="date" required>
            </div>
            <div class="field">
                <label for="scheduleTime">Inspection Time</label>
                <input id="scheduleTime" type="time" required>
            </div>
            <button class="btn primary" style="margin-top:18px;width:100%">
                Save Schedule
            </button>
        </form>
    `);

    $('#scheduleForm').addEventListener('submit', event => {
        event.preventDefault();
        const item = applications.find(x => x.id === $('#scheduleApplication').value);
        const scheduledDate = $('#scheduleDate').value;
        const scheduledTime = $('#scheduleTime').value;
        if (!item || !scheduledDate || !scheduledTime) return toast('Please complete the schedule');

        item.status = state.role === 'GATC' ? 'GATC Verification Scheduled' : 'Verification Scheduled';
        item.currentStage = state.role === 'GATC' ? 'GATC_SCHEDULED' : 'VERIFICATION_SCHEDULED';
        item.scheduledDate = new Date(`${scheduledDate}T00:00:00`).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        item.scheduledTime = scheduledTime;
        item.scheduledBy = state.user.name;
        closeModal();
        persistState();
        toast(`Inspection scheduled by ${state.user.name}`);
        go('inspections');
    });
}

function issueCertificate() {
    const eligible = applications.filter(x =>
        x.status === 'Verified' &&
        !certificates.some(cert => cert.applicationId === x.id)
    );

    if (!eligible.length) {
        return toast('No verified applications are ready for certification');
    }

    showModal('Issue Certificate', `
        <form id="certificateForm">
            <div class="field">
                <label for="certificateApplication">Verified Application</label>
                <select id="certificateApplication" required>
                    <option value="">Select an application</option>
                    ${eligible.map(x => `
                        <option value="${escapeHtml(x.id)}">
                            ${escapeHtml(x.id)} — ${escapeHtml(x.instrument)}
                        </option>
                    `).join('')}
                </select>
            </div>
            <button class="btn primary" style="margin-top:18px;width:100%">
                Issue Certificate
            </button>
        </form>
    `);

    $('#certificateForm').addEventListener('submit', event => {
        event.preventDefault();

        const application = applications.find(
            x => x.id === $('#certificateApplication').value
        );

        if (!application) return toast('Select an application');

        certificates.push({
            id: recordId('W&M/26-27/'),
            applicationId: application.id,
            applicant: application.applicant,
            instrument: application.instrument,
            issuedOn: today(),
            validUntil: dateAfterMonths(12),
            issuedBy: state.user.name,
            verificationType: application.applicationType,
            instrumentId: instruments.find(item => item.owner === application.applicant && item.name === application.instrument)?.id || '',
            status: 'Active'
        });
        application.status = 'Certificate Generated';
        application.currentStage = 'COMPLETED';

        closeModal();
        persistState();
        toast('Certificate issued successfully');
        go('certificates');
    });
}

function downloadReport() {
    const report = [
        'OVS-WM VERIFICATION REPORT',
        `Generated: ${today()}`,
        `Total applications: ${applications.length}`,
        `Pending: ${applications.filter(x => x.status === 'Pending').length}`,
        `Inspection required: ${applications.filter(x => x.status === 'Inspection Required').length}`,
        `Inspection scheduled: ${applications.filter(x => x.status === 'Inspection Scheduled').length}`,
        `GATC verification required: ${applications.filter(x => x.status === 'GATC Verification Required').length}`,
        `Verified: ${applications.filter(x => x.status === 'Verified').length}`,
        `Application rejected: ${applications.filter(x => x.status === 'Application Rejected').length}`,
        `Verification rejected: ${applications.filter(x => x.status === 'Verification Rejected').length}`,
        `Certificates: ${certificates.length}`
    ].join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
    link.download = `ovs-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Report downloaded');
}

function downloadCsvReport() {
    const rows = [
        ['Application ID', 'Applicant', 'Instrument', 'Type', 'Officer', 'Status', 'Applied On'],
        ...applications.map(item => [item.id, item.applicant, item.instrument, item.applicationType || 'Verification', item.officer, item.status, item.date])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `ovs-verification-report-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('CSV report downloaded');
}

function addUser(existing = null, index = -1) {
    showModal(existing ? 'Edit User' : 'Add User', `
        <form id="userForm">
            <div class="field">
                <label for="userName">Full Name</label>
                <input id="userName" value="${escapeHtml(existing?.name || '')}" required>
            </div>
            <div class="field">
                <label for="userEmail">Email</label>
                <input id="userEmail" type="email" value="${escapeHtml(existing?.email || '')}" required>
            </div>
            <div class="field">
                <label for="userRole">Role</label>
                <select id="userRole">
                    <option selected>User</option>
                </select>
            </div>
            ${existing ? '' : `
                <div class="field">
                    <label for="userPassword">Temporary Password</label>
                    <input id="userPassword" type="password" minlength="8" required>
                    <small class="muted">8+ characters with uppercase, lowercase, and a number.</small>
                </div>
            `}
            <button class="btn primary" style="margin-top:18px;width:100%">
                ${existing ? 'Save User' : 'Add User'}
            </button>
        </form>
    `);

    $('#userForm').addEventListener('submit', async event => {
        event.preventDefault();

        const record = {
            name: $('#userName').value.trim(),
            email: $('#userEmail').value.trim(),
            role: $('#userRole').value,
            status: existing?.status || 'Active',
            ...(existing ? { originalEmail: existing.email } : {})
        };

        if (!record.name || !record.email) return toast('Complete all fields');

        if (existing) {
            users[index] = record;
        } else {
            try {
                const result = await apiRequest('/api/admin/accounts', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: record.name,
                        email: record.email,
                        role: record.role,
                        password: $('#userPassword').value
                    })
                });
                applyServerData(result.data);
            } catch (error) {
                return toast(error.message);
            }
        }

        closeModal();
        toast(existing ? 'User updated' : 'User added');
        persistState();
        adminUsers();
    });
}

function editUser(index) {
    addUser(users[index], index);
}

function toggleUser(index) {
    users[index].status = users[index].status === 'Active' ? 'Suspended' : 'Active';
    persistState();
    toast('User status updated');
    adminUsers();
}

function deleteUser(index) {
    if (!confirm('Delete this user?')) return;
    users.splice(index, 1);
    persistState();
    toast('User deleted');
    adminUsers();
}

function addOfficer(existing = null, index = -1) {
    showModal(existing ? 'Edit Officer' : 'Add Officer', `
        <form id="officerForm">
            <div class="field">
                <label for="officerName">Full Name</label>
                <input id="officerName" value="${escapeHtml(existing?.name || '')}" required>
            </div>
            <div class="field">
                <label for="officerEmail">Email</label>
                <input id="officerEmail" type="email" value="${escapeHtml(existing?.email || '')}" required>
            </div>
            <button class="btn primary" style="margin-top:18px;width:100%">
                ${existing ? 'Save Officer' : 'Add Officer'}
            </button>
        </form>
    `);

    $('#officerForm').addEventListener('submit', event => {
        event.preventDefault();

        const name = $('#officerName').value.trim();
        const email = $('#officerEmail').value.trim();

        if (!name || !email) return toast('Complete all fields');

        const record = {
            name,
            email,
            assigned: existing?.assigned || 0,
            status: existing?.status || 'Active'
        };

        if (existing) officers[index] = record;
        else officers.push(record);

        closeModal();
        toast(existing ? 'Officer updated' : 'Officer added');
        persistState();
        adminOfficers();
    });
}

function editOfficer(index) {
    addOfficer(officers[index], index);
}

function toggleOfficer(index) {
    officers[index].status = officers[index].status === 'Active' ? 'On Leave' : 'Active';
    persistState();
    toast('Officer status updated');
    adminOfficers();
}

function removeOfficer(index) {
    if (!confirm('Remove this officer?')) return;
    officers.splice(index, 1);
    persistState();
    toast('Officer removed');
    adminOfficers();
}

/* Account and settings */

function changeSetting(key, value) {
    state.settings[key] = value;
}

function saveSettings() {
    persistState();
    toast('System settings saved');
}

function openProfile() {
    showModal('Profile', `
        <p><b>Name:</b> ${escapeHtml(state.user.name)}</p>
        <p><b>Email:</b> ${escapeHtml(state.user.email)}</p>
        <p><b>Account Type:</b> ${escapeHtml(state.role)}</p>
        <p><b>Certificates:</b> ${certificates.filter(x => x.applicant === state.user.name).length}</p>
    `, `
        <button class="btn primary" style="width:100%;margin-top:20px"
                onclick="editProfile()">Edit Profile</button>
    `);
}

function editProfile() {
    showModal('Edit Profile', `
        <form id="profileForm">
            <div class="field">
                <label for="profileName">Name</label>
                <input id="profileName" value="${escapeHtml(state.user.name)}" required>
            </div>
            <div class="field">
                <label for="profileEmail">Email</label>
                <input id="profileEmail" type="email" value="${escapeHtml(state.user.email)}" required>
            </div>
            <button class="btn primary" style="width:100%;margin-top:18px">
                Save Profile
            </button>
        </form>
    `);

    $('#profileForm').addEventListener('submit', async event => {
        event.preventDefault();

        const name = $('#profileName').value.trim();
        const email = $('#profileEmail').value.trim();

        if (!name || !email) return toast('Complete all fields');

        try {
            const result = await apiRequest('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, email })
            });
            applyServerData(result.data);
            state.user = result.user;
            closeModal();
            toast('Profile updated');
            go(state.page);
        } catch (error) {
            toast(error.message);
        }
    });
}

function logout() {
    apiRequest('/api/logout', { method: 'POST' }).catch(() => {});
    closeModal();
    document.querySelectorAll('.toast').forEach(node => node.remove());

    $('#app').innerHTML = '';
    $('#app').style.display = 'none';
    $('#loginPage').style.display = 'grid';
    $('#loginForm').reset();
    $('#selectedRole').value = 'User';
    $('#loginButton').textContent = 'Sign in as User';

    document.querySelectorAll('.role-tab').forEach(tab => {
        const active = tab.dataset.role === 'User';
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
    });

    state.role = 'User';
    state.page = 'dashboard';
    state.user = { name: 'Rahul Das', email: 'rahul@example.com' };
}

/* Login */

function selectLoginRole(role) {
    document.querySelectorAll('.role-tab').forEach(tab => {
        const active = tab.dataset.role === role;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
    });

    $('#selectedRole').value = role;
    $('#loginButton').textContent = `Enter ${role === 'Officer' ? 'State LMO' : role}`;
}

document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        selectLoginRole(tab.dataset.role);
    });
});

document.querySelectorAll('.demo-login-button').forEach(button => {
    button.addEventListener('click', () => {
        selectLoginRole(button.dataset.demoRole);
        $('#loginEmail').value = button.dataset.demoEmail;
        $('#loginPassword').value = button.dataset.demoPassword;
        $('#loginError').hidden = true;
        $('#loginEmail').focus();
    });
});

$('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();

    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value.trim();

    if (!email || !password) {
        $('#loginError').hidden = false;
        return;
    }

    try {
        const result = await apiRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, role: $('#selectedRole').value })
        });
        finishLogin(result);
    } catch (error) {
        $('#loginError').textContent = error.message;
        $('#loginError').hidden = false;
        return;
    }

});

$('#registerButton').addEventListener('click', () => {
    showModal('Create an Account', `
        <form id="registerForm">
            <div class="field">
                <label for="registerRole">Registration type</label>
                <select id="registerRole" required>
                    <option value="User">User account</option>
                    <option value="Officer">State LMO application for Admin review</option>
                    <option value="GATC">GATC application for Admin review</option>
                </select>
                <small class="muted">State LMO and GATC applications are reviewed before login access is granted.</small>
            </div>
            <div class="notice registration-guidance" id="registrationGuidance">
                <b>About State LMO access</b><br>
                A Legal Metrology Officer is a statutory government officer who enforces the Legal Metrology Act, 2009 through market inspections, instrument verification, package-label checks, and compliance action.
            </div>
            <div class="field">
                <label for="registerName">Full Name</label>
                <input id="registerName" autocomplete="name" required>
            </div>
            <div class="field">
                <label for="registerEmail">Email</label>
                <input id="registerEmail" type="email" autocomplete="email" required>
            </div>
            <div class="field">
                <label for="registerPassword">Password</label>
                <input id="registerPassword" type="password" minlength="8" autocomplete="new-password" required>
                <small class="muted">Use 8+ characters with uppercase, lowercase, and a number.</small>
            </div>
            <button class="btn primary" type="submit" style="width:100%;margin-top:18px">
                Create Account
            </button>
        </form>
    `);

    const registrationRole = $('#registerRole');
    const registrationGuidance = $('#registrationGuidance');
    const updateRegistrationGuidance = () => {
        registrationGuidance.innerHTML = registrationRole.value === 'GATC'
            ? '<b>About GATC access</b><br>A Government Approved Test Centre is an authorized public or private facility that tests and stamps weighing and measuring instruments. GATC applications should represent a qualified lab, industry, or engineering college.'
            : registrationRole.value === 'Officer'
                ? '<b>About State LMO access</b><br>A Legal Metrology Officer is a statutory government officer who enforces the Legal Metrology Act, 2009 through market inspections, instrument verification, package-label checks, and compliance action.'
                : '<b>About applicant access</b><br>Use an applicant account to register instruments, submit verification requests, and track certificates.';
    };
    registrationRole.addEventListener('change', updateRegistrationGuidance);
    updateRegistrationGuidance();

    $('#registerForm').addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            const result = await apiRequest('/api/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: $('#registerName').value.trim(),
                    email: $('#registerEmail').value.trim(),
                    password: $('#registerPassword').value,
                    role: $('#registerRole').value
                })
            });
            closeModal();
            if (result.pending) {
                toast('Officer registration submitted for Admin review');
            } else {
                finishLogin(result);
                toast('Account created successfully');
            }
        } catch (error) {
            button.disabled = false;
            toast(error.message);
        }
    });
});

userDashboard();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
}

window.addEventListener('online', flushPendingState);