// Main Website Logic (Public)

document.addEventListener('DOMContentLoaded', () => {

    // 1. Mobile Menu Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileToggle.innerHTML = navLinks.classList.contains('active')
                ? '<i class="fa-solid fa-xmark"></i>'
                : '<i class="fa-solid fa-bars"></i>';
        });
    }

    // 1b. Mobile Products Dropdown (Accordion)
    const navProducts = document.getElementById('navProducts');
    if (navProducts) {
        navProducts.addEventListener('click', (e) => {
            // Only toggle on mobile
            if (window.innerWidth <= 900) {
                e.preventDefault();
                const parent = navProducts.closest('.nav-item-products');
                if (parent) {
                    parent.classList.toggle('dropdown-active');
                    // Toggle Icon
                    const icon = navProducts.querySelector('i');
                    if (icon) {
                        icon.classList.toggle('fa-chevron-down');
                        icon.classList.toggle('fa-chevron-up');
                    }
                }
            }
        });
    }

    // 2. Smart Sticky Header (Mobile Optimized)
    const navbar = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // Base Sticky Class (Background Color)
        if (currentScrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Smart Hide/Show (Mobile Only)
        if (window.innerWidth <= 900) {
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                // Scrolling DOWN -> Hide
                navbar.style.transform = 'translateY(-100%)';
                navbar.style.transition = 'transform 0.3s ease-in-out';
            } else {
                // Scrolling UP -> Show
                navbar.style.transform = 'translateY(0)';
            }
        } else {
            // Desktop: Always Show (Reset)
            navbar.style.transform = 'translateY(0)';
        }

        lastScrollY = currentScrollY;
    });

    // 3. Dynamic Product Loading & Search
    fetchPublicProducts();

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    // Desktop Search (Logic unified in Section 6)

    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') filterProducts(searchInput.value);
            else filterProducts(searchInput.value); // Real-time
        });
    }

    // Mobile Search Logic (Legacy - still needed for backward compatibility in menu)
    const mobSearchInput = document.getElementById('mobileSearchInput');
    const mobSearchBtn = document.getElementById('mobileSearchBtn');

    if (mobSearchBtn && mobSearchInput) {
        mobSearchBtn.addEventListener('click', () => {
            filterProducts(mobSearchInput.value);
            // Auto-close menu on search
            document.querySelector('.nav-links').classList.remove('active');
            document.getElementById('mobileToggle').innerHTML = '<i class="fa-solid fa-bars"></i>';
        });

        mobSearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                filterProducts(mobSearchInput.value);
                document.querySelector('.nav-links').classList.remove('active');
            }
        });
    }

    // --- NEW: Mobile Bottom Nav & Search Overlay Logic ---
    const bottomNavSearch = document.getElementById('bottomNavSearch');
    const bottomNavCats = document.getElementById('bottomNavCats');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearchOverlay = document.getElementById('closeSearchOverlay');
    const overlaySearchInput = document.getElementById('overlaySearchInput');
    const overlaySearchBtn = document.getElementById('overlaySearchBtn');

    if (bottomNavSearch && searchOverlay) {
        bottomNavSearch.addEventListener('click', (e) => {
            e.preventDefault();
            searchOverlay.classList.add('active');
            setTimeout(() => overlaySearchInput.focus(), 300);
        });
    }

    if (closeSearchOverlay) {
        closeSearchOverlay.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
        });
    }

    if (overlaySearchBtn) {
        overlaySearchBtn.addEventListener('click', () => {
            filterProducts(overlaySearchInput.value);
            searchOverlay.classList.remove('active');
        });
    }

    if (overlaySearchInput) {
        overlaySearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                filterProducts(overlaySearchInput.value);
                searchOverlay.classList.remove('active');
            }
        });
    }

    if (bottomNavCats) {
        bottomNavCats.addEventListener('click', (e) => {
            e.preventDefault();
            const navLinks = document.querySelector('.nav-links');
            const mobileToggle = document.getElementById('mobileToggle');
            if (navLinks && mobileToggle) {
                navLinks.classList.toggle('active');
                mobileToggle.innerHTML = navLinks.classList.contains('active')
                    ? '<i class="fa-solid fa-xmark"></i>'
                    : '<i class="fa-solid fa-bars"></i>';
            }
        });
    }

    // Auto-Close Mobile Menu on Link Click
    const mobileLinks = document.querySelectorAll('.nav-links a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Check for dropdown toggle first
            if (link.id === 'navProducts' && window.innerWidth <= 900) return;

            const navLinks = document.querySelector('.nav-links');
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                document.getElementById('mobileToggle').innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });
    });

    // 6. Real-time Product Navigation (Event Delegation)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href.includes('products.html') && href.includes('?')) {
                // If we are ALREADY on products.html, intercept
                if (window.location.pathname.includes('products.html') || window.location.href.includes('products.html')) {

                    // Don't intercept if it's just a hash/anchor
                    e.preventDefault();

                    const urlParams = new URLSearchParams(href.split('?')[1]);
                    const category = urlParams.get('category');
                    const series = urlParams.get('series');
                    const search = urlParams.get('search');

                    if (category) {
                        filterCategory(category);
                        // Also update sidebar active state if possible
                        document.querySelectorAll('.category-list a').forEach(a => a.classList.remove('active'));
                    }
                    else if (series) filterProducts(series);
                    else if (search) filterProducts(search);

                    // Update Browser URL
                    window.history.pushState({}, '', href);

                    // Close Mobile Menu if open
                    const navLinks = document.querySelector('.nav-links');
                    if (navLinks && navLinks.classList.contains('active')) {
                        navLinks.classList.remove('active');
                        const mt = document.getElementById('mobileToggle');
                        if (mt) mt.innerHTML = '<i class="fa-solid fa-bars"></i>';
                    }

                    // Scroll to Top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        }
    });

    // 4. Quick Pump Finder (REAL LOGIC)
    const finderForm = document.getElementById('finderForm');
    if (finderForm) {
        finderForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const pipeSize = document.getElementById('finderPipeSize').value;
            const hpKw = document.getElementById('finderHpKw').value;

            if (!pipeSize && !hpKw) {
                alert('Please select a Pipe Size or HP / KW.');
                return;
            }

            // Filter Logic
            const results = allProducts.filter(p => {
                if (!p.table_data) return false;
                const matchPipe = pipeSize ? (p.table_data.pipe_size === pipeSize) : true;
                const matchHpKw = hpKw ? (p.table_data.hp_kw === hpKw) : true;
                return matchPipe && matchHpKw;
            });

            if (results.length > 0) {
                // If on products.html, render in place
                if (window.location.pathname.includes('products.html')) {
                    renderPublicProducts(results);
                    const pSec = document.getElementById('productGrid');
                    if (pSec) pSec.scrollIntoView({ behavior: 'smooth' });
                } else {
                    // If on Home, redirect to products.html with query params
                    const params = new URLSearchParams();
                    if (pipeSize) params.set('pipe', pipeSize);
                    if (hpKw) params.set('hpkw', hpKw);
                    window.location.href = `products.html?${params.toString()}`;
                }
            } else {
                alert(`No pumps found matching those specifications. Try different options.`);
            }
        });
    }

});

