
// Admin Dashboard - Works with Express Server API

const API_BASE = 'http://localhost:3000/api';

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

    // Load Dashboard Data
    refreshDashboard();

    // Mobile Sidebar Toggle
    setupMobileSidebar();

    // Logout Handler
    setupLogout();

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
        logoutBtn.removeAttribute('onclick');
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_name');
            window.location.href = 'index.html';
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
            }
        });
    });
}

// --- FETCH DATA FROM SERVER ---

async function refreshDashboard() {
    try {
        // Use the /dashboard endpoint that returns everything
        const response = await fetch(`${API_BASE}/dashboard`);

        if (!response.ok) {
            throw new Error('Server returned ' + response.status);
        }

        const data = await response.json();

        renderStats(data.stats);
        renderProducts(data.products);
        renderLeads(data.leads);

        // Initialize charts after data is loaded
        if (typeof initializeCharts === 'function') {
            setTimeout(() => initializeCharts(), 100);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Unable to connect to database. Please ensure the server is running on port 3000.');
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

function renderProducts(products) {
    const container = document.getElementById('productCatalogContainer');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color: #888;">No Products Found</p>';
        return;
    }

    // Group Products by Category
    const grouped = {};
    products.forEach(p => {
        const cat = p.category || 'Uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    // Clear Container
    container.innerHTML = '';

    // Render each category group
    Object.keys(grouped).sort().forEach(category => {
        const categoryProducts = grouped[category];

        // Create Section
        const section = document.createElement('div');
        section.style.marginBottom = '30px';

        // Header
        const header = document.createElement('h3');
        header.style.color = '#0077b6';
        header.style.borderBottom = '2px solid #caf0f8';
        header.style.paddingBottom = '10px';
        header.style.marginBottom = '15px';
        header.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${category} <span style="font-size: 0.8rem; color: #666; font-weight: normal;">(${categoryProducts.length})</span>`;
        section.appendChild(header);

        // Table Wrapper
        const tableResp = document.createElement('div');
        tableResp.className = 'table-responsive';

        // Table HTML
        const rows = categoryProducts.map(p => {
            const stockClass = p.stock?.toLowerCase().includes('in stock') ? 'in-stock' :
                p.stock?.toLowerCase().includes('low') ? 'low-stock' : 'out-stock';

            return `
            <tr>
                <td><img src="${p.image || 'assets/placeholder.png'}" alt="${p.name}" class="thumb" 
                     onerror="this.src='https://via.placeholder.com/50?text=No+Image'" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td><strong>${p.name}</strong><br><small style="color: #666;">${p.series || 'N/A'}</small></td>
                <td>${p.hp || 'N/A'}</td>
                <td style="font-weight: 600;">${p.price || 'N/A'}</td>
                <td><span class="status ${stockClass}">${p.stock || 'Unknown'}</span></td>
                <td>
                    <button class="action-btn edit" onclick="editProduct(${p.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete" onclick="deleteProduct(${p.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
            `;
        }).join('');

        tableResp.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 80px;">Image</th>
                        <th style="width: 25%;">Model Name</th>
                        <th>HP / Spec</th>
                        <th>Price (INR)</th>
                        <th>Stock Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        section.appendChild(tableResp);
        container.appendChild(section);
    });
}

function renderLeads(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    // Cache leads for filtering/search
    if (Array.isArray(leads) && leads.length > 0) {
        window.allLeads = leads;
    }

    if (!leads || leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color: #888;">No Inquiries Yet</td></tr>';
        return;
    }

    tbody.innerHTML = leads.map(l => {
        const statusClass = l.status?.toLowerCase().includes('new') ? 'pending' :
            l.status?.toLowerCase().includes('contact') ? 'contacted' : 'sold';

        return `
        <tr>
            <td>${l.date || 'N/A'}</td>
            <td>${l.client || 'Unknown'}</td>
            <td>${l.interest || 'General Inquiry'}</td>
            <td>
                <select class="status-select ${statusClass}" onchange="updateLeadStatus('${l.id}', this.value)">
                    <option value="New Lead" ${l.status === 'New Lead' ? 'selected' : ''}>New Lead</option>
                    <option value="Contacted" ${l.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="Sold" ${l.status === 'Sold' ? 'selected' : ''}>Sold</option>
                </select>
            </td>
            <td>
                <button class="action-btn delete" onclick="deleteLead('${l.id}')" title="Delete Inquiry">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

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
};

window.editProduct = async (id) => {
    try {
        // Fetch all products and find the one with matching ID
        const response = await fetch(`${API_BASE}/dashboard`);
        const data = await response.json();
        const product = data.products.find(p => p.id === id);

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
    } catch (error) {
        alert('Error loading product: ' + error.message);
    }
};

async function saveProduct(formData) {
    const id = formData.get('id');

    try {
        if (id) {
            // Update existing product
            const response = await fetch(`${API_BASE}/products/${id}`, {
                method: 'PUT',
                body: formData // Send FormData directly for Multer
            });

            if (response.ok) {
                alert('✅ Product updated successfully!');
            } else {
                throw new Error('Server error');
            }
        } else {
            // Add new product
            const response = await fetch(`${API_BASE}/products`, {
                method: 'POST',
                body: formData // Send FormData directly for Multer
            });

            if (response.ok) {
                alert('✅ Product added successfully!');
            } else {
                throw new Error('Server error');
            }
        }

        closeModal();
        refreshDashboard();
    } catch (error) {
        alert('❌ Error saving product: ' + error.message);
    }
}

window.deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/products/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('✅ Product deleted successfully!');
            refreshDashboard();
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        alert('❌ Error deleting product: ' + error.message);
    }
};

window.updateLeadStatus = async (id, newStatus) => {
    try {
        const response = await fetch(`${API_BASE}/leads/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });

        if (response.ok) {
            // Visual feedback
            const select = event.target;
            select.style.backgroundColor = '#d4edda';
            setTimeout(() => select.style.backgroundColor = '', 800);
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
};

window.deleteLead = async (id) => {
    if (!confirm('Are you sure you want to delete this inquiry? This action cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/leads/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('✅ Inquiry deleted successfully!', 'success');
            refreshDashboard();
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        alert('❌ Error deleting inquiry: ' + error.message);
    }
};

// --- SETTINGS ---

window.saveSettings = function () {
    const settings = {
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

    localStorage.setItem('varshini_settings', JSON.stringify(settings));

    const btn = event.target;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
    btn.style.backgroundColor = '#28a745';

    setTimeout(() => {
        btn.innerHTML = original;
        btn.style.backgroundColor = '';
    }, 2000);

    alert('✅ Settings saved! Note: SEO changes require manual HTML updates.');
};

window.resetSettings = function () {
    if (!confirm('Reset all settings to defaults?')) return;
    localStorage.removeItem('varshini_settings');
    location.reload();
};

// --- CSV EXPORT FUNCTIONALITY ---

window.exportLeadsToCSV = function () {
    fetch(`${API_BASE}/dashboard`)
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
    fetch(`${API_BASE}/dashboard`)
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
        const response = await fetch(`${API_BASE}/categories`);
        const categories = await response.json();
        renderCategories(categories);
        populateCategoryDropdown(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategories(categories) {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No categories found</td></tr>';
        return;
    }

    tbody.innerHTML = categories.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.count || 0} Products</td>
            <td>
                <button class="action-btn delete" onclick="deleteCategory(${c.id})" title="Delete Category">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function populateCategoryDropdown(categories) {
    const select = document.getElementById('productCategory');
    if (!select) return;

    // Keep first option (Select Category)
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);

    categories.forEach(c => {
        const option = document.createElement('option');
        option.value = c.name;
        option.textContent = c.name;
        select.appendChild(option);
    });
}

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

// Add Category Form Submit
const addCategoryForm = document.getElementById('addCategoryForm');
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addCategoryForm);
        const name = formData.get('name');

        try {
            const response = await fetch(`${API_BASE}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (response.ok) {
                closeCategoryModal();
                loadCategories(); // Refresh list and dropdown
                alert('✅ Category added successfully!');
            } else {
                throw new Error(data.message || 'Server error');
            }
        } catch (error) {
            alert('❌ Error adding category: ' + error.message);
        }
    });
}

window.deleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
        const response = await fetch(`${API_BASE}/categories/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            loadCategories();
            alert('✅ Category deleted successfully!');
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (error) {
        alert('❌ Error deleting category: ' + error.message);
    }
};

// Load categories on start
// --- WARRANTY REQUESTS ---

async function loadWarranties() {
    try {
        const response = await fetch(`${API_BASE}/warranties`);
        const warranties = await response.json();
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
            <td>${date}</td>
            <td>
                <strong>${d.name || 'Unknown'}</strong><br>
                <small style="color:#666">${d.city || ''}</small>
            </td>
            <td>
                <i class="fa-solid fa-phone"></i> ${d.phone}<br>
                <a href="mailto:${d.email}" style="color:#00B4D8;">${d.email || ''}</a>
            </td>
            <td>${d.product ? '<strong>' + d.product + '</strong><br>' : ''}${d.address || d.message || 'N/A'}</td>
            <td>
                <span style="background: ${color}; color: ${textCol}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">
                    ${d.status}
                </span>
            </td>
            <td>
                 <div style="display: flex; gap: 5px;">
                    ${d.status !== 'Approved' ? `<button class="action-btn" onclick="updateWarrantyStatus(${d.id}, 'Approved')" title="Approve" style="background:#28a745; color:white;"><i class="fa-solid fa-check"></i></button>` : ''}
                    ${d.status !== 'Rejected' ? `<button class="action-btn" onclick="updateWarrantyStatus(${d.id}, 'Rejected')" title="Reject" style="background:#dc3545; color:white;"><i class="fa-solid fa-ban"></i></button>` : ''}
                    <button class="action-btn delete" onclick="deleteWarranty(${d.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

window.filterWarranties = function (status) {
    if (!window.allWarranties) return;
    const filtered = status === 'all'
        ? window.allWarranties
        : window.allWarranties.filter(d => d.status === status);
    renderWarranties(filtered);
};

window.updateWarrantyStatus = async (id, status) => {
    if (!confirm(`Mark this application as ${status}?`)) return;
    try {
        const response = await fetch(`${API_BASE}/warranties/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            alert(`Application ${status}!`);
            loadWarranties();
        } else {
            throw new Error('Failed to update');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

window.deleteWarranty = async (id) => {
    if (!confirm('Permanently delete this application?')) return;
    try {
        const response = await fetch(`${API_BASE}/warranties/${id}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            alert('Application deleted.');
            loadWarranties();
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

// INITIAL LOAD
loadCategories();
loadWarranties();
