// Analytics Charts Module
// This file contains Chart.js initialization for the admin dashboard

const API_BASE = 'http://localhost:3000/api';

let chartsInitialized = false;
let chartInstances = {};

window.initializeCharts = function initializeCharts() {
    if (chartsInitialized) return;
    chartsInitialized = true;

    // Destroy existing charts if any
    Object.values(chartInstances).forEach(chart => chart?.destroy());
    chartInstances = {};

    // --- DATA LOADING HELPER ---
    const loadLeadsData = async () => {
        if (window.allLeads && window.allLeads.length > 0) return window.allLeads;
        if (typeof DataService !== 'undefined') return await DataService.getCollection('leads');
        return [];
    };

    // Helper: Compare dates ignoring time
    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    // Initialize async to fetch data if needed
    (async () => {
        const leads = await loadLeadsData();

        // --- CHART 1: LEAD TRENDS (Line) ---
        const leadTrendsCtx = document.getElementById('leadTrendsChart');
        if (leadTrendsCtx) {
            const last7Days = getLast7Days();
            const leadCounts = last7Days.map(date => {
                return leads.filter(lead => {
                    let leadDate;
                    const dHtml = lead.date || '';

                    if (dHtml.toLowerCase().includes('today')) {
                        leadDate = new Date();
                    } else if (dHtml.toLowerCase().includes('yesterday')) {
                        leadDate = new Date();
                        leadDate.setDate(leadDate.getDate() - 1);
                    } else {
                        leadDate = new Date(lead.date);
                    }

                    // Handle invalid dates gracefully
                    if (isNaN(leadDate.getTime())) return false;

                    return isSameDay(leadDate, date);
                }).length;
            });

            chartInstances.leadTrends = new Chart(leadTrendsCtx, {
                type: 'line',
                data: {
                    labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                    datasets: [{
                        label: 'New Leads',
                        data: leadCounts,
                        borderColor: '#00B4D8',
                        backgroundColor: 'rgba(0, 180, 216, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointBackgroundColor: '#00B4D8',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(10, 37, 64, 0.9)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        // --- CHART 2: STATUS DISTRIBUTION (Doughnut) ---
        const statusDistCtx = document.getElementById('statusDistChart');
        if (statusDistCtx) {
            const newCount = leads.filter(l => l.status === 'New Lead').length;
            const contactedCount = leads.filter(l => l.status === 'Contacted').length;
            const soldCount = leads.filter(l => l.status === 'Sold').length;

            const hasData = newCount + contactedCount + soldCount > 0;
            const chartData = hasData ? [newCount, contactedCount, soldCount] : [1];
            const chartColors = hasData ? ['#FFD166', '#00B4D8', '#06FFA5'] : ['#e9ecef'];
            const chartLabels = hasData ? ['New Lead', 'Contacted', 'Sold'] : ['No Data'];

            chartInstances.statusDist = new Chart(statusDistCtx, {
                type: 'doughnut',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: chartColors,
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: hasData,
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                font: { size: 12, weight: '600' },
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(10, 37, 64, 0.9)',
                            padding: 12,
                            enabled: hasData
                        }
                    }
                }
            });
        }
    })();

    // Product Categories Chart (Bar)
    const categoriesCtx = document.getElementById('categoriesChart');
    if (categoriesCtx) {
        // Use products from refreshDashboard if available, or fetch directly
        const renderCategoriesChart = async () => {
            try {
                // Access DataService from admin.js scope
                const products = window.allProducts || await (typeof DataService !== 'undefined' ? DataService.getCollection('products') : []);
                const categoryCount = {};

                products.forEach(p => {
                    const cat = p.category || 'Uncategorized';
                    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
                });

                const categories = Object.keys(categoryCount);
                const counts = Object.values(categoryCount);

                chartInstances.categories = new Chart(categoriesCtx, {
                    type: 'bar',
                    data: {
                        labels: categories,
                        datasets: [{
                            label: 'Number of Products',
                            data: counts,
                            backgroundColor: '#00B4D8',
                            borderRadius: 6,
                            barThickness: 40
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(10, 37, 64, 0.9)',
                                padding: 12
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1 },
                                grid: { color: 'rgba(0, 0, 0, 0.05)' }
                            },
                            x: {
                                grid: { display: false }
                            }
                        }
                    }
                });
            } catch (err) {
                console.error('Error rendering categories chart:', err);
            }
        };

        renderCategoriesChart();
    }
}

function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date);
    }
    return dates;
}

// Refresh charts when data changes
window.refreshCharts = function refreshCharts() {
    chartsInitialized = false;
    initializeCharts();
};