let allProducts = [];

async function fetchPublicProducts() {
    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '3000';
        const fetchUrl = isLocal ? '/api/public/products' : './db.json';

        console.log(`Fetching products from: ${fetchUrl}`);
        const res = await fetch(fetchUrl);

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        // If it was db.json, it's an object with products array
        allProducts = Array.isArray(data) ? data : (data.products || []);

        if (allProducts.length === 0) {
            console.warn('No products found in data source');
        }

        populateMegaMenu(allProducts);
        populateFinderSelects(allProducts);

        // Check for URL Params (Category, Series, OR Pipe/HP)
        const urlParams = new URLSearchParams(window.location.search);
        const categoryParam = urlParams.get('category');
        const seriesParam = urlParams.get('series');
        const pipeParam = urlParams.get('pipe');
        const hpkwParam = urlParams.get('hpkw');

        if (categoryParam) {
            filterCategory(categoryParam);
            // Hide Sidebar for DC Series (Micro Motors)
            if (categoryParam === 'Micro Motors') {
                const sidebar = document.querySelector('.sidebar-filter');
                const mainContent = document.querySelector('.products-layout');
                if (sidebar) sidebar.style.display = 'none';
                if (mainContent) mainContent.style.gridTemplateColumns = '1fr';
            }
        } else if (seriesParam) {
            filterProducts(seriesParam);
        } else if (pipeParam || hpkwParam) {
            // Apply Quick Finder Logic on Load
            const results = allProducts.filter(p => {
                if (!p.table_data) return false;
                const matchPipe = pipeParam ? (p.table_data.pipe_size === pipeParam) : true;
                const matchHpKw = hpkwParam ? (p.table_data.hp_kw === hpkwParam) : true;
                return matchPipe && matchHpKw;
            });
            renderPublicProducts(results);
        } else {
            // Default: Show all
            renderPublicProducts(allProducts);
        }
        // Populate Sidebar
        const sidebarList = document.getElementById('sidebarCategories');
        if (sidebarList) {
            const categories = [...new Set(allProducts.map(p => p.category))];
            let sidebarHTML = `<li><a href="#" onclick="filterPageCategory('All'); return false;">All Products</a></li>`;
            CATEGORY_ORDER.forEach(cat => {
                if (categories.includes(cat)) {
                    sidebarHTML += `<li><a href="#" onclick="filterPageCategory('${cat}'); return false;">${cat}</a></li>`;
                }
            });
            sidebarList.innerHTML = sidebarHTML;
        }

    } catch (err) {
        console.error('Error fetching products:', err);
        const grid = document.getElementById('productGrid');
        if (grid) grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding: 50px;">Failed to load catalog. Please try again later.</p>';
    }
}

