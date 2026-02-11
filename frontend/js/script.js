const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://YOUR-BACKEND-URL.onrender.com'; // TODO: Replace with your actual Render Backend URL after deployment

let currentAnalysis = null;

// On Load
document.addEventListener('DOMContentLoaded', () => {
    checkSystemStatus();
    // Optional: fetchTickets() if you want to preload history
});

// System Status Check
async function checkSystemStatus() {
    const indicator = document.getElementById('system-status');
    const text = document.getElementById('status-text');
    
    try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            indicator.className = 'status-indicator online';
            text.textContent = 'System Online';
        } else {
            throw new Error('Server Error');
        }
    } catch (error) {
        indicator.className = 'status-indicator offline';
        text.textContent = 'System Offline';
    }
}

// Navigation
function switchTab(tab) {
    document.querySelectorAll('nav li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('section').forEach(sec => {
        sec.classList.remove('active-section');
        sec.classList.add('hidden-section');
    });

    if (tab === 'create') {
        document.querySelector('nav li:first-child').classList.add('active');
        document.getElementById('create-section').classList.add('active-section');
        document.getElementById('create-section').classList.remove('hidden-section');
    } else {
        document.querySelector('nav li:last-child').classList.add('active');
        document.getElementById('history-section').classList.add('active-section');
        document.getElementById('history-section').classList.remove('hidden-section');
        fetchTickets();
    }
}

// Analyze Ticket
async function analyzeTicket() {
    const text = document.getElementById('ticket-input').value;
    const btn = document.getElementById('analyze-btn');
    
    if (!text.trim()) {
        alert("Please enter a description.");
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();
        currentAnalysis = { ...data, title: `${data.category} - ${text.substring(0, 30)}...`, description: text };
        
        displayResult(data);
    } catch (error) {
        alert("Error analyzing ticket: " + error.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-magic"></i> Analyze Issue';
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
    prioSpan.className = `badge priority-${data.priority.toLowerCase()}`;

    // Entities
    entList.innerHTML = '';
    const entities = data.extracted_entities || {};
    if (Object.keys(entities).length > 0) {
        entDiv.classList.remove('hidden');
        for (const [key, value] of Object.entries(entities)) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = `${key}: ${value}`;
            entList.appendChild(tag);
        }
    } else {
        entDiv.classList.add('hidden');
    }
}

function resetForm() {
    document.getElementById('ticket-input').value = '';
    document.getElementById('analysis-result').classList.add('hidden');
    currentAnalysis = null;
}

// Submit Ticket
async function submitTicket() {
    if (!currentAnalysis) return;

    try {
        const response = await fetch(`${API_URL}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentAnalysis)
        });

        if (response.ok) {
            alert("Ticket Created Successfully!");
            resetForm();
            // Optional: switch to history
        } else {
            throw new Error('Submission failed');
        }
    } catch (error) {
        alert("Error submitting ticket: " + error.message);
    }
}

// Fetch History
async function fetchTickets() {
    const list = document.getElementById('tickets-list');
    list.innerHTML = '<p>Loading...</p>';

    try {
        const response = await fetch(`${API_URL}/tickets`);
        const tickets = await response.json();

        list.innerHTML = '';
        if (tickets.length === 0) {
            list.innerHTML = '<p>No tickets found.</p>';
            return;
        }

        tickets.forEach(t => {
            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.innerHTML = `
                <div class="ticket-header">
                    <span class="badge priority-${t.priority.toLowerCase()}">${t.priority.toUpperCase()}</span>
                    <span>#${t.id}</span>
                </div>
                <div class="ticket-title">${t.category}</div>
                <div class="ticket-desc">${t.description}</div>
                <div class="ticket-header" style="margin-top:1rem; margin-bottom:0;">
                    <small>${new Date(t.created_at).toLocaleDateString()}</small>
                    <small>${t.status}</small>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        list.innerHTML = '<p>Error fetching tickets.</p>';
    }
}
