
// Admin Dashboard Logic (GitHub Pages Static Version)

document.addEventListener('DOMContentLoaded', () => {

    // 0. Initial Check (Secure Session)
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'login.html';
        return;
    }

    // Set User Name
    const userDisplay = document.querySelector('.user-info h4');
    if (userDisplay) userDisplay.textContent = localStorage.getItem('user_name') || 'Admin';


    // 1. Set Date
    const dateDisplay = document.getElementById('dateDisplay');
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    }

    // Initialize Mock DB if empty
    initMockDB();

    // 2. Fetch Data (from LocalStorage)
    refreshDashboard();

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
        logoutBtn.removeAttribute('onclick');
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_name');
            window.location.href = 'index.html';
        });
    }

    // Sidebar View Switching
    const menuLinks = document.querySelectorAll('.side-menu li');
    const views = document.querySelectorAll('.admin-view');
    const pageTitle = document.querySelector('.admin-header h2');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

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

    // Handle Form Submit (Add OR Edit) -> LocalStorage
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const product = Object.fromEntries(formData.entries());
            const id = product.id;

            // Get DB
            const db = getMockDB();

            if (id) {
                // Edit
                const index = db.products.findIndex(p => p.id == id);
                if (index !== -1) {
                    db.products[index] = { ...db.products[index], ...product, id: parseInt(id) };
                }
            } else {
                // Add
                product.id = Date.now(); // Simple ID
                db.products.push({ ...product, id: parseInt(product.id) });
            }

            saveMockDB(db);
            closeModal();
            refreshDashboard();
            alert(id ? 'Product Updated Locally!' : 'Product Added Locally!');
        });
    }

});

// --- CLIENT SIDE MOCK DB FUNCTIONS ---

function initMockDB() {
    if (!localStorage.getItem('titan_mock_db')) {
        const initialData = {
            products: [
                { id: 101, name: 'Titan V6-500', series: 'Stainless Series', hp: '5.0 HP', price: '18,500', stock: 'In Stock', image: 'https://via.placeholder.com/150' },
                { id: 102, name: 'AquaFlow 200', series: 'Monoblock', hp: '2.0 HP', price: '12,200', stock: 'Low Stock', image: 'https://via.placeholder.com/150' },
                { id: 103, name: 'DeepWell X', series: 'Submersible', hp: '7.5 HP', price: '24,000', stock: 'Out of Stock', image: 'https://via.placeholder.com/150' }
            ],
            leads: [
                { id: 1, date: '2026-10-25', client: 'Ramesh Construction', interest: 'Bulk Order (10 Pumps)', status: 'New Lead' },
                { id: 2, date: '2026-10-24', client: 'Green Farms Ltd', interest: 'Solar Series Inquiry', status: 'Contacted' },
                { id: 3, date: '2026-10-22', client: 'City Homes', interest: 'Pressure Boosters', status: 'Sold' },
                { id: 4, date: '2026-10-21', client: 'Individual', interest: 'Domestic Pump', status: 'New Lead' }
            ],
            stats: {
                dealers: 42,
                pendingOrders: 15,
                monthLeads: 8, // Calc dynamic? Simple hardcode for now or calc from leads length
                products: 3
            }
        };
        localStorage.setItem('titan_mock_db', JSON.stringify(initialData));
    }
}

function getMockDB() {
    return JSON.parse(localStorage.getItem('titan_mock_db'));
}

function saveMockDB(db) {
    localStorage.setItem('titan_mock_db', JSON.stringify(db));
}

function refreshDashboard() {
    const db = getMockDB();

    // Recalc basic stats
    db.stats.products = db.products.length;
    db.stats.monthLeads = db.leads.length;

    renderStats(db.stats);
    renderProducts(db.products);
    renderLeads(db.leads);
}

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    if (!grid || !stats) return;

    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon teal"><i class="fa-solid fa-handshake"></i></div>
            <div class="stat-info">
                <h3>Total Dealers</h3>
                <p>${stats.dealers}</p>
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
                <h3>Total Leads</h3>
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

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No Products Found.</td></tr>';
        return;
    }

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

window.deleteProduct = function (id) {
    if (!confirm('Permanently delete this product from Local DB?')) return;
    const db = getMockDB();
    db.products = db.products.filter(p => p.id != id);
    saveMockDB(db);
    refreshDashboard();
};

window.updateLeadStatus = function (id, selectElement) {
    const newStatus = selectElement.value;

    // UI Update
    selectElement.className = 'status-select';
    if (newStatus.toLowerCase().includes('new')) selectElement.classList.add('pending');
    else if (newStatus.toLowerCase().includes('contact')) selectElement.classList.add('contacted');
    else if (newStatus.toLowerCase().includes('sold')) selectElement.classList.add('sold');

    // DB Update
    const db = getMockDB();
    const leadIndex = db.leads.findIndex(l => l.id == id);
    if (leadIndex !== -1) {
        db.leads[leadIndex].status = newStatus;
        saveMockDB(db);

        // Success Flash
        selectElement.style.backgroundColor = '#d4edda';
        setTimeout(() => selectElement.style.backgroundColor = '', 500);
    }
};
