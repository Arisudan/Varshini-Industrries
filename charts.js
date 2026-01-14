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

    // Lead Trends Chart (Last 7 Days)
    const leadTrendsCtx = document.getElementById('leadTrendsChart');
    if (leadTrendsCtx) {
        const last7Days = getLast7Days();
        const leadCounts = last7Days.map(date => {
            return (window.allLeads || []).filter(lead => {
                const leadDate = new Date(lead.date).toDateString();
                return leadDate === new Date(date).toDateString();
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
                maintainAspectRatio: true,
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

    // Status Distribution Chart (Doughnut)
    const statusDistCtx = document.getElementById('statusDistChart');
    if (statusDistCtx) {
        const leads = window.allLeads || [];
        const newCount = leads.filter(l => l.status === 'New Lead').length;
        const contactedCount = leads.filter(l => l.status === 'Contacted').length;
        const soldCount = leads.filter(l => l.status === 'Sold').length;

        chartInstances.statusDist = new Chart(statusDistCtx, {
            type: 'doughnut',
            data: {
                labels: ['New Lead', 'Contacted', 'Sold'],
                datasets: [{
                    data: [newCount, contactedCount, soldCount],
                    backgroundColor: [
                        '#FFD166',
                        '#00B4D8',
                        '#06FFA5'
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 12, weight: '600' },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 37, 64, 0.9)',
                        padding: 12
                    }
                }
            }
        });
    }

    // Product Categories Chart (Bar)
    const categoriesCtx = document.getElementById('categoriesChart');
    if (categoriesCtx) {
        fetch(`${API_BASE}/dashboard`)
            .then(res => res.json())
            .then(data => {
                const products = data.products || [];
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
            });
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
