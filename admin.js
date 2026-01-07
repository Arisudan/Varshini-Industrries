
// Admin Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {

    // 0. Initial Check (Secure Session)
    checkAuth();

    // 1. Set Date
    const dateDisplay = document.getElementById('dateDisplay');
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    }

    // 2. Fetch Data
    fetchDashboardData();

    // 5. Mobile Sidebar Toggle
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

    // Logout Handler
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.removeAttribute('onclick'); // Remove inline handler
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/logout', { method: 'POST' });
                localStorage.removeItem('titan_user'); // Clear UI cache
                window.location.href = 'index.html';
            } catch (err) {
                console.error('Logout failed', err);
                window.location.href = 'index.html';
            }
        });
    }



    async function checkAuth() {
        try {
            const res = await fetch('/api/check-auth');
            const data = await res.json();

            if (!data.authenticated) {
                window.location.href = 'login.html';
            } else {
                // Update UI with user info
                const userDisplay = document.querySelector('.user-info h4');
                if (userDisplay && data.user) userDisplay.textContent = data.user.name || 'Admin';
            }
        } catch (err) {
            console.error('Auth check failed', err);
            window.location.href = 'login.html';
        }
    }

    // Sidebar View Switching
    const menuLinks = document.querySelectorAll('.side-menu li');
    const views = document.querySelectorAll('.admin-view');
    const pageTitle = document.querySelector('.admin-header h2'); // Assuming I added ID, but I can target by hierarchy

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent jump behavior

            // 1. Navigation State
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // 2. View Switching
            const targetView = link.getAttribute('data-view');
            if (targetView) {
                views.forEach(view => view.style.display = 'none');
                const activeView = document.getElementById(`view-${targetView}`);
                if (activeView) activeView.style.display = 'block';

                // 3. Update Title based on link text
                // Simple logic: get text, remove badge text if any
                let titleText = link.innerText.replace('3 New', '').trim();
                // Special case for dashboard
                if (targetView === 'dashboard') titleText = 'Dashboard Overview';

                if (pageTitle) pageTitle.textContent = titleText;

                // 4. Mobile: Close sidebar after selection
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                }
            }
        });
    });

    // 6. Modal Logic
    const modal = document.getElementById('addProductModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const form = document.getElementById('addProductForm');
    const modalTitle = document.querySelector('.modal-header h3');

    // Open for Adding
    window.openAddProductModal = () => {
        if (form) form.reset();
        document.getElementById('productId').value = ''; // Clear ID
        if (modalTitle) modalTitle.textContent = 'Add New Pump';
        if (modal) modal.style.display = 'flex';
    };

    // Open for Editing
    window.openEditProductModal = (id, name, series, hp, price, stock, image) => {
        if (form) form.reset();
        document.getElementById('productId').value = id;
        form.name.value = name;
        form.series.value = series;
        form.hp.value = hp;
        form.price.value = price;
        form.stock.value = stock;
        form.image.value = image;

        if (modalTitle) modalTitle.textContent = 'Edit Product';
        if (modal) modal.style.display = 'flex';
    };

    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        if (form) form.reset();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Handle Form Submit (Add OR Edit)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const product = Object.fromEntries(formData.entries());
            const id = product.id; // Check if ID exists (Edit Mode)

            const url = id ? `/api/products/${id}` : '/api/products';
            const method = id ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(product)
                });
                const data = await res.json();

                if (data.success) {
                    closeModal();
                    fetchDashboardData();
                    alert(id ? 'Product Updated Successfully!' : 'Product Added Successfully!');
                } else {
                    alert('Error saving product');
                }
            } catch (err) {
                console.error(err);
                alert('Connection Error: ' + err.message);
            }
        });
    }

});

async function fetchDashboardData() {
    try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();

        renderStats(data.stats);
        renderProducts(data.products);
        renderLeads(data.leads);

    } catch (err) {
        console.error('Failed to load dashboard data:', err);
    }
}

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    if (!grid || !stats) return;

    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon teal"><i class="fa-solid fa-handshake"></i></div>
            <div class="stat-info">
                <h3>Total Dealers</h3>
                <p>${stats.dealers.toLocaleString()}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow"><i class="fa-solid fa-box"></i></div>
            <div class="stat-info">
                <h3>Pending Orders</h3>
                <p>${stats.pendingOrders}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue"><i class="fa-solid fa-bullhorn"></i></div>
            <div class="stat-info">
                <h3>Month's Leads</h3>
                <p>${stats.monthLeads}</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon dark"><i class="fa-solid fa-layer-group"></i></div>
            <div class="stat-info">
                <h3>Total Products</h3>
                <p>${stats.products}</p>
            </div>
        </div>
    `;
}

function renderProducts(products) {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    tbody.innerHTML = products.map(p => `
        <tr data-id="${p.id}">
            <td><img src="${p.image}" alt="Pump" class="thumb" onerror="this.src='https://via.placeholder.com/50'"></td>
            <td><strong>${p.name}</strong><br><small>${p.series}</small></td>
            <td>${p.hp}</td>
            <td>₹ ${p.price}</td>
            <td><span class="status ${p.stock === 'In Stock' ? 'in-stock' : 'low-stock'}">${p.stock}</span></td>
            <td>
                <button class="action-btn edit" 
                    onclick="openEditProductModal('${p.id}', '${p.name}', '${p.series}', '${p.hp}', '${p.price}', '${p.stock}', '${p.image || ''}')">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="action-btn delete" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderLeads(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    tbody.innerHTML = leads.map(l => {
        let statusClass = 'pending'; // default
        if (l.status.toLowerCase().includes('contact')) statusClass = 'contacted';
        if (l.status.toLowerCase().includes('sold')) statusClass = 'sold';

        return `
        <tr>
            <td>${l.date}</td>
            <td>${l.client}</td>
            <td>${l.interest}</td>
            <td>
                <select class="status-select ${statusClass}" onchange="updateLeadStatus(${l.id}, this)">
                    <option value="New Lead" ${l.status === 'New Lead' ? 'selected' : ''}>New Lead</option>
                    <option value="Contacted" ${l.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="Sold" ${l.status === 'Sold' ? 'selected' : ''}>Sold</option>
                </select>
            </td>
        </tr>
        `;
    }).join('');
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to PERMANENTLY delete this product?')) return;

    try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            // Remove from DOM immediately
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) row.remove();

            // Optionally update stats count
            // fetchDashboardData(); // OR just reload page to be safe
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Error deleting product');
    }
}

async function updateLeadStatus(id, selectElement) {
    const newStatus = selectElement.value;

    // Optimistic UI update for color
    selectElement.className = 'status-select';
    if (newStatus.toLowerCase().includes('new')) selectElement.classList.add('pending');
    else if (newStatus.toLowerCase().includes('contact')) selectElement.classList.add('contacted');
    else if (newStatus.toLowerCase().includes('sold')) selectElement.classList.add('sold');

    try {
        await fetch('/api/leads/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });

        // Success feedback
        selectElement.style.backgroundColor = '#d4edda';
        setTimeout(() => selectElement.style.backgroundColor = '', 500);

    } catch (err) {
        alert('Failed to update status');
        // Revert UI if needed
    }
}
