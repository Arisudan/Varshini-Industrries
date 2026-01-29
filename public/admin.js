// Update API Base for dynamic environments
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3000/api' : '/api';

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper to check if we are in static mode (e.g. GitHub Pages)
function isStaticMode() {
    return localStorage.getItem('static_mode') === 'true';
}

// --- CENTRAL DATA SERVICE ---
const DataService = {
    getAuthHeader() {
        const token = localStorage.getItem('auth_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    async getCollection(collectionName) {
        let endpoint = `${API_BASE}/${collectionName}`;
        if (collectionName === 'products') endpoint = `${API_BASE}/public/products`; // or /dashboard for authenticated

        try {
            const res = await fetch(endpoint, {
                headers: this.getAuthHeader()
            });
            if (!res.ok) throw new Error(`Failed to fetch ${collectionName}`);
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    async addItem(collectionName, item) {
        // Prepare Body
        let body;
        let headers = this.getAuthHeader();

        if (item instanceof FormData) {
            // Let browser set Content-Type for FormData
            body = item;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(item);
        }

        const res = await fetch(`${API_BASE}/${collectionName}`, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Add Failed');
        }
        return await res.json();
    },

    async updateItem(collectionName, id, updates) {
        let endpoint = `${API_BASE}/${collectionName}/${id}`;
        let method = 'PUT';
        let body;
        let headers = this.getAuthHeader();

        // Special handling for Leads Status (Server specific)
        if (collectionName === 'leads' && updates.status) {
            endpoint = `${API_BASE}/leads/status`;
            method = 'POST';
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ id, status: updates.status });
        } else if (updates instanceof FormData) {
            body = updates;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(updates);
        }

        const res = await fetch(endpoint, {
            method: method,
            headers: headers,
            body: body
        });

        if (!res.ok) throw new Error('Update Failed');
    },

    async deleteItem(collectionName, id) {
        const res = await fetch(`${API_BASE}/${collectionName}/${id}`, {
            method: 'DELETE',
            headers: this.getAuthHeader()
        });
        if (!res.ok) throw new Error('Delete Failed');
    },

    // Legacy/Internal methods - kept empty or redirecting to avoid breaking deep dependencies if any
    async _getStaticDB() { return {}; },
    _persistStaticDB() { }
};

// Legacy Helper for simple calls if needed
async function getStaticDB() { return DataService._getStaticDB(); }
function persistStaticDB() { /* handled by service */ }

// Export DB Function (Only needed if NOT using Firebase)
function exportDB() {
    DataService._getStaticDB().then(db => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 4));
        const anchor = document.createElement('a');
        anchor.href = dataStr;
        anchor.download = "db.json";
        anchor.click();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Security Check
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'login.html';
        return;
    }

    // Set User Name
    const userDisplay = document.querySelector('.user-info h4');
    if (userDisplay) userDisplay.textContent = localStorage.getItem('user_name') || 'Admin';

    // Set Current Date
    const dateDisplay = document.getElementById('dateDisplay');
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    }

    // --- EXPORT FUNCTIONS ---
    window.exportProductsToCSV = async () => {
        try {
            showLoading('Exporting products...');
            const products = await DataService.getCollection('products');
            hideLoading();

            if (!products.length) return showNotification('No products to export', 'error');

            const headers = ['ID', 'Name', 'Category', 'Series', 'HP', 'Price', 'Stock'];
            const rows = products.map(p => [
                p.id, p.name, p.category, p.series, p.hp, p.price, p.stock
            ].map(e => `"${e || ''}"`).join(',')); // Escape quotes

            downloadCSV([headers.join(','), ...rows].join('\n'), 'products_catalog.csv');
            showNotification('✅ Products exported successfully!', 'success');
        } catch (e) {
            hideLoading();
            showNotification('Export failed: ' + e.message, 'error');
        }
    };

    window.exportLeadsToCSV = async () => {
        try {
            showLoading('Exporting leads...');
            const leads = await DataService.getCollection('leads');
            hideLoading();

            if (!leads.length) return showNotification('No leads to export', 'error');

            const headers = ['Date', 'Client', 'Interest', 'Email', 'Phone', 'Status'];
            const rows = leads.map(l => [
                l.date, l.client, l.interest, l.contact?.email, l.contact?.phone, l.status
            ].map(e => `"${e || ''}"`).join(','));

            downloadCSV([headers.join(','), ...rows].join('\n'), 'customer_inquiries.csv');
            showNotification('✅ Leads exported successfully!', 'success');
        } catch (e) {
            hideLoading();
            showNotification('Export failed: ' + e.message, 'error');
        }
    };

    window.exportWarrantiesToCSV = async () => {
        try {
            showLoading('Exporting warranties...');
            const warranties = await DataService.getCollection('warranties');
            hideLoading();

            if (!warranties.length) return showNotification('No warranties to export', 'error');

            const headers = ['Date', 'Name', 'Product', 'Phone', 'Email', 'Address', 'Status'];
            const rows = warranties.map(w => [
                w.date, w.name, w.product, w.phone, w.email, w.address, w.status
            ].map(e => `"${e || ''}"`).join(','));

            downloadCSV([headers.join(','), ...rows].join('\n'), 'warranty_registrations.csv');
            showNotification('✅ Warranties exported successfully!', 'success');
        } catch (e) {
            hideLoading();
            showNotification('Export failed: ' + e.message, 'error');
        }
    };

    function downloadCSV(csvContent, fileName) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // --- LOADING SPINNER HELPERS ---
    window.showLoading = function (message = 'Loading...') {
        // Remove existing if any
        hideLoading();

        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
        `;

        overlay.innerHTML = `
            <div style="text-align: center;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <p style="font-size: 1.2rem; font-weight: 600;">${message}</p>
            </div>
        `;

        document.body.appendChild(overlay);
    };

    window.hideLoading = function () {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.remove();
    };

    // Mobile Sidebar Toggle
    setupMobileSidebar();

    // Logout Handler
    setupLogout();

    // Initial Data Load
    refreshDashboard();

    // View Switching
    setupViewSwitching();

    // Product Modal
    setupProductModal();

    // Initialize Analytics Charts
    setTimeout(() => initializeCharts(), 500);
});

// --- SIDEBAR & NAVIGATION ---

function setupMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

function setupLogout() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.removeAttribute('onclick'); // remove inline handler if persists
        logoutBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to logout?")) {



                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_name');
                localStorage.removeItem('static_mode');
                window.location.href = 'login.html'; // Redirect to login, not index
            }
        });
    }
}

function setupViewSwitching() {
    const menuLinks = document.querySelectorAll('.side-menu li');
    const views = document.querySelectorAll('.admin-view');
    const pageTitle = document.querySelector('.admin-header h2');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const targetView = link.getAttribute('data-view');
            if (targetView) {
                views.forEach(view => view.style.display = 'none');
                const activeView = document.getElementById(`view-${targetView}`);
                if (activeView) activeView.style.display = 'block';

                let titleText = link.innerText.trim();
                if (targetView === 'dashboard') titleText = 'Dashboard Overview';
                if (pageTitle) pageTitle.textContent = titleText;

                // Close mobile sidebar
                if (window.innerWidth <= 768) {
                    document.querySelector('.sidebar')?.classList.remove('active');
                    document.querySelector('.sidebar-overlay')?.classList.remove('active');
                }
                if (targetView === 'settings') {
                    loadSettings();
                }
                if (targetView === 'categories') {
                    loadCategories();
                }
                if (targetView === 'dashboard' && typeof refreshCharts === 'function') {
                    setTimeout(() => refreshCharts(), 100);
                }
            }
        });
    });
}

// --- FETCH DATA FROM SERVER ---

async function refreshDashboard() {
    try {
        // Fetch all data in parallel using DataService
        const [products, leads, warranties, categories] = await Promise.all([
            DataService.getCollection('products'),
            DataService.getCollection('leads'),
            DataService.getCollection('warranties'),
            DataService.getCollection('categories')
        ]);

        // Calculate Stats
        const stats = {
            products: products.length,
            monthLeads: leads.length,
            totalWarranties: warranties.length,
            newWarranties: warranties.filter(w => w.status === 'Pending').length
        };

        // Calculate Category Counts
        const categoriesWithCounts = categories.map(c => ({
            ...c,
            count: products.filter(p => p.category === c.name).length
        }));

        renderStats(stats);
        renderProducts(products);
        renderLeads(leads);
        renderWarranties(warranties);
        renderCategories(categoriesWithCounts);

        if (typeof initializeCharts === 'function') {
            setTimeout(() => initializeCharts(), 100);
        }

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        showError('Unable to load data. ' + error.message);
    }
}

function showError(message) {
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 20px;"></i>
                <p style="color: #856404; font-weight: 600;">${message}</p>
                <p style="color: #856404; margin-top: 10px;">Run: <code>node server.js</code></p>
            </div>
        `;
    }
}

