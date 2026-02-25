const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://ai-ticket-backend1.onrender.com';
let currentAnalysis = null;
let allTickets = [];
let currentUser = null;
let pendingReviewTicketId = null;

// On Load
document.addEventListener('DOMContentLoaded', () => {
    pingServer(); // Wake up backend immediately
    checkAuth();
    checkSystemStatus();
    // Default tab will be set after auth
});

async function pingServer() {
    try {
        // Just a light ping to wake up the server (especially for Render cold starts)
        fetch(`${API_URL}/`).catch(() => {});
    } catch (e) {}
}

function openAuthModal(type = 'login') {
    const modal = document.getElementById('auth-modal');
    const loginCont = document.getElementById('login-container');
    const signupCont = document.getElementById('signup-container');
    if (!modal || !loginCont || !signupCont) return;

    if (type === 'signup') {
        loginCont.classList.add('hidden');
        signupCont.classList.remove('hidden');
    } else {
        signupCont.classList.add('hidden');
        loginCont.classList.remove('hidden');
    }

    modal.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    document.documentElement.classList.add('no-scroll');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('no-scroll');
    document.documentElement.classList.remove('no-scroll');
}

// Auth Logic
function toggleAuth(type) {
    const loginCont = document.getElementById('login-container');
    const signupCont = document.getElementById('signup-container');
    
    if (type === 'signup') {
        loginCont.classList.add('hidden');
        signupCont.classList.remove('hidden');
    } else {
        signupCont.classList.add('hidden');
        loginCont.classList.remove('hidden');
    }
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');

    if (!token) {
        authScreen.classList.remove('hidden');
        mainApp.classList.add('opacity-0');
        document.body.classList.remove('no-scroll');
        document.documentElement.classList.remove('no-scroll');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
        currentUser = await response.json();
        updateUIWithUser();
        
        // Show/Hide admin navigation
        const adminNav = document.getElementById('admin-nav');
        if (adminNav) {
            if (currentUser.is_admin) {
                adminNav.classList.remove('hidden');
            } else {
                adminNav.classList.add('hidden');
            }
        }

        const authModal = document.getElementById('auth-modal');
            if (authModal) authModal.classList.add('hidden');
            authScreen.classList.add('hidden');
            mainApp.classList.remove('opacity-0');
            document.body.classList.remove('no-scroll');
            document.documentElement.classList.remove('no-scroll');
            switchTab('home');
            
            // Parallelize background data loading
            Promise.all([
                fetchTickets(),
                updateDashboardStats()
            ]);
        } else {
            localStorage.removeItem('token');
            authScreen.classList.remove('hidden');
            mainApp.classList.add('opacity-0');
            document.body.classList.add('no-scroll');
            document.documentElement.classList.add('no-scroll');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

    try {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Invalid credentials');

        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        currentUser = data.user;
        updateUIWithUser();

        // Show/Hide admin navigation
        const adminNav = document.getElementById('admin-nav');
        if (adminNav) {
            if (currentUser.is_admin) {
                adminNav.classList.remove('hidden');
            } else {
                adminNav.classList.add('hidden');
            }
        }

        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');
        authScreen.classList.add('hidden');
        mainApp.classList.remove('opacity-0');
        document.body.classList.remove('no-scroll');
        document.documentElement.classList.remove('no-scroll');
        switchTab('home');
        
        // Parallelize these to speed up login
        Promise.all([
            fetchTickets(),
            updateDashboardStats()
        ]);
        
        showNotification("Welcome Back!", "Successfully signed into your workspace.");
    } catch (error) {
        let msg = error.message;
        if (msg.includes('fetch')) {
            msg = "Connection failed. The server might be waking up, please try again in a few seconds.";
        }
        showNotification("Login Failed", msg, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Access Workspace';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-btn');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, full_name: name })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Registration failed');
        }

        const loginForm = new FormData();
        loginForm.append('username', email);
        loginForm.append('password', password);

        const loginResponse = await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: loginForm
        });

        if (!loginResponse.ok) {
            throw new Error('Account created but login failed');
        }

        const loginData = await loginResponse.json();
        localStorage.setItem('token', loginData.access_token);
        currentUser = loginData.user;
        updateUIWithUser();

        const authScreen = document.getElementById('auth-screen');
        const mainApp = document.getElementById('main-app');
        authScreen.classList.add('hidden');
        mainApp.classList.remove('opacity-0');
        document.body.classList.remove('no-scroll');
        document.documentElement.classList.remove('no-scroll');
        switchTab('home');
        
        // Parallelize background data loading
        Promise.all([
            fetchTickets(),
            updateDashboardStats()
        ]);
        
        showNotification("Account Created", "You are now signed into your workspace.");
    } catch (error) {
        let msg = error.message;
        if (msg.includes('fetch')) {
            msg = "Connection failed. The server might be waking up, please try again in a few seconds.";
        }
        showNotification("Signup Failed", msg, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Register Account';
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    location.reload();
}

function updateUIWithUser() {
    if (!currentUser) return;
    
    document.getElementById('user-display-name').textContent = currentUser.full_name;
    const initials = currentUser.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('user-initials').textContent = initials;
}

// System Status Check
async function checkSystemStatus() {
    const indicator = document.getElementById('system-status');
    const text = document.getElementById('status-text');
    
    try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            indicator.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
            text.textContent = 'System Online';
        } else {
            throw new Error('Server Error');
        }
    } catch (error) {
        indicator.className = 'w-2 h-2 rounded-full bg-rose-500 animate-pulse';
        text.textContent = 'System Offline';
    }
}

