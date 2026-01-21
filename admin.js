// Update API Base for dynamic environments
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3000/api' : '/api';

// Helper to check if we are in static mode (e.g. GitHub Pages)
function isStaticMode() {
    return localStorage.getItem('static_mode') === 'true';
}

// --- CENTRAL DATA SERVICE (FIREBASE + Local Fallback) ---
const DataService = {
    async getCollection(collectionName) {
        // 1. Try Firebase Firestore
        if (typeof db !== 'undefined' && db) {
            try {
                const snapshot = await db.collection(collectionName).get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.error(`Error fetching ${collectionName} from Firebase:`, e);
                // Fallback to local if error (e.g. permissions or quota)
            }
        }

        // 2. Fallback to Local/Static DB
        const staticData = await this._getStaticDB();
        return staticData[collectionName] || [];
    },

    async addItem(collectionName, item) {
        if (typeof db !== 'undefined' && db) {
            try {
                // If item has ID, use it, else auto-gen
                if (item.id) {
                    await db.collection(collectionName).doc(String(item.id)).set(item);
                } else {
                    const docRef = await db.collection(collectionName).add(item);
                    item.id = docRef.id;
                }
                return item;
            } catch (e) {
                console.error(`Firestore Write Error (${collectionName}):`, e);
            }
        }

        // Static Fallback
        const dbStatic = await this._getStaticDB();
        if (!dbStatic[collectionName]) dbStatic[collectionName] = [];
        // Ensure ID
        if (!item.id) item.id = Date.now();
        dbStatic[collectionName].push(item);
        this._persistStaticDB(dbStatic);
        return item;
    },

    async updateItem(collectionName, id, updates) {
        if (typeof db !== 'undefined' && db) {
            try {
                await db.collection(collectionName).doc(String(id)).update(updates);
                return;
            } catch (e) {
                // If document doesn't exist, we might need set.
                console.error("Firestore Update Error:", e);
            }
        }

        // Static Fallback
        const dbStatic = await this._getStaticDB();
        if (!dbStatic[collectionName]) return;
        const idx = dbStatic[collectionName].findIndex(i => i.id == id);
        if (idx !== -1) {
            dbStatic[collectionName][idx] = { ...dbStatic[collectionName][idx], ...updates };
            this._persistStaticDB(dbStatic);
        }
    },

    async deleteItem(collectionName, id) {
        if (typeof db !== 'undefined' && db) {
            try {
                await db.collection(collectionName).doc(String(id)).delete();
                return;
            } catch (e) { console.error("Firestore Delete Error:", e); }
        }

        // Static Fallback
        const dbStatic = await this._getStaticDB();
        if (!dbStatic[collectionName]) return;
        dbStatic[collectionName] = dbStatic[collectionName].filter(i => i.id != id);
        this._persistStaticDB(dbStatic);
    },

    // --- Internal Static DB Logic ---
    async _getStaticDB() {
        const cached = localStorage.getItem('varshini_db_cache');
        if (cached) return JSON.parse(cached);
        try {
            const res = await fetch('./db.json');
            const data = await res.json();
            localStorage.setItem('varshini_db_cache', JSON.stringify(data));
            return data;
        } catch (e) {
            return { products: [], leads: [], warranties: [], categories: [] };
        }
    },

    _persistStaticDB(data) {
        localStorage.setItem('varshini_db_cache', JSON.stringify(data));
    }
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
            const products = await DataService.getCollection('products');
            if (!products.length) return showNotification('No products to export', 'error');

            const headers = ['ID', 'Name', 'Category', 'Series', 'HP', 'Price', 'Stock'];
            const rows = products.map(p => [
                p.id, p.name, p.category, p.series, p.hp, p.price, p.stock
            ].map(e => `"${e || ''}"`).join(',')); // Escape quotes

            downloadCSV([headers.join(','), ...rows].join('\n'), 'products_catalog.csv');
        } catch (e) {
            showNotification('Export failed: ' + e.message, 'error');
        }
    };

    window.exportLeadsToCSV = async () => {
        try {
            const leads = await DataService.getCollection('leads');
            if (!leads.length) return showNotification('No leads to export', 'error');

            const headers = ['Date', 'Client', 'Interest', 'Email', 'Phone', 'Status'];
            const rows = leads.map(l => [
                l.date, l.client, l.interest, l.contact?.email, l.contact?.phone, l.status
            ].map(e => `"${e || ''}"`).join(','));

            downloadCSV([headers.join(','), ...rows].join('\n'), 'customer_inquiries.csv');
        } catch (e) {
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
        logoutBtn.removeAttribute('onclick'); // remove inline handler if persists
        logoutBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to logout?")) {
                try {
                    if (typeof auth !== 'undefined' && auth) {
                        await auth.signOut();
                    }
                } catch (e) { console.error("Firebase SignOut Error:", e); }

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

        renderStats(stats);
        renderProducts(products);
        renderLeads(leads);
        renderWarranties(warranties);
        renderCategories(categories);

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
                <td data-label="Image"><img src="${p.image || 'assets/placeholder.png'}" alt="${p.name}" class="thumb" 
                     onerror="this.src='https://via.placeholder.com/50?text=No+Image'" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td data-label="Model"><strong>${p.name}</strong><br><small style="color: #666;">${p.series || 'N/A'}</small></td>
                <td data-label="HP/Spec">${p.hp || 'N/A'}</td>
                <td data-label="Price" style="font-weight: 600;">${p.price || 'N/A'}</td>
                <td data-label="Stock"><span class="status ${stockClass}">${p.stock || 'Unknown'}</span></td>
                <td data-label="Actions">
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
            <td data-label="Date">${l.date || 'N/A'}</td>
            <td data-label="Client">${l.client || 'Unknown'}</td>
            <td data-label="Interest">${l.interest || 'General Inquiry'}</td>
            <td data-label="Status">
                <select class="status-select ${statusClass}" onchange="updateLeadStatus('${l.id}', this.value)">
                    <option value="New Lead" ${l.status === 'New Lead' ? 'selected' : ''}>New Lead</option>
                    <option value="Contacted" ${l.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="Sold" ${l.status === 'Sold' ? 'selected' : ''}>Sold</option>
                </select>
            </td>
            <td data-label="Actions">
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
        alert('Error loading product: ' + error.message);
    }
};

async function saveProduct(formData) {
    try {
        const id = formData.get('id'); // Note: Form usually has 'id' hidden input, verify name
        // In previous view, it looked like 'productId'? Let's check admin.html line 381: name="id".
        // But the previous code used formData.get('productId')? 
        // Let's trust the previous code's intent but robustly check both or stick to what worked.
        // Wait, line 589 says `const id = formData.get('productId')`.
        // admin.html line 381: `<input type="hidden" name="id" id="productId">`
        // formData.get('id') gets it by NAME attribute. So it should be 'id'.
        // Why did the old code use 'productId'? maybe it was manually appended?
        // I will use `formData.get('id')` as per standard HTML form behavior.

        let productId = formData.get('id');

        let imageValue = formData.get('existingImage') || 'assets/placeholder.png';

        // Custom File Handling (Base64)
        const file = formData.get('image');
        if (file instanceof File && file.size > 0) {
            if (file.size > 800 * 1024) {
                alert("Image too large! Please use an image smaller than 800KB.");
                return;
            }
            // Convert
            imageValue = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }

        const productData = {
            id: productId ? (isNaN(productId) ? productId : parseInt(productId)) : Date.now().toString(),
            name: formData.get('name'),
            category: formData.get('category'),
            series: formData.get('series'),
            hp: formData.get('hp'),
            price: formData.get('price'),
            stock: formData.get('stock'),
            image: imageValue
        };

        if (productId) {
            await DataService.updateItem('products', productData.id, productData);
            alert('✅ Product updated successfully!');
        } else {
            await DataService.addItem('products', productData);
            alert('✅ Product added successfully!');
        }

        closeModal();
        refreshDashboard();

    } catch (error) {
        alert('Error saving product: ' + error.message);
        console.error(error);
    }
}

window.deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        await DataService.deleteItem('products', id);
        alert('✅ Product deleted successfully!');
        refreshDashboard();
    } catch (error) {
        alert('Error deleting product: ' + error.message);
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
        // Try to update existing, or create if not exists
        // Since DataService.updateItem might fail if doc doesn't exist in Firestore,
        // and addItem might fail if ID exists.
        // Best approach for singleton: Try set (which addItem does with ID)
        await DataService.addItem('settings', settings);

        // Also save to localStorage for immediate sync/offline
        localStorage.setItem('varshini_settings', JSON.stringify(settings));

        const btn = event.target || document.querySelector('.settings-header .btn-primary');
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            setTimeout(() => {
                btn.innerHTML = original;
            }, 2000);
        }

        alert('✅ Settings saved! Note: SEO changes require manual HTML updates.');
    } catch (e) {
        alert('Error saving settings: ' + e.message);
    }
};

