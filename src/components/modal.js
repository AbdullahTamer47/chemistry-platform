export function showModal(title, content, onClose) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modalClose"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="modal-body">${content}</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); if (onClose) onClose(); };
  overlay.querySelector('#modalClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { close, overlay };
}

export function confirmModal(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
        </div>
        <div class="modal-body">
          <p style="margin-bottom:20px;color:var(--text-secondary)">${message}</p>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="btn btn-ghost" id="modalCancel">إلغاء</button>
            <button class="btn btn-danger" id="modalConfirm">تأكيد</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#modalCancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.querySelector('#modalConfirm').addEventListener('click', () => { overlay.remove(); resolve(true); });
  });
}
