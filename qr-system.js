(() => {
    const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=';

    const escapeHtml = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const removeModal = () => {
        document.querySelector('.qr-system-modal')?.remove();
    };

    function getCertificateData(row) {
        const cells = [...row.cells].map(cell => cell.textContent.trim());

        return {
            id: cells[0] || 'Unknown',
            applicant: cells[1] || 'Unknown',
            instrument: cells[2] || 'Unknown',
            issuedOn: cells[3] || 'Unknown',
            validUntil: cells[4] || 'Unknown',
            status: cells[5] || 'Unknown'
        };
    }

    function getVerificationUrl(certificate) {
        return `${location.origin}${location.pathname}?verify=${encodeURIComponent(certificate.id)}`;
    }

    function showQrModal(certificate) {
        removeModal();

        const verificationUrl = getVerificationUrl(certificate);
        const qrUrl = `${QR_API}${encodeURIComponent(verificationUrl)}`;

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modalbg qr-system-modal">
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="qrTitle">
                    <button class="close qr-close" type="button" aria-label="Close">×</button>
                    <h2 id="qrTitle">Certificate QR Code</h2>

                    <div style="text-align:center;margin:20px 0">
                        <img
                            src="${qrUrl}"
                            alt="QR code for certificate ${escapeHtml(certificate.id)}"
                            width="240"
                            height="240"
                            loading="lazy"
                            style="max-width:100%;border:12px solid #fff;box-shadow:0 4px 18px #0002">
                    </div>

                    <div class="notice">
                        Scan this QR code to verify certificate
                        <b>${escapeHtml(certificate.id)}</b>.
                    </div>

                    <div style="margin-top:18px">
                        <p><b>Applicant:</b> ${escapeHtml(certificate.applicant)}</p>
                        <p><b>Instrument:</b> ${escapeHtml(certificate.instrument)}</p>
                        <p><b>Status:</b> ${escapeHtml(certificate.status)}</p>
                    </div>

                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
                        <button class="btn primary qr-download" type="button">⬇ Download QR</button>
                        <button class="btn secondary qr-verify" type="button">✓ Verify Certificate</button>
                    </div>
                </div>
            </div>
        `);

        const modal = document.querySelector('.qr-system-modal');
        modal.querySelector('.qr-close').addEventListener('click', removeModal);
        modal.querySelector('.qr-download').addEventListener('click', () => {
            downloadQr(qrUrl, certificate.id);
        });
        modal.querySelector('.qr-verify').addEventListener('click', () => {
            verifyCertificate(certificate.id);
        });
        modal.addEventListener('click', event => {
            if (event.target === modal) removeModal();
        });
    }

    function downloadQr(qrUrl, certificateId) {
        const link = document.createElement('a');
        link.href = qrUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.download = `${certificateId.replaceAll('/', '-')}-qr.png`;
        link.click();

        if (typeof toast === 'function') toast('QR code opened for download');
    }

    function verifyCertificate(certificateId) {
        const row = [...document.querySelectorAll('.table tbody tr')]
            .find(item => item.cells[0]?.textContent.trim() === certificateId);

        if (!row) {
            if (typeof toast === 'function') {
                toast('Certificate verification data is unavailable');
            }
            return;
        }

        const certificate = getCertificateData(row);
        removeModal();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modalbg qr-system-modal">
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="verificationTitle">
                    <button class="close qr-close" type="button" aria-label="Close">×</button>
                    <h2 id="verificationTitle">Certificate Verification</h2>

                    <div class="notice" style="color:var(--green);background:var(--green-soft);border-color:#b7e3c8">
                        ✓ Certificate record found
                    </div>

                    <div class="card" style="margin-top:18px">
                        <p><b>Certificate ID:</b> ${escapeHtml(certificate.id)}</p>
                        <p><b>Applicant:</b> ${escapeHtml(certificate.applicant)}</p>
                        <p><b>Instrument:</b> ${escapeHtml(certificate.instrument)}</p>
                        <p><b>Issued On:</b> ${escapeHtml(certificate.issuedOn)}</p>
                        <p><b>Valid Until:</b> ${escapeHtml(certificate.validUntil)}</p>
                        <p><b>Status:</b> ${escapeHtml(certificate.status)}</p>
                    </div>

                    <button class="btn primary qr-close-action" type="button" style="width:100%;margin-top:18px">
                        Close
                    </button>
                </div>
            </div>
        `);

        const modal = document.querySelector('.qr-system-modal');
        modal.querySelectorAll('.qr-close, .qr-close-action')
            .forEach(button => button.addEventListener('click', removeModal));
        modal.addEventListener('click', event => {
            if (event.target === modal) removeModal();
        });
    }

    function addQrButtons() {
        document.querySelectorAll('.table tbody tr').forEach(row => {
            const cells = row.cells;
            const actionCell = cells[cells.length - 1];

            if (!actionCell || actionCell.dataset.qrReady === 'true') return;

            const hasCertificateId = cells[0]?.textContent.includes('/');
            const hasDownloadButton = [...actionCell.querySelectorAll('button')]
                .some(button => button.textContent.toLowerCase().includes('download'));

            if (!hasCertificateId || !hasDownloadButton) return;

            const button = document.createElement('button');
            button.className = 'btn secondary qr-button';
            button.type = 'button';
            button.textContent = '▦ QR';
            button.addEventListener('click', () => showQrModal(getCertificateData(row)));

            actionCell.appendChild(button);
            actionCell.dataset.qrReady = 'true';
        });
    }

    async function showVerificationFromUrl() {
        const value = new URLSearchParams(location.search).get('verify');
        if (!value) return;

        try {
            const response = await fetch(`/api/certificates/${encodeURIComponent(value)}/public`);
            if (!response.ok) throw new Error('Certificate not found');
            const { certificate } = await response.json();
            const isValid = ['Active', 'Expiring Soon'].includes(certificate.status);

            document.body.insertAdjacentHTML('beforeend', `
                <div class="modalbg qr-system-modal">
                    <div class="modal" role="dialog" aria-modal="true">
                        <h2>Certificate Verification</h2>
                        <div class="notice" style="color:${isValid ? 'var(--green)' : 'var(--red)'};background:${isValid ? 'var(--green-soft)' : 'var(--red-soft)'};border-color:${isValid ? '#b7e3c8' : '#f0b6ad'}">
                            ${isValid ? '✓ Certificate is valid in OVS-WM' : '⚠ Certificate record is not currently valid'}
                        </div>
                        <p><b>Certificate ID:</b> ${escapeHtml(certificate.id)}</p>
                        <p><b>Applicant:</b> ${escapeHtml(certificate.applicant)}</p>
                        <p><b>Instrument:</b> ${escapeHtml(certificate.instrument)}</p>
                        <p><b>Status:</b> ${escapeHtml(certificate.status)}</p>
                    </div>
                </div>
            `);
        } catch {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modalbg qr-system-modal">
                    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="verificationTitle">
                        <h2 id="verificationTitle">Certificate Verification</h2>
                        <div class="notice" style="color:var(--red);background:var(--red-soft);border-color:#f1b8b3">
                            Certificate not found or no longer valid.
                        </div>
                    </div>
                </div>
            `);
        }
    }

    window.qrSystemDownload = downloadQr;
    window.qrSystemVerify = verifyCertificate;

    let updateQueued = false;
    const observer = new MutationObserver(() => {
        if (updateQueued) return;

        updateQueued = true;
        requestAnimationFrame(() => {
            updateQueued = false;
            addQrButtons();
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            addQrButtons();
            showVerificationFromUrl();
        }, { once: true });
    } else {
        addQrButtons();
        showVerificationFromUrl();
    }
})();