// --- RENDER FUNCTIONS ---

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    if (!grid || !stats) return;

    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon blue"><i class="fa-solid fa-envelope-open-text"></i></div>
            <div class="stat-info">
                <h3>Total Inquiries</h3>
                <p>${stats.monthLeads || 0}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon teal"><i class="fa-solid fa-layer-group"></i></div>
            <div class="stat-info">
                <h3>Total Products</h3>
                <p>${stats.products || 0}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow"><i class="fa-solid fa-chart-line"></i></div>
            <div class="stat-info">
                <h3>New Today</h3>
                <p>${getTodayLeadsCount()}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i class="fa-solid fa-check-circle"></i></div>
            <div class="stat-info">
                <h3>Contacted</h3>
                <p>${getContactedCount()}</p>
            </div>
        </div>
    `;
}

function getTodayLeadsCount() {
    if (!window.allLeads) return 0;
    const today = new Date().toDateString();
    return window.allLeads.filter(lead => {
        const leadDate = new Date(lead.date);
        return leadDate.toDateString() === today;
    }).length;
}

function getContactedCount() {
    if (!window.allLeads) return 0;
    return window.allLeads.filter(lead => lead.status === 'Contacted' || lead.status === 'Sold').length;
}

// --- PRODUCT MANAGER (Pagination, Sort, Bulk) ---
const ProductManager = {
    data: [],
    page: 1,
    perPage: 10,
    filters: { search: '', category: '', stock: '' },
    sort: { col: 'id', asc: false },
    selected: new Set(),

    init(products) {
        this.data = products || [];
        // Preserve selected if possible, or clear? Clear is safer on reload.
        this.populateFilters();
        this.render();
    },

    populateFilters() {
        const cats = [...new Set(this.data.map(p => p.category).filter(Boolean))].sort();
        const select = document.getElementById('prodCatFilter');
        if (select && select.options.length <= 1) { // Only populate if empty
            select.innerHTML = '<option value="">All Categories</option>' +
                cats.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    },

    getFilteredAndSorted() {
        let filtered = this.data.filter(p => {
            const searchLower = this.filters.search.toLowerCase();
            const matchSearch = !this.filters.search ||
                (p.name && p.name.toLowerCase().includes(searchLower)) ||
                (p.series && p.series.toLowerCase().includes(searchLower));
            const matchCat = !this.filters.category || p.category === this.filters.category;
            const matchStock = !this.filters.stock || (p.stock === this.filters.stock);
            return matchSearch && matchCat && matchStock;
        });

        const { col, asc } = this.sort;
        filtered.sort((a, b) => {
            let valA = a[col] || '';
            let valB = b[col] || '';

            if (col === 'price') {
                // Clean price string "₹ 18,500" -> 18500
                valA = parseFloat(String(valA).replace(/[^0-9.]/g, '')) || 0;
                valB = parseFloat(String(valB).replace(/[^0-9.]/g, '')) || 0;
            } else if (col === 'id') {
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });

        return filtered;
    },

    render() {
        // Read Inputs (Reactive)
        this.filters.search = document.getElementById('prodSearch')?.value || '';
        this.filters.category = document.getElementById('prodCatFilter')?.value || '';
        this.filters.stock = document.getElementById('prodStockFilter')?.value || '';

        const processed = this.getFilteredAndSorted();

        // Pagination
        const total = processed.length;
        this.totalPages = Math.ceil(total / this.perPage) || 1;
        if (this.page > this.totalPages) this.page = this.totalPages;
        if (this.page < 1) this.page = 1;

        const start = (this.page - 1) * this.perPage;
        const end = start + this.perPage;
        const pageData = processed.slice(start, end);

        // Render Rows
        const tbody = document.getElementById('productTableBody');
        if (tbody) {
            if (total === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:20px;">No products found</td></tr>';
            } else {
                tbody.innerHTML = pageData.map(p => this.createRow(p)).join('');
            }
        }

        this.renderPagination(total);
        this.updateBulkUI();
    },

    createRow(p) {
        const isSel = this.selected.has(String(p.id));
        const stockClass = p.stock?.includes('In') ? 'in-stock' : (p.stock?.includes('Low') ? 'low-stock' : 'out-stock');
        return `
            <tr style="background: ${isSel ? '#f0f9ff' : 'white'}">
                <td><input type="checkbox" onchange="ProductManager.toggleOne('${p.id}')" ${isSel ? 'checked' : ''}></td>
                <td><img src="${p.image}" class="thumb" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" onerror="this.src='assets/placeholder.png'"></td>
                <td style="font-weight:600">${escapeHtml(p.name)}<div style="font-size:0.8em;color:#666">${escapeHtml(p.series)}</div></td>
                <td>${escapeHtml(p.category)}</td>
                <td>${escapeHtml(p.price)}</td>
                <td><span class="status ${stockClass}" style="font-size:0.8rem; padding:2px 6px;">${escapeHtml(p.stock)}</span></td>
                <td>
                    <button class="action-btn edit" onclick="editProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    },

    setSort(col) {
        if (this.sort.col === col) this.sort.asc = !this.sort.asc;
        else { this.sort.col = col; this.sort.asc = true; }
        this.render();
    },

    toggleAll(checkbox) {
        // Toggle all currently filtered items
        const processed = this.getFilteredAndSorted();
        processed.forEach(p => {
            if (checkbox.checked) this.selected.add(String(p.id));
            else this.selected.delete(String(p.id));
        });
        this.render();
    },

    toggleOne(id) {
        id = String(id);
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        this.render();
    },

    updateBulkUI() {
        const count = document.getElementById('prodSelectedCount');
        const box = document.getElementById('prodBulkActions');
        if (count) count.innerText = this.selected.size;
        if (box) box.style.display = this.selected.size > 0 ? 'flex' : 'none';
    },

    async deleteSelected() {
        if (!confirm(`Are you sure you want to PERMANENTLY delete ${this.selected.size} products?`)) return;
        showLoading('Deleting...');
        const ids = Array.from(this.selected);
        for (let id of ids) {
            try { await DataService.deleteItem('products', id); } catch (e) { }
        }
        this.selected.clear();
        hideLoading();
        refreshDashboard();
    },

    changePage(delta) {
        this.page += delta;
        this.render();
    },

    renderPagination(total) {
        const div = document.getElementById('prodPagination');
        if (!div) return;
        if (total === 0) { div.innerHTML = ''; return; }

        const start = (this.page - 1) * this.perPage + 1;
        const end = Math.min(this.page * this.perPage, total);

        div.innerHTML = `
             <div style="font-size:0.9rem; color:#666;">Showing <b>${start}-${end}</b> of <b>${total}</b> items</div>
             <div style="display:flex; gap:5px;">
                  <button ${this.page === 1 ? 'disabled' : ''} onclick="ProductManager.changePage(-1)"><i class="fa-solid fa-chevron-left"></i> Prev</button>
                  <button disabled style="background:#f5f5f5; color:#333;">Page ${this.page} / ${this.totalPages}</button>
                  <button ${this.page === this.totalPages ? 'disabled' : ''} onclick="ProductManager.changePage(1)">Next <i class="fa-solid fa-chevron-right"></i></button>
             </div>
         `;
    }
};