const CATEGORY_ORDER = [
    "Self-Priming Monoblock Pumps",
    "Supersuction Pumps",
    "Centrifugal Monoblock Pumps",
    "Openwell Submersible Pumps",
    "Shallow Well Pumps",
    "Mini Booster Pumps",
    "Borewell Submersible Pumps"
];

function renderPublicProducts(products) {
    const container = document.getElementById('productGrid');
    if (!container) return;

    // Remove the grid class from the main container to allow vertical stacking of sections
    container.classList.remove('product-grid');
    container.style.display = 'block';

    if (!products || products.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color:#666;">No products found matching your criteria.</p>';
        return;
    }

    // Group products
    const grouped = {};
    products.forEach(p => {
        const cat = p.category || "Other Products";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    let html = '';

    CATEGORY_ORDER.forEach(cat => {
        if (grouped[cat] && grouped[cat].length > 0) {
            html += `
                <div class="category-wrapper fade-in">
                    <div class="category-header">
                        <h3>${cat}</h3>
                        <div class="cat-line"></div>
                    </div>
                    <div class="product-grid">
                        ${grouped[cat].map(p => createProductCardHtml(p)).join('')}
                    </div>
                </div>
            `;
        }
    });

    // Handle any categories not in the strict list (fallback)
    Object.keys(grouped).forEach(cat => {
        if (!CATEGORY_ORDER.includes(cat) && grouped[cat].length > 0) {
            html += `
                <div class="category-wrapper fade-in">
                    <div class="category-header">
                        <h3>${cat}</h3>
                        <div class="cat-line"></div>
                    </div>
                    <div class="product-grid">
                        ${grouped[cat].map(p => createProductCardHtml(p)).join('')}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}

// 8. ADD TO CART LOGIC
let cart = JSON.parse(localStorage.getItem('varshini_cart')) || [];

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItemsEl = document.getElementById('cartItems');
    if (cartCount) cartCount.innerText = cart.length;



    // The following block seems misplaced here, as pageTitle is usually updated when products are rendered,
    // not every time the cart UI is updated. Keeping it as per instruction but noting potential logical issue.
    // if (pageTitle) {
    //     if (categoryParam) pageTitle.innerText = `${categoryParam}`;
    //     else if (seriesParam) pageTitle.innerText = `${seriesParam} Series`; // seriesParam not available here
    //     else pageTitle.innerText = 'All Products';
    // }

    if (cartItemsEl) {
        if (cart.length === 0) {
            cartItemsEl.innerHTML = '<div class="empty-cart-msg">Your cart is empty.</div>';
        } else {
            cartItemsEl.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <p>${item.series}</p>
                    </div>
                    <button class="btn-remove-item" onclick="removeFromCart(${item.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // Save to local storage
    localStorage.setItem('varshini_cart', JSON.stringify(cart));
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    // Check if already in cart
    if (cart.some(item => item.id === productId)) {
        alert('Item is already in your cart.');
        return;
    }

    cart.push(product);
    updateCartUI();

    // Animation feedback
    const floatCart = document.getElementById('cartFloat');
    if (floatCart) {
        floatCart.style.transform = 'scale(1.2)';
        setTimeout(() => floatCart.style.transform = 'scale(1)', 200);
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function sendEnquiry() {
    if (cart.length === 0) {
        alert('Please add items to your cart first.');
        return;
    }

    let message = "Hello Varshini Industrries, I am interested in the following products:%0A%0A";
    cart.forEach((item, index) => {
        message += `${index + 1}. ${item.name} (${item.series})%0A`;
    });

    // Replace with actual number when provided. Using a placeholder for now.
    const phoneNumber = "919876543210";
    const url = `https://wa.me/${phoneNumber}?text=${message}`;

    window.open(url, '_blank');
}

// Open/Close Cart Sidebar
document.addEventListener('DOMContentLoaded', () => {
    // ... (Existing DOM Content Loaded code) ...

    const cartFloat = document.getElementById('cartFloat');
    const closeCart = document.getElementById('closeCart');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartSidebar = document.getElementById('cartSidebar');

    if (cartFloat && cartSidebar) {
        cartFloat.addEventListener('click', (e) => {
            e.preventDefault();
            cartSidebar.classList.add('active');
            if (cartOverlay) cartOverlay.classList.add('active');
        });

        const closeAll = () => {
            cartSidebar.classList.remove('active');
            if (cartOverlay) cartOverlay.classList.remove('active');
        };

        if (closeCart) closeCart.addEventListener('click', closeAll);
        if (cartOverlay) cartOverlay.addEventListener('click', closeAll);
    }

    // Init Cart UI
    updateCartUI();
});

function createProductCardHtml(p) {
    let stockClass = '';
    const s = p.stock ? p.stock.toLowerCase() : '';

    if (s.includes('in stock')) stockClass = 'status-in-stock';
    else if (s.includes('low stock')) stockClass = 'status-low-stock';
    else if (s.includes('made to order')) stockClass = 'status-made-to-order';

    // Determine features based on category
    let featureListItems = '';
    const cat = p.category;

    if (cat === 'Centrifugal Monoblock Pumps') {
        featureListItems = `
            <li><i class="fa-solid fa-check"></i> Centrifugal Pump</li>
            <li><i class="fa-solid fa-check"></i> Clear Water Pump</li>
            <li><i class="fa-solid fa-check"></i> Residential & Commercial</li>
            <li><i class="fa-solid fa-check"></i> Distribution System</li>
            <li><i class="fa-solid fa-check"></i> High Discharge</li>
        `;
    } else if (cat === 'Openwell Submersible Pumps') {
        featureListItems = `
            <li><i class="fa-solid fa-check"></i> Clear Water Pump</li>
            <li><i class="fa-solid fa-check"></i> Residential & Commercial</li>
            <li><i class="fa-solid fa-check"></i> Distribution System</li>
            <li><i class="fa-solid fa-check"></i> Fountain</li>
        `;
    } else if (cat === 'Borewell Submersible Pumps') {
        featureListItems = `
            <li><i class="fa-solid fa-check"></i> Clear Water Pump</li>
            <li><i class="fa-solid fa-check"></i> Residential & Commercial</li>
            <li><i class="fa-solid fa-check"></i> Distribution System</li>
            <li><i class="fa-solid fa-check"></i> Submersible</li>
        `;
    } else if (cat === 'Self-Priming Monoblock Pumps') {
        featureListItems = `
            <li><i class="fa-solid fa-check"></i> Self Priming Pump</li>
            <li><i class="fa-solid fa-check"></i> Clear Water Pump</li>
            <li><i class="fa-solid fa-check"></i> Residential & Commercial</li>
            <li><i class="fa-solid fa-check"></i> Distribution System</li>
        `;
    } else if (cat === 'Shallow Well Pumps') {
        featureListItems = `
            <li> <i class="fa-solid fa-check"></i> High Suction</li>
            <li><i class="fa-solid fa-check"></i> Primes Quickly</li>
            <li><i class="fa-solid fa-check"></i> Residential Application</li>
            <li><i class="fa-solid fa-check"></i> Durable Material</li>
        `;
    } else if (cat === 'Mini Booster Pumps') {
        featureListItems = `
            <li> <i class="fa-solid fa-check"></i> Pressure Boosting</li>
            <li><i class="fa-solid fa-check"></i> Low Noise</li>
            <li><i class="fa-solid fa-check"></i> Compact Design</li>
            <li><i class="fa-solid fa-check"></i> Auto Start/Stop</li>
        `;
    } else if (cat === 'Supersuction Pumps') {
        featureListItems = `
            <li> <i class="fa-solid fa-check"></i> Super Suction Pump</li>
            <li><i class="fa-solid fa-check"></i> Clear Water Pump</li>
            <li><i class="fa-solid fa-check"></i> Residential & Commercial</li>
            <li><i class="fa-solid fa-check"></i> Distribution System</li>
        `;
    } else {
        featureListItems = `
            <li> <i class="fa-solid fa-check"></i> High Efficiency</li>
            <li><i class="fa-solid fa-check"></i> Durable Design</li>
            <li><i class="fa-solid fa-check"></i> Low Maintenance</li>
            <li><i class="fa-solid fa-check"></i> ISO Certified</li>
        `;
    }

    const features = featureListItems;

    // --- RENDER LOGIC ---
    const td = p.table_data || {
        pipe_size: '25 x 25',
        hp_kw: p.hp ? `${p.hp.replace('HP', '').trim()} / ${(parseFloat(p.hp) / 1.34).toFixed(2)}` : 'N/A',
        head_row_vals: [28, 24, 18, 15, 10, 0],
        discharge_row_vals: [0, 600, 1200, 1600, 2200, 2400]
    };

    if (!td.discharge_row_vals) td.discharge_row_vals = [];
    if (!td.head_row_vals) td.head_row_vals = [];

    // Header (Discharge Values)
    let headerCells = '';
    td.discharge_row_vals.forEach((val) => {
        headerCells += `<th>${val}</th>`;
    });

    // Body (Head Values)
    let bodyCells = '';
    td.head_row_vals.forEach((val) => {
        const displayVal = (val !== null && val !== undefined && val !== '') ? val : 0;
        bodyCells += `<td>${displayVal}</td>`;
    });

    const perfTableHTML = `
        <div class="perf-data-container">
            <h5 class="perf-title">Performance: Head (m) vs Discharge (LPH)</h5>
            <div class="perf-table-wrapper">
                <table class="perf-table">
                    <thead>
                        <tr>
                            <th class="matrix-label">Discharge<br>(LPH)</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="matrix-label">Head<br>(m)</td>
                            ${bodyCells}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Key Specs Block
    const keySpecsHTML = `
        <div class="key-specs-grid">
            <div class="spec-item">
                <span class="spec-label">Pipe Size</span>
                <span class="spec-value">${td.pipe_size}</span>
            </div>
            <div class="spec-item">
                <span class="spec-label">Power (HP/KW)</span>
                <span class="spec-value">${td.hp_kw}</span>
            </div>
        </div>
    `;

    return `
        <div class="product-card" id="card-${p.id}">
            <div class="product-card-inner">
                <div class="card-img-box">
                    <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300?text=Varshini+Ind'">
                    <div class="spec-tag ${stockClass}">${p.stock}</div>
                </div>
                <div class="card-details">
                    <div class="details-header">
                        <h3>
                            MODEL : <span>${p.name}</span>
                        </h3>
                    </div>

                    <ul class="feature-list">
                        ${features}
                    </ul>

                    ${keySpecsHTML}
                    ${perfTableHTML}

                    <div class="card-actions-row">
                        ${p.stock === 'Out of Stock'
            ? '<span class="price-tag sold-out">Sold Out</span>'
            : '<button class="btn-add-cart" onclick="addToCart(' + p.id + ')" title="Add to Cart"><i class="fa-solid fa-plus"></i></button>'
        }
                    </div>
                </div>
            </div>
        </div>
    `;
}



function filterProducts(query) {
    if (!query) {
        renderPublicProducts(allProducts);
        return;
    }

    query = query.toLowerCase();
    const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.series.toLowerCase().includes(query) ||
        (p.category && p.category.toLowerCase().includes(query))
    );

    renderPublicProducts(filtered);
}

function populateMegaMenu(products) {
    const catList = document.getElementById('megaMenuCategories');

    // Use categories for the first menu
    if (catList) {
        catList.innerHTML = CATEGORY_ORDER.map(cat =>
            `<li><a href="products.html?category=${encodeURIComponent(cat)}">${cat}</a></li>`
        ).join('');
    }
}

// Redirects or Filters based on page
function filterCategory(cat) {
    if (window.location.pathname.includes('products.html')) {
        // In-page filtering for products.html
        filterPageCategory(cat);
    } else {
        // Redirect from Home or other pages
        window.location.href = `products.html?category=${encodeURIComponent(cat)}`;
    }
}

// Helper for Sidebar/In-Page filtering
function filterPageCategory(cat) {
    // Update active state in sidebar
    const sidebarLinks = document.querySelectorAll('.category-list a');
    if (sidebarLinks) {
        sidebarLinks.forEach(link => {
            if (link.innerText === cat || (cat === 'All' && link.innerText === 'All Products')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Check for DC Series (mapped often as 'Micro Motors' or direct 'DC Series')
    if (cat === 'DC Series' || cat === 'Micro Motors') {
        const grid = document.getElementById('productGrid');
        if (grid) {
            grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: white; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.05);">
                    <i class="fa-solid fa-bolt" style="font-size: 4rem; color: var(--industrial-teal); margin-bottom: 20px;"></i>
                    <h2 style="font-size: 2rem; color: #0A2540; margin-bottom: 15px;">Electrifying Efficiency is on the Horizon.</h2>
                    <p style="font-size: 1.2rem; color: #555; max-width: 600px; margin: 0 auto;">
                        Our DC Series is charging up to redefine precision. Stay tuned for a revolutionary pumping experience!
                    </p>
                </div>
        `;
        }
        return;
    }

    if (cat === 'All') {
        renderPublicProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === cat);
        renderPublicProducts(filtered);
    }
}

// Global filter wrapper to handle redirects
const originalFilterProducts = filterProducts;
filterProducts = function (query) {
    if (!window.location.pathname.includes('products.html')) {
        window.location.href = `products.html?series=${encodeURIComponent(query)}`;
        return;
    }

    // If on products page, use original logic
    if (!query) {
        renderPublicProducts(allProducts);
        return;
    }

    query = query.toLowerCase();
    const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.series.toLowerCase().includes(query) ||
        (p.category && p.category.toLowerCase().includes(query))
    );

    renderPublicProducts(filtered);
}
// 5. Newsletter Interaction
const newsForm = document.querySelector('.newsletter-input');
if (newsForm) {
    newsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = newsForm.querySelector('input');
        if (input.value.includes('@')) {
            alert('Thank you for subscribing to Varshini Industries Technical Updates!');
            input.value = '';
        } else {
            alert('Please enter a valid email address.');
        }
    });
}