window.changePassword = async function () {
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

    // Firebase Update
    if (typeof auth !== 'undefined' && auth.currentUser) {
        try {
            await auth.currentUser.updatePassword(newPass);
            showNotification("✅ Password updated successfully!", 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                showNotification("Please logout and login again to change password.", 'error');
            } else {
                showNotification("Error: " + error.message, 'error');
            }
        }
    } else {
        // Fallback or No Auth
        showNotification("Error: You are not logged in via Firebase.", 'error');
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
        const [categories, products] = await Promise.all([
            DataService.getCollection('categories'),
            DataService.getCollection('products')
        ]);

        // Calculate Counts locally
        const categoriesWithCounts = categories.map(c => ({
            ...c,
            count: products.filter(p => p.category === c.name).length
        }));

        renderCategories(categoriesWithCounts);
        populateCategoryDropdown(categoriesWithCounts);
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
            <td data-label="Name">${c.name}</td>
            <td data-label="Count">${c.count || 0} Products</td>
            <td data-label="Actions">
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
// Duplicate category logic removed. Implemented at the end of file.

// Duplicate deleteCategory logic removed.

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

window.filterWarranties = function (status) {
    if (!window.allWarranties) return;
    const filtered = status === 'all'
        ? window.allWarranties
        : window.allWarranties.filter(d => d.status === status);
    renderWarranties(filtered);
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

const addCategoryForm = document.getElementById('addCategoryForm');
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = addCategoryForm.name.value.trim();
        if (!name) return;

        try {
            const categories = await DataService.getCollection('categories');
            if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                alert('Category already exists');
                return;
            }

            await DataService.addItem('categories', { id: Date.now(), name });
            alert('✅ Category added successfully!');
            closeCategoryModal();
            loadCategories();
        } catch (error) {
            alert('Error adding category: ' + error.message);
        }
    });
}

