(() => {
    const escapeHtml = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    let readNotifications = new Set();
    try {
        readNotifications = new Set(JSON.parse(localStorage.getItem('ovsReadNotifications') || '[]'));
    } catch {
        readNotifications = new Set();
    }

    function getNotifications() {
        const context = window.getNotificationContext?.() || { applications: [], certificates: [], state: {} };
        const visibleApplications = context.applications.filter(application => {
            if (context.state.role === 'User') return application.applicant === context.state.user.name;
            if (context.state.role === 'Officer') {
                return application.assignedLMO === context.state.user.name || application.officer === context.state.user.name;
            }
            if (context.state.role === 'GATC') {
                return application.assignedGATC === context.state.user.name || application.officer === context.state.user.name;
            }
            return true;
        });

        const notifications = visibleApplications.flatMap(application => {
            const id = application.id;
            const items = [];
            if (application.status === 'Pending') items.push({
                title: `Application ${id} is pending`, detail: 'This application is waiting for review.', action: 'applications'
            });
            if (application.status === 'GATC Assigned') items.push({
                title: 'Your instrument has been assigned to a GATC for verification.', detail: `Take ${application.instrument} to ${application.assignedGATC || 'the assigned centre'}.`, action: 'applications'
            });
            if (application.status === 'GATC Verification Required') items.push({
                title: 'Field verification has been completed. Further verification at a Government Approved Test Centre (GATC) is required.', detail: application.fieldVerification?.reason || 'Review the LMO observations and take the instrument to the assigned centre.', action: 'applications'
            });
            if (application.status === 'Inspection Required') items.push({
                title: `Inspection required for ${id}`, detail: 'An inspection must be completed.', action: 'inspections'
            });
            if (application.status === 'Application Rejected') items.push({
                title: `Application ${id} was rejected`, detail: application.applicationRejectionReason || 'The submitted information was improper or incomplete.', action: 'applications'
            });
            if (application.status === 'Verification Rejected') items.push({
                title: `Verification for ${id} was rejected`, detail: application.verificationRejectionReason || 'The instrument details did not match during inspection.', action: 'applications'
            });
            if (application.status === 'Verified') items.push({
                title: 'Your instrument verification has been completed.', detail: 'A digital certificate can now be generated.', action: 'applications'
            });
            if (application.status === 'Certificate Generated' || application.currentStage === 'COMPLETED') items.push({
                title: 'Your digital verification certificate is now available.', detail: 'Open your certificate repository to view it.', action: 'certificates'
            });
            if (application.status === 'Inspection Scheduled') items.push({
                title: `Inspection scheduled for ${id}`,
                detail: `${application.scheduledDate} at ${application.scheduledTime} by officer ${application.scheduledBy}.`,
                action: 'applications'
            });
            return items.map((item, index) => ({
                ...item,
                id: `${id}:${index}`
            }));
        });
        const visibleCertificates = context.certificates.filter(certificate => {
            if (context.state.role === 'User') return certificate.applicant === context.state.user.name;
            if (['Officer', 'GATC'].includes(context.state.role)) return certificate.issuedBy === context.state.user.name;
            return true;
        });
        visibleCertificates.forEach(certificate => {
            const expiry = new Date(certificate.validUntil);
            if (Number.isNaN(expiry.getTime())) return;
            const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
            if (certificate.status === 'Active' && days <= 30) {
                notifications.push({
                    id: `certificate:${certificate.id}`,
                    title: days < 0 ? `Certificate ${certificate.id} has expired` : `Certificate ${certificate.id} expires soon`,
                    detail: days < 0 ? 'Submit a re-verification application immediately.' : `Re-verification is due in ${days} day${days === 1 ? '' : 's'}.`,
                    action: 'certificates'
                });
            }
        });
        return notifications
            .filter(notification => !readNotifications.has(notification.id))
            .map(notification => ({
                ...notification,
                action: context.state.role === 'User' && notification.action === 'inspections'
                    ? 'applications'
                    : notification.action
            }));
    }

    window.showNotifications = function () {
        const notifications = getNotifications();

        if (!notifications.length) {
            notifications.push({
                title: 'Everything is up to date',
                detail: 'There are no new notifications at this time.',
                action: null
            });
        }

        const content = `
            <div style="display:grid;gap:12px;margin-top:18px">
                ${notifications.map(notification => `
                    <div class="notice" style="display:flex;align-items:center;justify-content:space-between;gap:14px">
                        <div>
                            <b>${escapeHtml(notification.title)}</b>
                            <div class="muted" style="margin-top:4px">
                                ${escapeHtml(notification.detail)}
                            </div>
                        </div>
                        ${notification.action ? `
                            <button
                                class="btn secondary notification-action"
                                type="button"
                                data-page="${escapeHtml(notification.action)}">
                                Open
                            </button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        showModal('Notifications', content, `
            <button class="btn primary notification-close"
                    type="button"
                    style="width:100%;margin-top:20px">
                Mark All as Read
            </button>
        `);

        document.querySelectorAll('.notification-action').forEach(button => {
            button.addEventListener('click', () => {
                closeModal();
                go(button.dataset.page);
            });
        });

        document.querySelector('.notification-close')
            ?.addEventListener('click', () => {
                getNotifications().forEach(notification => readNotifications.add(notification.id));
                localStorage.setItem('ovsReadNotifications', JSON.stringify([...readNotifications]));
                closeModal();
                updateNotificationBadge();
            });
    };

    function updateNotificationBadge() {
        const badge = document.querySelector('.bell .badge');
        if (!badge) return;

        const count = getNotifications().length;
        const nextText = String(count);
        if (badge.textContent !== nextText) badge.textContent = nextText;
        if (badge.hidden !== (count === 0)) badge.hidden = count === 0;
    }

    let updateQueued = false;
    const observer = new MutationObserver(() => {
        if (updateQueued) return;

        updateQueued = true;
        requestAnimationFrame(() => {
            updateQueued = false;
            updateNotificationBadge();
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateNotificationBadge, { once: true });
    } else {
        updateNotificationBadge();
    }
})();