// Navigation
function switchTab(tab) {
    // Update nav links
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active', 'bg-neutral-800', 'text-white');
        el.classList.add('text-slate-400');
    });
    
    const activeNav = document.getElementById(`nav-${tab}`);
    if (activeNav) {
        activeNav.classList.add('active', 'bg-neutral-800', 'text-white');
        activeNav.classList.remove('text-slate-400');
    }

    // Update sections
    document.querySelectorAll('.tab-content').forEach(sec => {
        sec.classList.add('hidden');
    });
    
    const activeSection = document.getElementById(`${tab}-section`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }

    // Update Header
    const titles = {
        home: { t: "Welcome", s: "Start by creating a new ticket." },
        dashboard: { t: "Workspace Overview", s: "Monitor your ticket performance and platform health." },
        create: { t: "New Support Request", s: "Submit a new ticket for processing and resolution." },
        history: { t: "Request History", s: "View and manage your previous support requests." },
        reviews: { t: "Reviews", s: "Track satisfaction scores across your tickets." },
        settings: { t: "Profile Settings", s: "Manage your account and notification preferences." },
        about: { t: "About", s: "Learn about the platform and its capabilities." },
        help: { t: "Help Center", s: "Browse FAQs and find quick answers." },
        contact: { t: "Contact", s: "Share your details and we will reach out." },
        'admin-users': { t: "User Management", s: "View and manage all system users." }
    };

    document.getElementById('page-title').textContent = titles[tab].t;
    document.getElementById('page-subtitle').textContent = titles[tab].s;

    if (tab === 'history' || tab === 'reviews') {
        fetchTickets();
    }
    
    if (tab === 'admin-users') {
        fetchAdminUsers();
    }
}

function goToPlatformActivity() {
    switchTab('dashboard');
    setTimeout(() => {
        const el = document.getElementById('platform-activity');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 200);
}

function handleContactSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message').value.trim();
    if (!name || !email || !message) {
        showNotification("Missing Details", "Please fill in all fields.", "error");
        return;
    }
    showNotification("Submitted", "Our support team will contact you shortly.");
    document.getElementById('contact-name').value = '';
    document.getElementById('contact-email').value = '';
    document.getElementById('contact-message').value = '';
}
// Notification Helper
function showNotification(title, message, type = 'success') {
    const toast = document.getElementById('notification');
    const icon = document.getElementById('notif-icon');
    const tLabel = document.getElementById('notif-title');
    const mLabel = document.getElementById('notif-message');

    tLabel.textContent = title;
    mLabel.textContent = message;

    if (type === 'success') {
        icon.className = 'w-10 h-10 rounded-xl flex items-center justify-center text-white bg-emerald-500 shadow-lg shadow-emerald-500/20';
        icon.innerHTML = '<i class="fas fa-check"></i>';
    } else {
        icon.className = 'w-10 h-10 rounded-xl flex items-center justify-center text-white bg-rose-500 shadow-lg shadow-rose-500/20';
        icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 4000);
}

