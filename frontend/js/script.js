const API_URL = 'http://localhost:8000';
let currentAnalysis = null;
let allTickets = [];

// On Load
document.addEventListener('DOMContentLoaded', () => {
    checkSystemStatus();
    // Default to dashboard
    switchTab('dashboard');
});

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
        el.classList.remove('active', 'bg-slate-800', 'text-white');
        el.classList.add('text-slate-400');
    });
    
    const activeNav = document.getElementById(`nav-${tab}`);
    if (activeNav) {
        activeNav.classList.add('active', 'bg-slate-800', 'text-white');
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
        dashboard: { t: "Dashboard Overview", s: "Welcome back to your AI-powered workspace." },
        create: { t: "Create New Ticket", s: "Submit a request for AI-assisted categorization." },
        history: { t: "Ticket History", s: "Review and track your previous submissions." },
        settings: { t: "System Settings", s: "Configure your personal and platform preferences." },
        about: { t: "About AITicket", s: "Learn how our platform revolutionizes support." }
    };

    document.getElementById('page-title').textContent = titles[tab].t;
    document.getElementById('page-subtitle').textContent = titles[tab].s;

    if (tab === 'history') {
        fetchTickets();
    }
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();
        currentAnalysis = { ...data, title: `Ticket: ${text.substring(0, 30)}...`, description: text };
        
        displayResult(data);
        showNotification("AI Analysis Complete", "We've categorized and prioritized your request.");
    } catch (error) {
        showNotification("Analysis Failed", error.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-sparkles"></i> Run AI Analysis';
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: currentAnalysis.title,
                description: currentAnalysis.description,
                category: currentAnalysis.category,
                priority: currentAnalysis.priority,
                extracted_entities: currentAnalysis.extracted_entities
            })
        });

        if (response.ok) {
            showNotification("Success!", "Your ticket has been officially submitted.");
            resetForm();
            setTimeout(() => switchTab('history'), 1000);
        } else {
            throw new Error('Submission failed');
        }
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
        const response = await fetch(`${API_URL}/tickets`);
        allTickets = await response.json();
        renderTickets(allTickets);
    } catch (error) {
        showNotification("Failed to Load", "Could not retrieve ticket history.", "error");
    }
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