// --- LEAD MANAGER (Dates, Status, Bulk) ---
const LeadManager = {
    data: [],
    page: 1,
    perPage: 10,
    filters: { search: '', status: 'All', start: '', end: '' },
    sort: { col: 'date', asc: false },
    selected: new Set(),

    init(leads) {
        this.data = leads || [];
        this.render();
    },

    setFilterStatus(status, btn) {
        this.filters.status = status;
        // Update active btn style
        if (btn) {
            document.querySelectorAll('#view-leads .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        this.page = 1;
        this.render();
    },

    getFilteredAndSorted() {
        // Date parsing helper
        const parseDate = (d) => new Date(d).getTime();

        return this.data.filter(l => {
            // 1. Status
            if (this.filters.status !== 'All' && l.status !== this.filters.status) return false;

            // 2. Search
            if (this.filters.search) {
                const s = this.filters.search.toLowerCase();
                // Safe checks
                const matchString = (l.client || '') + (l.interest || '') + (l.contact?.email || '') + (l.contact?.phone || '');
                if (!matchString.toLowerCase().includes(s)) return false;
            }

            // 3. Date Range
            if (this.filters.start) {
                if (parseDate(l.date) < parseDate(this.filters.start)) return false;
            }
            if (this.filters.end) {
                // End date set to end of day
                let e = new Date(this.filters.end);
                e.setHours(23, 59, 59);
                if (parseDate(l.date) > e.getTime()) return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort
            const { col, asc } = this.sort;
            let valA = a[col];
            let valB = b[col];

            if (col === 'date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
    },

    render() {
        // Read Inputs
        this.filters.search = document.getElementById('leadSearch')?.value || '';
        this.filters.start = document.getElementById('leadStartDate')?.value || '';
        this.filters.end = document.getElementById('leadEndDate')?.value || '';

        const processed = this.getFilteredAndSorted();

        // Paginator logic
        const total = processed.length;
        this.totalPages = Math.ceil(total / this.perPage) || 1;
        if (this.page > this.totalPages) this.page = this.totalPages;
        if (this.page < 1) this.page = 1;

        const start = (this.page - 1) * this.perPage;
        const pageData = processed.slice(start, start + this.perPage);

        // Render Body
        const tbody = document.getElementById('leadsTableBody');
        if (tbody) {
            if (total === 0) tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px;">No leads match selection</td></tr>';
            else tbody.innerHTML = pageData.map(l => this.createRow(l)).join('');
        }

        this.renderPagination(total);
        this.updateBulkUI();
    },

    createRow(l) {
        const isSel = this.selected.has(String(l.id));
        const statusClass = l.status?.toLowerCase().includes('new') ? 'pending' : (l.status?.toLowerCase().includes('contact') ? 'contacted' : 'sold');

        return `
        <tr style="background: ${isSel ? '#e3f2fd' : 'white'}">
            <td><input type="checkbox" onchange="LeadManager.toggleOne('${l.id}')" ${isSel ? 'checked' : ''}></td>
            <td>${new Date(l.date).toLocaleDateString()}</td>
            <td><strong>${escapeHtml(l.client)}</strong><br><small>${escapeHtml(l.contact?.phone || '')}</small></td>
            <td>${escapeHtml(l.interest ? l.interest.substring(0, 30) + '...' : '')}</td>
            <td><span class="status-badge ${statusClass}">${l.status}</span></td>
            <td>
                <select onchange="updateLeadStatus('${l.id}', this.value)" style="padding:4px;" class="status-select ${statusClass}">
                    <option value="New Lead" ${l.status === 'New Lead' ? 'selected' : ''}>New</option>
                    <option value="Contacted" ${l.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="Sold" ${l.status === 'Sold' ? 'selected' : ''}>Sold</option>
                </select>
                <button class="action-btn delete" onclick="deleteLead('${l.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    },

    setSort(col) {
        if (this.sort.col === col) this.sort.asc = !this.sort.asc;
        else { this.sort.col = col; this.sort.asc = true; }
        this.render();
    },

    toggleAll(checkbox) {
        const processed = this.getFilteredAndSorted();
        processed.forEach(l => {
            if (checkbox.checked) this.selected.add(String(l.id));
            else this.selected.delete(String(l.id));
        });
        this.render();
    },

    toggleOne(id) {
        id = String(id);
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        this.render();
    },

    updateBulkUI() {
        document.getElementById('leadSelectedCount').innerText = this.selected.size;
        document.getElementById('leadBulkActions').style.display = this.selected.size > 0 ? 'flex' : 'none';
    },

    changePage(delta) {
        this.page += delta;
        this.render();
    },

    renderPagination(total) {
        const div = document.getElementById('leadPagination');
        if (!div) return;
        if (total === 0) { div.innerHTML = ''; return; }

        const start = (this.page - 1) * this.perPage + 1;
        const end = Math.min(this.page * this.perPage, total);

        div.innerHTML = `
             <div style="font-size:0.9rem; color:#666;">Showing <b>${start}-${end}</b> of <b>${total}</b> leads</div>
             <div style="display:flex; gap:5px;">
                  <button ${this.page === 1 ? 'disabled' : ''} onclick="LeadManager.changePage(-1)"><i class="fa-solid fa-chevron-left"></i> Prev</button>
                  <button disabled style="background:#f5f5f5; color:#333;">Page ${this.page} / ${this.totalPages}</button>
                  <button ${this.page === this.totalPages ? 'disabled' : ''} onclick="LeadManager.changePage(1)">Next <i class="fa-solid fa-chevron-right"></i></button>
             </div>
         `;
    },

    async deleteSelected() {
        if (!confirm(`Delete ${this.selected.size} leads?`)) return;
        showLoading('Deleting...');
        const ids = Array.from(this.selected);
        for (let id of ids) await fetch(`${API_BASE}/leads/${id}`, { method: 'DELETE', headers: DataService.getAuthHeader() });
        this.selected.clear();
        hideLoading();
        refreshDashboard();
    },

    async updateSelectedStatus() {
        const status = document.getElementById('leadBulkStatus').value;
        if (!status) return;
        showLoading('Updating...');
        const ids = Array.from(this.selected);
        // Using existing single status update logic logic or batched if available (we will loop)
        for (let id of ids) {
            await fetch(`${API_BASE}/leads/status`, {
                method: 'POST',
                headers: { ...DataService.getAuthHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
        }
        this.selected.clear();
        hideLoading();
        refreshDashboard();
    }
};

// --- ALIASES FOR LEGACY CALLS ---
function renderProducts(p) { ProductManager.init(p); }
function renderLeads(l) { LeadManager.init(l); }


// --- PRODUCT MODAL ---

function setupProductModal() {
    const modal = document.getElementById('addProductModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const form = document.getElementById('addProductForm');
    const fileInput = document.getElementById('imageFileInput');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('imagePreview');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            // Append the file explicitly if needed, but FormData(form) usually grabs named inputs
            // The file input doesn't have name="image" anymore, it has name="imageFile"
            // The text input (hidden) has name="image".
            // Server needs 'image' field for file upload? No, server expects upload.single('image')
            // So we need to ensure the file input has name="image" for multer, OR append it manually.
            // In admin.html I named file input 'name="imageFile"' and hidden 'name="image"'.
            // Multer is configured for .single('image'). So I should rename file input to 'image' in HTML? 
            // OR append it here. Let's append manually to be safe.

            // Actually, best to set file input name="image" and hidden input name="existingImage"
            // behavior in saveProduct needs adjustment.

            await saveProduct(formData);
        });
    }

    // Image Preview Logic
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    previewImg.src = e.target.result;
                    previewContainer.style.display = 'block';
                }
                reader.readAsDataURL(file);
            }
        });
    }
}

function closeModal() {
    const modal = document.getElementById('addProductModal');
    const form = document.getElementById('addProductForm');
    const previewContainer = document.getElementById('imagePreviewContainer');

    if (modal) modal.style.display = 'none';
    if (form) form.reset();
    if (previewContainer) previewContainer.style.display = 'none';
    document.body.style.overflow = '';
}

window.openAddProductModal = () => {
    const modal = document.getElementById('addProductModal');
    const form = document.getElementById('addProductForm');
    const title = document.querySelector('.modal-header h3');
    const previewContainer = document.getElementById('imagePreviewContainer');

    if (form) form.reset();
    document.getElementById('productId').value = '';
    if (previewContainer) previewContainer.style.display = 'none';

    if (title) title.textContent = 'Add New Pump';
    if (modal) modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.editProduct = async (id) => {
    try {
        const products = await DataService.getCollection('products');
        const product = products.find(p => p.id === id);

        if (!product) {
            alert('Product not found');
            return;
        }

        const modal = document.getElementById('addProductModal');
        const form = document.getElementById('addProductForm');
        const title = document.querySelector('.modal-header h3');

        document.getElementById('productId').value = product.id;
        form.name.value = product.name || '';
        form.category.value = product.category || '';
        form.series.value = product.series || '';
        form.hp.value = product.hp || '';
        form.price.value = product.price || '';
        form.stock.value = product.stock || '';

        // Handle Image Previews
        const currentImagePath = document.getElementById('currentImagePath');
        const previewContainer = document.getElementById('imagePreviewContainer');
        const previewImg = document.getElementById('imagePreview');

        if (currentImagePath) currentImagePath.value = product.image || '';
        if (product.image && previewImg) {
            previewImg.src = product.image;
            previewContainer.style.display = 'block';
        }

        if (title) title.textContent = 'Edit Product';
        if (modal) modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } catch (error) {
        showNotification('Error loading product: ' + error.message, 'error');
    }
};

async function saveProduct(formData) {
    try {
        const id = formData.get('id');

        // --- VALIDATION ---
        const name = formData.get('name');
        const priceRaw = formData.get('price');
        const stock = formData.get('stock');
        const category = formData.get('category');

        if (!name || (!category && document.getElementById('productCategory').value === '')) {
            if (document.getElementById('productCategory').value === '') alert('Please select a Category.');
            else alert('Please fill in all required fields.');
            return;
        }

        if (!stock) {
            alert('Please select a stock status.');
            return;
        }

        // Price Validation Removed: Allow text like "Call for Price" or empty string
        /* Strict validation removed per client request */

        showLoading('Saving Product...');

        if (id) {
            await DataService.updateItem('products', id, formData);
            showNotification('✅ Product updated successfully!', 'success');
        } else {
            await DataService.addItem('products', formData);
            showNotification('✅ Product added successfully!', 'success');
        }

        closeModal();
        hideLoading();
        refreshDashboard();

        // Reload Categories just in case a new category was introduced
        if (typeof loadCategories === 'function') loadCategories();
        else if (typeof refreshDashboard === 'function') setTimeout(refreshDashboard, 500);

    } catch (error) {
        hideLoading();
        showNotification('Error saving product: ' + error.message, 'error');
        console.error(error);
    }
}

window.deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        await DataService.deleteItem('products', id);
        showNotification('✅ Product deleted successfully!', 'success');
        refreshDashboard();
        loadCategories(); // Update category counts
    } catch (error) {
        showNotification('Error deleting product: ' + error.message, 'error');
    }
};

window.updateLeadStatus = async (id, newStatus) => {
    // Note: event.target might not be available if called programmatically, but usually is from onchange
    // If we want visual feedback on the select element specifically without full refresh, we could keep it,
    // but refreshDashboard() is safer to ensure consistency.
    try {
        await DataService.updateItem('leads', id, { status: newStatus });

        // Visual feedback
        if (event && event.target) {
            const select = event.target;
            select.style.backgroundColor = '#d4edda';
            setTimeout(() => select.style.backgroundColor = '', 800);
        } else {
            showNotification('Status updated', 'success');
        }
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
};

window.deleteLead = async (id) => {
    if (!confirm('Are you sure you want to delete this inquiry? This action cannot be undone.')) return;

    try {
        await DataService.deleteItem('leads', id);
        showNotification('✅ Inquiry deleted successfully!', 'success');
        refreshDashboard();
    } catch (error) {
        alert('❌ Error deleting inquiry: ' + error.message);
    }
};

// --- SETTINGS ---

window.saveSettings = async function () {
    const settings = {
        id: 'global',
        siteName: document.getElementById('siteName')?.value,
        adminEmail: document.getElementById('adminEmail')?.value,
        contactPhone: document.getElementById('contactPhone')?.value,
        seoTitle: document.getElementById('seoTitle')?.value,
        seoDescription: document.getElementById('seoDescription')?.value,
        seoKeywords: document.getElementById('seoKeywords')?.value,
        ogImage: document.getElementById('ogImage')?.value,
        gaId: document.getElementById('gaId')?.value,
        fbPixel: document.getElementById('fbPixel')?.value
    };

    try {
        await DataService.addItem('settings', settings);

        // Local Backup
        localStorage.setItem('varshini_settings', JSON.stringify(settings));

        showNotification('✅ Settings saved successfully!', 'success');

        // Visual Button Feedback
        const btn = event?.target || document.querySelector('.settings-header .btn-primary');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            setTimeout(() => btn.innerHTML = original, 2000);
        }

    } catch (e) {
        showNotification('Error saving settings: ' + e.message, 'error');
    }
};

window.changePassword = async function () {
    const currentPass = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (!newPass || !confirmPass) {
        showNotification("Please fill in all password fields.", 'error');
        return;
    }

    if (newPass.length < 6) {
        showNotification("Password should be at least 6 characters.", 'error');
        return;
    }

    if (newPass !== confirmPass) {
        showNotification("New passwords do not match.", 'error');
        return;
    }

    // Secure API Update
    try {
        const headers = DataService.getAuthHeader();
        headers['Content-Type'] = 'application/json';

        const res = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
        });
        const data = await res.json();

        if (data.success) {
            showNotification("✅ Password updated successfully!", 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
        } else {
            showNotification("Error: " + data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showNotification("Server Error: Unable to update password.", 'error');
    }
};

window.resetSettings = function () {
    if (!confirm('Reset all settings to defaults?')) return;
    localStorage.removeItem('varshini_settings');
    location.reload();
};

window.loadSettings = async function () {
    try {
        const settingsCollection = await DataService.getCollection('settings');
        let settings = settingsCollection.find(s => s.id === 'global');

        // Fallback to localStorage if not found in DB
        if (!settings) {
            settings = JSON.parse(localStorage.getItem('varshini_settings'));
        }

        if (settings) {
            if (document.getElementById('siteName')) document.getElementById('siteName').value = settings.siteName || '';
            if (document.getElementById('adminEmail')) document.getElementById('adminEmail').value = settings.adminEmail || '';
            if (document.getElementById('contactPhone')) document.getElementById('contactPhone').value = settings.contactPhone || '';
            if (document.getElementById('seoTitle')) document.getElementById('seoTitle').value = settings.seoTitle || '';
            if (document.getElementById('seoDescription')) document.getElementById('seoDescription').value = settings.seoDescription || '';
            if (document.getElementById('seoKeywords')) document.getElementById('seoKeywords').value = settings.seoKeywords || '';
            if (document.getElementById('ogImage')) document.getElementById('ogImage').value = settings.ogImage || '';
            if (document.getElementById('gaId')) document.getElementById('gaId').value = settings.gaId || '';
            if (document.getElementById('fbPixel')) document.getElementById('fbPixel').value = settings.fbPixel || '';
        }
    } catch (e) {
        console.error("Error loading settings:", e);
    }
};



window.exportLeadsToCSV = function () {
    fetch(`${API_BASE}/dashboard`, { headers: getAuthHeader() })
        .then(res => handleResponse(res))
        .then(res => res.json())
        .then(data => {
            const leads = data.leads || [];
            if (leads.length === 0) {
                alert('No leads to export!');
                return;
            }

            // CSV Headers
            const headers = ['Date', 'Client Name', 'Email', 'Phone', 'Interest', 'Message', 'Status'];

            // CSV Rows
            const rows = leads.map(lead => [
                lead.date || 'N/A',
                lead.client || 'Unknown',
                lead.contact?.email || 'N/A',
                lead.contact?.phone || 'N/A',
                lead.interest || 'N/A',
                (lead.interest || '').replace(/^Enquiry:\s*/, '').replace(/\.\.\.$/, ''),
                lead.status || 'New Lead'
            ]);

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Download
            downloadCSV(csvContent, `Varshini_Leads_${new Date().toISOString().split('T')[0]}.csv`);

            // Show success message
            showNotification('✅ Leads exported successfully!', 'success');
        })
        .catch(err => {
            alert('Error exporting leads: ' + err.message);
        });
};

window.exportProductsToCSV = function () {
    fetch(`${API_BASE}/dashboard`, { headers: getAuthHeader() })
        .then(res => handleResponse(res))
        .then(res => res.json())
        .then(data => {
            const products = data.products || [];
            if (products.length === 0) {
                alert('No products to export!');
                return;
            }

            // CSV Headers
            const headers = ['ID', 'Product Name', 'Series', 'Category', 'HP/Spec', 'Price', 'Stock Status'];

            // CSV Rows
            const rows = products.map(p => [
                p.id || '',
                p.name || '',
                p.series || '',
                p.category || 'Uncategorized',
                p.hp || '',
                p.price || '',
                p.stock || 'Unknown'
            ]);

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Download
            downloadCSV(csvContent, `Varshini_Products_${new Date().toISOString().split('T')[0]}.csv`);

            // Show success message
            showNotification('✅ Products exported successfully!', 'success');
        })
        .catch(err => {
            alert('Error exporting products: ' + err.message);
        });
};

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#007bff'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// --- LEAD FILTERING AND SEARCH ---

// Cache for filtering - stored in window.allLeads

window.filterLeads = function (status) {
    if (!window.allLeads || !window.allLeads.length) return;

    const filtered = status === 'all'
        ? window.allLeads
        : window.allLeads.filter(lead => lead.status === status);

    renderLeads(filtered);

    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });
};

window.searchLeads = function (query) {
    if (!window.allLeads || !window.allLeads.length) return;

    const searchTerm = query.toLowerCase();
    const filtered = window.allLeads.filter(lead =>
        (lead.client || '').toLowerCase().includes(searchTerm) ||
        (lead.interest || '').toLowerCase().includes(searchTerm) ||
        (lead.contact?.email || '').toLowerCase().includes(searchTerm) ||
        (lead.contact?.phone || '').toLowerCase().includes(searchTerm)
    );

    renderLeads(filtered);
};

// --- CATEGORY MANAGEMENT ---
async function loadCategories() {
    try {
        // The /api/categories endpoint already returns categories with counts
        // No need to fetch products separately
        const categories = await DataService.getCollection('categories');

        renderCategories(categories);
        populateCategoryDropdown(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategories(categories) {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    if (!categories || categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No categories found in database.</td></tr>';
        return;
    }

    tbody.innerHTML = categories.map(c => `
        <tr>
            <td data-label="Name" style="font-weight:600; color:#0A2540;">${c.name}</td>
            <td data-label="Count"><span class="status" style="background:#eaf4ff; color:#0077b6;">${c.count || 0} Products</span></td>
            <td data-label="Actions">
                <button class="action-btn delete" onclick="deleteCategory(${c.id})" title="Delete Category (Only if empty)">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function populateCategoryDropdown(categories) {
    const select = document.getElementById('productCategory');
    const filter = document.getElementById('prodCatFilter');

    // Create Options HTML
    const optionsHtml = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    // 1. Update Product Modal Dropdown
    if (select) {
        select.innerHTML = '<option value="">Select Category</option>' + optionsHtml;
    }

    // 2. Update Product Filter Dropdown (in Unified Product View)
    if (filter) {
        // Preserve current selection if possible
        const current = filter.value;
        filter.innerHTML = '<option value="">All Categories</option>' + optionsHtml;
        filter.value = current;
    }
}

// -------------------------------------------------------------
// CATEGORY ACTIONS (Add/Delete)
// -------------------------------------------------------------

window.openAddCategoryModal = () => {
    const modal = document.getElementById('addCategoryModal');
    if (modal) modal.style.display = 'flex';
};

window.closeCategoryModal = () => {
    const modal = document.getElementById('addCategoryModal');
    const form = document.getElementById('addCategoryForm');
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
};

// Form Handler - Add Category
const catForm = document.getElementById('addCategoryForm');
if (catForm) {
    // Remove existing listeners to avoid duplicates if this file re-runs
    catForm.replaceWith(catForm.cloneNode(true));
    // Re-select after clone
    document.getElementById('addCategoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const name = form.name.value.trim();

        if (!name) { alert("Category name is required"); return; }

        showLoading('Adding Category...');
        try {
            await DataService.addItem('categories', { name });
            showNotification('✅ Category added successfully!', 'success');
            closeCategoryModal();
            loadCategories();
        } catch (err) {
            alert(err.message);
        }
        hideLoading();
    });
}


window.deleteCategory = async (id) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    showLoading('Deleting...');
    try {
        await DataService.deleteItem('categories', id);
        showNotification('Category deleted', 'success');
        loadCategories();
    } catch (err) {
        // Server will return 400 if products exist in category, so message helps
        alert("Cannot delete: " + (err.message || "Ensure no products are in this category first."));
    }
    hideLoading();
};

// Load categories on start
// --- WARRANTY REQUESTS ---

async function loadWarranties() {
    try {
        const warranties = await DataService.getCollection('warranties');
        renderWarranties(warranties);
    } catch (error) {
        console.error('Error loading warranties:', error);
    }
}

function renderWarranties(warranties) {
    const tbody = document.getElementById('warrantiesTableBody');
    if (!tbody) return;

    if (Array.isArray(warranties) && warranties.length > 0) {
        window.allWarranties = warranties;
    } else if (!window.allWarranties || window.allWarranties.length === 0) {
        window.allWarranties = [];
    }

    if (!warranties || warranties.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No warranty requests found.</td></tr>';
        return;
    }

    tbody.innerHTML = warranties.map(d => {
        const date = d.date ? new Date(d.date).toLocaleDateString() : 'N/A';
        const color = d.status === 'Approved' ? '#28a745' : d.status === 'Rejected' ? '#dc3545' : '#ffc107';
        const textCol = d.status === 'Pending' ? '#000' : '#fff';

        return `
        <tr>
            <td data-label="Date">${date}</td>
            <td data-label="Customer">
                <strong>${d.name || 'Unknown'}</strong><br>
                <small style="color:#666">${d.city || ''}</small>
            </td>
            <td data-label="Contact">
                <i class="fa-solid fa-phone"></i> ${d.phone}<br>
                <a href="mailto:${d.email}" style="color:#00B4D8;">${d.email || ''}</a>
            </td>
            <td data-label="Address">${d.product ? '<strong>' + d.product + '</strong><br>' : ''}${d.address || d.message || 'N/A'}</td>
            <td data-label="Status">
                <span style="background: ${color}; color: ${textCol}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                    ${d.status}
                </span>
            </td>
            <td data-label="Actions">
                 <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${d.status !== 'Approved' ? `<button class="action-btn" onclick="updateWarrantyStatus(${d.id}, 'Approved')" title="Approve" style="background:#28a745; color:white;"><i class="fa-solid fa-check"></i></button>` : ''}
                    ${d.status !== 'Rejected' ? `<button class="action-btn" onclick="updateWarrantyStatus(${d.id}, 'Rejected')" title="Reject" style="background:#dc3545; color:white;"><i class="fa-solid fa-ban"></i></button>` : ''}
                    <button class="action-btn delete" onclick="deleteWarranty(${d.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

window.filterWarranties = function (status, btn) {
    if (!window.allWarranties) return;
    const filtered = status === 'all'
        ? window.allWarranties
        : window.allWarranties.filter(d => d.status === status);
    renderWarranties(filtered);

    // Update active UI
    if (btn) {
        // Find parent group and remove active from siblings
        const group = btn.parentElement;
        if (group) {
            group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        }
        btn.classList.add('active');
    }
};

window.updateWarrantyStatus = async (id, newStatus) => {
    try {
        await DataService.updateItem('warranties', id, { status: newStatus });
        showNotification('Status updated!', 'success');
        refreshDashboard();
    } catch (error) {
        showNotification('Error updating status: ' + error.message, 'error');
    }
}

window.deleteWarranty = async (id) => {
    if (!confirm('Delete this warranty request?')) return;
    try {
        await DataService.deleteItem('warranties', id);
        showNotification('Request deleted!', 'success');
        refreshDashboard();
    } catch (er) {
        showNotification('Error: ' + er.message, 'error');
    }
}

// INITIAL LOAD
// INITIAL LOAD
loadCategories();
loadWarranties();

// --- CATEGORY ACTIONS ---

// --- CATEGORY ACTIONS ---

const addCategoryForm = document.getElementById('addCategoryForm');
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = addCategoryForm.name.value.trim();
        const id = addCategoryForm.id.value; // Support Edit

        if (!name) return;

        try {
            if (id) {
                // Update
                await DataService.updateItem('categories', id, { name });
                showNotification('✅ Category updated!', 'success');
            } else {
                // Create
                const categories = await DataService.getCollection('categories');
                if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                    showNotification('Category already exists', 'error');
                    return;
                }
                await DataService.addItem('categories', { id: Date.now(), name });
                showNotification('✅ Category added!', 'success');
            }

            closeCategoryModal();
            loadCategories();
        } catch (error) {
            showNotification('Error saving category: ' + error.message, 'error');
        }
    });

    // Reset ID on close
}

window.closeCategoryModal = function () {
    const modal = document.getElementById('addCategoryModal');
    const form = document.getElementById('addCategoryForm');
    if (modal) modal.style.display = 'none';
    if (form) {
        form.reset();
        form.id.value = ''; // Clear ID for next time (switch back to Add mode)
    }
    const title = document.querySelector('#addCategoryModal h3');
    if (title) title.textContent = 'Add New Category';
};

window.openEditCategoryModal = async (id) => {
    const categories = await DataService.getCollection('categories');
    const cat = categories.find(c => c.id == id);
    if (!cat) return;

    const modal = document.getElementById('addCategoryModal');
    const form = document.getElementById('addCategoryForm');
    const title = document.querySelector('#addCategoryModal h3');

    if (form) {
        form.name.value = cat.name;
        form.id.value = cat.id;
    }
    if (title) title.textContent = 'Edit Category';
    if (modal) modal.style.display = 'flex';
};

window.deleteCategory = async (id) => {
    if (!confirm('Delete this category? This cannot be undone.')) return;

    try {
        const categories = await DataService.getCollection('categories');
        const products = await DataService.getCollection('products');

        const category = categories.find(c => c.id === id);
        if (!category) return;

        if (products.some(p => p.category === category.name)) {
            showNotification('Cannot delete: Category has products.', 'error');
            return;
        }

        await DataService.deleteItem('categories', id);
        showNotification('✅ Category deleted!', 'success');
        loadCategories();
    } catch (error) {
        showNotification('Error deleting category: ' + error.message, 'error');
    }
};

// --- MIGRATION UTILITY ---
// --- MIGRATION UTILITY ---


window.openAddCategoryModal = () => {
    const modal = document.getElementById('addCategoryModal');
    if (modal) modal.style.display = 'flex';
};