// Analyze Ticket
async function analyzeTicket() {
    const text = document.getElementById('ticket-input').value;
    const btn = document.getElementById('analyze-btn');
    
    if (!text.trim()) {
        showNotification("Input Required", "Please describe your issue before analyzing.", "error");
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();
        currentAnalysis = { ...data, title: `Ticket: ${text.substring(0, 30)}...`, description: text };
        
        displayResult(data);
        showNotification("Analysis Complete", "Request has been processed and categorized.");
    } catch (error) {
        showNotification("Processing Error", error.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-microchip"></i> Process Request';
        btn.disabled = false;
    }
}

function displayResult(data) {
    const resultDiv = document.getElementById('analysis-result');
    const catSpan = document.getElementById('result-category');
    const prioSpan = document.getElementById('result-priority');
    const entDiv = document.getElementById('entities-container');
    const entList = document.getElementById('entities-list');

    resultDiv.classList.remove('hidden');
    
    catSpan.textContent = data.category;
    prioSpan.textContent = data.priority.toUpperCase();
    
    // Priority Colors
    const colors = {
        low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        high: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    };
    prioSpan.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colors[data.priority.toLowerCase()] || colors.medium}`;

    // Entities
    entList.innerHTML = '';
    const entities = data.extracted_entities || {};
    if (Object.keys(entities).length > 0) {
        entDiv.classList.remove('hidden');
        for (const [key, value] of Object.entries(entities)) {
            const tag = document.createElement('span');
            tag.className = 'px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-2';
            tag.innerHTML = `<span class="text-slate-500 uppercase text-[10px] font-bold">${key.replace('_', ' ')}:</span> ${value}`;
            entList.appendChild(tag);
        }
    } else {
        entDiv.classList.add('hidden');
    }
}

async function submitTicket() {
    if (!currentAnalysis) return;

    try {
        const response = await fetch(`${API_URL}/tickets`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                title: currentAnalysis.title,
                description: currentAnalysis.description,
                category: currentAnalysis.category,
                priority: currentAnalysis.priority,
                extracted_entities: currentAnalysis.extracted_entities
            })
        });

        if (!response.ok) {
            throw new Error('Submission failed');
        }

        const created = await response.json();
        pendingReviewTicketId = created.id;
        showNotification("Success!", "Your ticket has been officially submitted.");
        resetForm();
        openReviewModal();
        setTimeout(() => switchTab('history'), 800);
    } catch (error) {
        showNotification("Submission Error", error.message, "error");
    }
}

function resetForm() {
    document.getElementById('ticket-input').value = '';
    document.getElementById('analysis-result').classList.add('hidden');
    currentAnalysis = null;
}

async function fetchTickets() {
    const list = document.getElementById('tickets-list');
    
    try {
        const response = await fetch(`${API_URL}/tickets`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        allTickets = await response.json();
        renderTickets(allTickets);
        updateDashboardStats();
        renderReviews();
    } catch (error) {
        showNotification("Failed to Load", "Could not retrieve ticket history.", "error");
    }
}

function updateDashboardStats() {
    const total = allTickets.length;
    const totalEl = document.getElementById('stat-total');
    if (totalEl) {
        totalEl.textContent = total;
    }

    const previewTicketsEl = document.getElementById('preview-tickets');
    if (previewTicketsEl) {
        previewTicketsEl.textContent = total;
    }

    const rated = allTickets.filter(t => typeof t.rating === 'number' && !Number.isNaN(t.rating));
    const reviewsCount = rated.length;
    let avgRating = null;
    if (reviewsCount > 0) {
        avgRating = rated.reduce((sum, t) => sum + t.rating, 0) / reviewsCount;
    }

    const ratingLabel = avgRating !== null ? avgRating.toFixed(1) : '–';
    const ratingEl = document.getElementById('stat-rating');
    if (ratingEl) {
        ratingEl.textContent = ratingLabel;
    }
    const previewRatingEl = document.getElementById('preview-rating');
    if (previewRatingEl) {
        previewRatingEl.textContent = ratingLabel;
    }

    const times = allTickets
        .map(t => t.first_response_seconds)
        .filter(v => typeof v === 'number' && !Number.isNaN(v) && v >= 0)
        .sort((a, b) => a - b);

    let medianLabel = '–';
    if (times.length > 0) {
        const mid = Math.floor((times.length - 1) / 2);
        const medianSeconds = times[mid];
        const minutes = medianSeconds / 60;
        if (minutes < 1) {
            medianLabel = '<1m';
        } else if (minutes < 60) {
            medianLabel = `${Math.round(minutes)}m`;
        } else {
            const hours = minutes / 60;
            medianLabel = `${hours.toFixed(1)}h`;
        }
    }

    const responseEl = document.getElementById('stat-response');
    if (responseEl) {
        responseEl.textContent = medianLabel;
    }
    const previewResponseEl = document.getElementById('preview-response');
    if (previewResponseEl) {
        previewResponseEl.textContent = medianLabel;
    }

    const autoEl = document.getElementById('stat-auto');
    if (autoEl) {
        const percentage = total > 0 ? Math.round((reviewsCount / total) * 100) : 0;
        autoEl.textContent = `${percentage}%`;
    }
}

function openReviewModal() {
    const modal = document.getElementById('review-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    pendingReviewTicketId = null;
}

async function handleReview(rating) {
    if (!pendingReviewTicketId) {
        closeReviewModal();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/tickets/${pendingReviewTicketId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ rating })
        });

        if (!response.ok) {
            throw new Error('Could not save review');
        }

        showNotification("Thank you!", "Your rating has been recorded.");
        closeReviewModal();
        fetchTickets();
    } catch (error) {
        showNotification("Review Error", error.message, "error");
        closeReviewModal();
    }
}

function renderReviews() {
    const container = document.getElementById('reviews-list');
    const avgEl = document.getElementById('reviews-average');
    const countEl = document.getElementById('reviews-count');
    if (!container || !avgEl || !countEl) return;

    const rated = allTickets.filter(t => typeof t.rating === 'number' && !Number.isNaN(t.rating));

    if (rated.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">No reviews yet. Submit a ticket and rate it after creation.</p>';
        avgEl.textContent = '–';
        countEl.textContent = '0';
        return;
    }

    const avg = rated.reduce((sum, t) => sum + t.rating, 0) / rated.length;
    avgEl.textContent = avg.toFixed(1);
    countEl.textContent = rated.length.toString();

    container.innerHTML = rated.map(t => {
        const filled = '★'.repeat(t.rating);
        const empty = '☆'.repeat(5 - t.rating);
        return `
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                    <p class="text-sm font-medium text-white truncate max-w-xs">${t.title}</p>
                    <p class="text-[11px] text-slate-500">Ticket #${t.id.toString().padStart(4, '0')}</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm text-amber-400 font-semibold">${filled}${empty}</span>
                    <button type="button" class="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-300 hover:bg-slate-700" onclick="reopenReview(${t.id})">
                        Update
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function reopenReview(ticketId) {
    pendingReviewTicketId = ticketId;
    openReviewModal();
}

function renderTickets(tickets) {
    const list = document.getElementById('tickets-list');
    
    if (tickets.length === 0) {
        list.innerHTML = '<div class="p-20 text-center"><i class="fas fa-inbox text-5xl text-slate-800 mb-4"></i><p class="text-slate-500">No matching tickets found.</p></div>';
        return;
    }

    list.innerHTML = tickets.map(t => `
        <div class="p-6 hover:bg-slate-800/30 transition-all cursor-pointer group border-b border-slate-800 last:border-0">
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-all">
                        <i class="fas fa-ticket"></i>
                    </div>
                    <div>
                        <h4 class="text-white font-semibold text-sm">${t.title}</h4>
                        <p class="text-xs text-slate-500">Ticket ID: #${t.id.toString().padStart(4, '0')}</p>
                    </div>
                </div>
                <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">${t.status}</span>
            </div>
            <div class="flex items-center gap-4 ml-13 pl-13">
                <span class="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <i class="fas fa-tag text-[10px]"></i> ${t.category}
                </span>
                <span class="text-xs font-medium ${getPriorityColor(t.priority)} flex items-center gap-1.5">
                    <i class="fas fa-circle text-[6px]"></i> ${t.priority.toUpperCase()}
                </span>
            </div>
        </div>
    `).join('');
}

function filterTickets() {
    const query = document.getElementById('ticket-search').value.toLowerCase();
    const priority = document.getElementById('filter-priority').value;

    const filtered = allTickets.filter(t => {
        const matchesQuery = t.title.toLowerCase().includes(query) || 
                             t.category.toLowerCase().includes(query) ||
                             t.id.toString().includes(query);
        const matchesPriority = priority === 'all' || t.priority.toLowerCase() === priority;
        return matchesQuery && matchesPriority;
    });

    renderTickets(filtered);
}

function exportData() {
    if (allTickets.length === 0) {
        showNotification("No Data", "There are no tickets to export.", "error");
        return;
    }

    const headers = ["ID", "Title", "Category", "Priority", "Status", "Created At"];
    const csvRows = [
        headers.join(','),
        ...allTickets.map(t => [
            t.id,
            `"${t.title.replace(/"/g, '""')}"`,
            t.category,
            t.priority,
            t.status,
            new Date().toLocaleDateString()
        ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `aiticket-export-${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    
    showNotification("Export Started", "Your ticket history is being downloaded.");
}

function getPriorityColor(prio) {
    prio = prio.toLowerCase();
    if (prio === 'high') return 'text-rose-400';
    if (prio === 'medium') return 'text-amber-400';
    return 'text-emerald-400';
}

async function fetchAdminUsers() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;

    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Failed to fetch users');

        const users = await response.json();
        list.innerHTML = users.map(u => `
            <tr class="hover:bg-slate-800/30 transition-all">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                            ${u.full_name[0].toUpperCase()}
                        </div>
                        <span class="text-sm font-medium text-white">${u.full_name}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-400">${u.email}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.is_admin ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}">
                        ${u.is_admin ? 'Admin' : 'User'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-slate-500 font-mono">#${u.id}</td>
            </tr>
        `).join('');
    } catch (error) {
        showNotification("Admin Error", error.message, "error");
    }
}