// 6. Search Bar Animation Control
document.addEventListener('DOMContentLoaded', () => {
    const searchBarContainer = document.querySelector('.search-bar');
    const searchInputEl = document.getElementById('searchInput');

    if (searchBarContainer && searchInputEl) {
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                // On PC (hover enabled), check if input has text before searching
                if (searchInputEl.value.trim() !== "") {
                    filterProducts(searchInputEl.value);
                } else {
                    // If empty, just ensure it's focused (it should already be expanded by hover)
                    e.preventDefault();
                    searchInputEl.focus();
                }
            });
        }

        searchInputEl.addEventListener('focus', () => {
            searchBarContainer.classList.add('active');
        });

        searchInputEl.addEventListener('blur', () => {
            if (searchInputEl.value === '') {
                searchBarContainer.classList.remove('active');
            }
        });
    }
});
// 7. Product Specs Modal Logic
function openSpecsModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('specsModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    const hpDisplay = product.hp && product.hp !== 'N/A' ? product.hp : 'Custom';

    modalBody.innerHTML = `
        <div class="modal-split">
            <div class="modal-img-col">
                <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">
            </div>
            <div class="modal-info-col">
                <span class="modal-series">${product.series}</span>
                <h2>${product.name}</h2>
                <div style="margin-bottom:15px; color:#555;">ID: #${product.id}</div>
                
                <p>High-efficiency industrial grade pumping solution designed for durability and optimal performance in demanding environments.</p>

                <table class="specs-table">
                    <tr>
                        <th>Power Rating</th>
                        <td>${hpDisplay}</td>
                    </tr>
                    <tr>
                        <th>Category</th>
                        <td>${product.category || 'General'}</td>
                    </tr>
                    <tr>
                        <th>Discharge Range</th>
                        <td>100 - 1500 LPM (Simulated)</td>
                    </tr>
                    <tr>
                        <th>Head Range</th>
                        <td>10 - 80 Meters (Simulated)</td>
                    </tr>
                    <tr>
                        <th>Stock Status</th>
                        <td><span style="color:${product.stock === 'Out of Stock' ? '#dc3545' : '#2ca58d'}; font-weight:700;">${product.stock}</span></td>
                    </tr>
                </table>

                <div class="action-row">
                    <a href="#" class="btn-primary-modal">Download Datasheet</a>
                    <button class="btn-curve" onclick="document.querySelector('.modal-close').click()">Close</button>
                </div>
            </div>
        </div>
        `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

document.addEventListener('DOMContentLoaded', () => {
    // Existing setup...


    // -----------------------------------------------------------
    // HERO SLIDER LOGIC
    // -----------------------------------------------------------
    const slides = document.querySelectorAll('.hero-slide');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');

    if (slides.length > 0) {
        let currentSlide = 0;
        let slideInterval;

        function showSlide(index) {
            // Normalize index
            if (index >= slides.length) index = 0;
            if (index < 0) index = slides.length - 1;

            const nextIndex = (index + 1) % slides.length;

            // Preload Current and Next slides
            preloadSlideImage(slides[index]);
            preloadSlideImage(slides[nextIndex]);

            // Remove active from all
            slides.forEach(slide => slide.classList.remove('active'));
            // Activate new
            slides[index].classList.add('active');
            currentSlide = index;
        }

        function preloadSlideImage(slide) {
            const img = slide.querySelector('img');
            if (img && img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        }

        function nextSlide() {
            showSlide(currentSlide + 1);
            resetInterval();
        }

        function prevSlide() {
            showSlide(currentSlide - 1);
            resetInterval();
        }

        function resetInterval() {
            clearInterval(slideInterval);
            slideInterval = setInterval(() => {
                showSlide(currentSlide + 1);
            }, 5000);
        }

        // Preload first two slides immediately
        showSlide(0);

        // Event Listeners
        if (nextBtn) nextBtn.addEventListener('click', nextSlide);
        if (prevBtn) prevBtn.addEventListener('click', prevSlide);

        // --- NEW: Swipe Gestures for Slider ---
        let touchStartX = 0;
        let touchEndX = 0;

        const sliderContainer = document.querySelector('.hero-slider');
        if (sliderContainer) {
            sliderContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            sliderContainer.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, { passive: true });
        }

        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) {
                nextSlide(); // Swipe Left -> Next
            }
            if (touchEndX > touchStartX + swipeThreshold) {
                prevSlide(); // Swipe Right -> Prev
            }
        }
    }

    // Modal Close Logic
    const closeBtn = document.getElementById('closeModal');
    const modal = document.getElementById('specsModal');

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto'; // Restore scroll
        });
    }

    // --- 9. Scroll & Entrance Animations ---
    // Include both hardcoded components and any elements that already have the class in HTML
    const revealElements = document.querySelectorAll('.icon-box, .cat-display-card, .section-title, .product-card, .reveal-on-scroll');
    revealElements.forEach(el => el.classList.add('reveal-on-scroll'));

    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Reveal once
            }
        });
    }, observerOptions);

    revealElements.forEach(el => revealOnScroll.observe(el));

    // Parallax Effect
    const heroImg = document.querySelector('.hero-bg img');
    if (heroImg) {
        window.addEventListener('scroll', () => {
            const scroll = window.scrollY;
            if (scroll < 800) {
                heroImg.style.transform = `translateY(${scroll * 0.4}px)`;
            }
        });
    }
    // Close on empty space click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto'; // Restore scroll
            }
        });
    }


    // 12. Animated Stats Counter
    const statsSection = document.querySelector('.stats-grid');
    const statNumbers = document.querySelectorAll('.stat-number');
    let counterStarted = false;

    if (statsSection && statNumbers.length > 0) {
        const startCounter = () => {
            statNumbers.forEach(num => {
                const target = parseInt(num.getAttribute('data-target'));
                const count = () => {
                    const currentText = num.innerText.replace(/,/g, '').replace('+', '');
                    const current = parseInt(currentText) || 0;
                    const increment = Math.ceil(target / 40);

                    if (current < target) {
                        const nextValue = Math.min(current + increment, target);
                        num.innerText = nextValue.toLocaleString();
                        setTimeout(count, 35);
                    } else {
                        num.innerText = target.toLocaleString() + '+';
                    }
                };
                count();
            });
        };

        const counterObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !counterStarted) {
                startCounter();
                counterStarted = true;
            }
        }, { threshold: 0.2 });

        counterObserver.observe(statsSection);
    }

    // 13. Modern Gradient Background Particles (Finder Section)
    const finderParticles = document.getElementById('finder-particles');
    if (finderParticles) {
        const particleCount = 40;

        const createFinderParticle = () => {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const size = Math.random() * 3 + 1;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            resetFinderParticle(particle);
            finderParticles.appendChild(particle);
            animateFinderParticle(particle);
        };

        function resetFinderParticle(particle) {
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            particle.style.left = `${posX}%`;
            particle.style.top = `${posY}%`;
            particle.style.opacity = '0';
            return { x: posX, y: posY };
        }

        function animateFinderParticle(particle) {
            const pos = resetFinderParticle(particle);
            const duration = Math.random() * 15 + 10;
            const delay = Math.random() * 5;

            setTimeout(() => {
                particle.style.transition = `all ${duration}s linear`;
                particle.style.opacity = Math.random() * 0.4 + 0.1;
                const moveX = pos.x + (Math.random() * 15 - 7.5);
                const moveY = pos.y - Math.random() * 25;
                particle.style.left = `${moveX}%`;
                particle.style.top = `${moveY}%`;

                setTimeout(() => {
                    animateFinderParticle(particle);
                }, (duration) * 1000);
            }, delay * 1000);
        }

        for (let i = 0; i < particleCount; i++) {
            createFinderParticle();
        }

        const finderSection = document.querySelector('.finder-section');
        if (finderSection) {
            finderSection.addEventListener('mousemove', (e) => {
                const rect = finderSection.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
                const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

                const p = document.createElement('div');
                p.className = 'particle';
                const size = Math.random() * 4 + 2;
                p.style.width = `${size}px`;
                p.style.height = `${size}px`;
                p.style.left = `${mouseX}%`;
                p.style.top = `${mouseY}%`;
                p.style.opacity = '0.5';
                p.style.background = 'var(--industrial-teal)';
                finderParticles.appendChild(p);

                setTimeout(() => {
                    p.style.transition = 'all 1.5s ease-out';
                    p.style.left = `${mouseX + (Math.random() * 8 - 4)}%`;
                    p.style.top = `${mouseY + (Math.random() * 8 - 4)}%`;
                    p.style.opacity = '0';
                    setTimeout(() => p.remove(), 1500);
                }, 10);

                const spheres = finderSection.querySelectorAll('.gradient-sphere');
                const moveX = (e.clientX / window.innerWidth - 0.5) * 15;
                const moveY = (e.clientY / window.innerHeight - 0.5) * 15;
                spheres.forEach(s => {
                    s.style.transform = `translate(${moveX}px, ${moveY}px)`;
                });
            });
        }
    }
});

function populateFinderSelects(products) {
    const pipeSelect = document.getElementById('finderPipeSize');
    const hpKwSelect = document.getElementById('finderHpKw');

    if (!pipeSelect || !hpKwSelect) return;

    // Save initial placeholder
    const pipePlaceholder = pipeSelect.options[0].textContent;
    const hpKwPlaceholder = hpKwSelect.options[0].textContent;

    pipeSelect.innerHTML = `<option value="">${pipePlaceholder}</option>`;
    hpKwSelect.innerHTML = `<option value="">${hpKwPlaceholder}</option>`;

    const pipeSizes = [...new Set(products
        .filter(p => p.table_data && p.table_data.pipe_size && p.table_data.pipe_size !== 'N/A')
        .map(p => p.table_data.pipe_size))].sort();

    const hpKwValues = [...new Set(products
        .filter(p => p.table_data && p.table_data.hp_kw && p.table_data.hp_kw !== 'N/A')
        .map(p => p.table_data.hp_kw))].sort();

    pipeSizes.forEach(size => {
        const opt = document.createElement('option');
        opt.value = size;
        opt.textContent = size;
        pipeSelect.appendChild(opt);
    });

    hpKwValues.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        hpKwSelect.appendChild(opt);
    });
}
