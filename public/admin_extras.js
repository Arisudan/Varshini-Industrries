
// --- SYSTEM ACTIVITY & BACKUP ---

window.loadActivityLog = async function () {
    const tbody = document.getElementById('activityLogBody');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/admin/activity`, {
            headers: DataService.getAuthHeader()
        });
        if (!res.ok) throw new Error('Failed to load logs');

        const logs = await res.json();
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No recent activity.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td style="font-size:0.85rem">${new Date(log.date).toLocaleString()}</td>
                <td style="font-weight:600">${escapeHtml(log.user)}</td>
                <td><span class="status-badge" style="background:#e3f2fd; color:#0d47a1;">${escapeHtml(log.action)}</span></td>
                <td style="font-size:0.9rem; color:#555;">${escapeHtml(log.details)}</td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
};

window.downloadBackup = async function () {
    showLoading('Creating backup...');
    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE}/admin/backup`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Backup failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Varshini_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showNotification('✅ Backup downloaded successfully!', 'success');
    } catch (e) {
        showNotification("Backup Error: " + e.message, 'error');
    }
    hideLoading();
};

// Auto-load activity on dashboard open
document.addEventListener('DOMContentLoaded', () => {
    // Other inits...
    if (document.getElementById('activityLogBody')) loadActivityLog();
});