function closeCategoryModal() {
    const modal = document.getElementById('addCategoryModal');
    const form = document.getElementById('addCategoryForm');
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
}

window.deleteCategory = async (id) => {
    if (!confirm('Delete this category? This cannot be undone.')) return;

    try {
        const categories = await DataService.getCollection('categories');
        const products = await DataService.getCollection('products');

        const category = categories.find(c => c.id === id);
        if (!category) return;

        if (products.some(p => p.category === category.name)) {
            alert('Cannot delete category with associated products.');
            return;
        }

        await DataService.deleteItem('categories', id);
        alert('✅ Category deleted!');
        loadCategories();
    } catch (error) {
        alert('Error deleting category: ' + error.message);
    }
};

// --- MIGRATION UTILITY ---
window.importStaticToFirebase = async () => {
    if (!confirm('This will upload data from db.json to Firebase. Continue?')) return;

    try {
        const res = await fetch('db.json');
        if (!res.ok) throw new Error("Could not find db.json");
        const data = await res.json();

        let count = 0;

        // Products
        if (data.products) {
            const existing = await DataService.getCollection('products');
            for (const p of data.products) {
                if (!existing.find(e => e.id == p.id)) {
                    await DataService.addItem('products', { ...p, id: p.id || Date.now() });
                    count++;
                }
            }
        }

        // Categories
        if (data.categories) {
            const existing = await DataService.getCollection('categories');
            for (const c of data.categories) {
                if (!existing.find(e => e.name === c.name)) {
                    await DataService.addItem('categories', { ...c, id: c.id || Date.now() });
                    count++;
                }
            }
        }

        // Leads
        if (data.leads) {
            for (const l of data.leads) {
                await DataService.addItem('leads', { ...l, id: l.id || Date.now() });
                count++;
            }
        }

        // Settings
        if (data.settings) {
            await DataService.addItem('settings', { ...data.settings, id: 'global' });
            count++;
        }

        alert(`✅ Migration Complete! Imported ${count} items to Firebase.`);
        refreshDashboard();

    } catch (e) {
        alert('Migration Failed: ' + e.message);
        console.error(e);
    }
};

window.openAddCategoryModal = () => {
    const modal = document.getElementById('addCategoryModal');
    if (modal) modal.style.display = 'flex';
};
