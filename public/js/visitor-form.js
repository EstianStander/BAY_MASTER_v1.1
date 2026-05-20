document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('visitor-form');
  const statusEl = document.getElementById('visitor-form-status');
  const canvas = document.getElementById('signature-pad');
  const clearBtn = document.getElementById('signature-clear');
  const output = document.getElementById('signature-data');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('recordId');
  const isViewMode = params.get('mode') === 'view' && Boolean(recordId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let signatureImage = null;
  const setCanvasDefaults = () => {
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f1f1f';
  };

  const resizeCanvas = () => {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    setCanvasDefaults();
    if (signatureImage) {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(signatureImage, 0, 0, rect.width || 640, rect.height || 220);
    }
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const todayIso = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setDateValue = (inputId, value) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (!value) {
      input.value = '';
      return;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      input.value = value.slice(0, 10);
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      input.value = '';
      return;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    input.value = `${year}-${month}-${day}`;
  };

  const setInputValue = (inputId, value) => {
    const input = document.getElementById(inputId);
    if (input) input.value = value || '';
  };

  const drawSignatureImage = (imageUrl) => {
    if (!imageUrl) return;
    const image = new Image();
    image.onload = () => {
      signatureImage = image;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, rect.width || 640, rect.height || 220);
    };
    image.src = imageUrl;
  };

  const applyReadOnlyState = () => {
    if (!form) return;
    form.querySelectorAll('input, select, textarea, button').forEach((element) => {
      if (element.id === 'signature-data') return;
      element.disabled = true;
    });
    canvas.style.pointerEvents = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Viewing saved visitor submission.';
  };

  const loadRecordForView = async () => {
    if (!recordId) return;
    if (statusEl) statusEl.textContent = 'Loading visitor details...';

    try {
      const response = await fetch(`/api/visitors/${encodeURIComponent(recordId)}`);
      const result = await response.json();
      if (!response.ok) {
        if (statusEl) statusEl.textContent = result?.error || 'Failed to load visitor details.';
        return;
      }

      setDateValue('induction-date', result.inductionDate);
      setInputValue('visitor-company', result.delivery?.company || result.visitor?.company);
      setInputValue('visitor-contact', result.delivery?.contactNo || result.visitor?.contactNo);
      setInputValue('visitor-name', result.delivery?.name || result.visitor?.name);
      drawSignatureImage(result.signatureUrl);
      applyReadOnlyState();
    } catch (error) {
      if (statusEl) statusEl.textContent = 'Network error while loading visitor details.';
    }
  };

  let drawing = false;
  let lastPoint = { x: 0, y: 0 };

  const getPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const startDrawing = (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    lastPoint = getPoint(event);
  };

  const drawLine = (event) => {
    if (!drawing) return;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
  };

  const stopDrawing = (event) => {
    if (!drawing) return;
    drawing = false;
    canvas.releasePointerCapture(event.pointerId);
    output.value = canvas.toDataURL('image/png');
  };

  if (!isViewMode) {
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', drawLine);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);
  }

  if (!isViewMode) {
    clearBtn?.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasDefaults();
      output.value = '';
    });
  }

  if (isViewMode) {
    loadRecordForView();
    return;
  }

  setDateValue('induction-date', todayIso());

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (!output.value) {
      if (statusEl) statusEl.textContent = 'Please add a signature before submitting.';
      return;
    }

    if (statusEl) statusEl.textContent = 'Submitting visitor...';

    const payload = {
      visitorType: 'delivery',
      inductionDate: document.getElementById('induction-date')?.value || '',
      visitor: {
        company: document.getElementById('visitor-company')?.value || '',
        contactNo: document.getElementById('visitor-contact')?.value || '',
        name: document.getElementById('visitor-name')?.value || ''
      },
      signatureData: output.value
    };

    try {
      const response = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        const message = result?.error || 'Failed to submit visitor.';
        if (statusEl) statusEl.textContent = message;
        return;
      }

      if (statusEl) statusEl.textContent = 'Delivery submitted successfully.';
      form.reset();
      setDateValue('induction-date', todayIso());
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasDefaults();
      output.value = '';
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Network error while submitting. Please try again.';
    }
  });
});
