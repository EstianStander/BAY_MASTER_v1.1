document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('visitor-induction-form');
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

  const setCheckboxValue = (name, checked) => {
    const input = document.querySelector(`input[name="${name}"]`);
    if (input) input.checked = Boolean(checked);
  };

  const setRadioValue = (name, value) => {
    if (!value) return;
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
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
    if (statusEl) statusEl.textContent = 'Viewing saved workshop submission.';
  };

  const loadRecordForView = async () => {
    if (!recordId) return;
    if (statusEl) statusEl.textContent = 'Loading workshop details...';

    try {
      const response = await fetch(`/api/visitors/${encodeURIComponent(recordId)}`);
      const result = await response.json();
      if (!response.ok) {
        if (statusEl) statusEl.textContent = result?.error || 'Failed to load workshop details.';
        return;
      }

      setDateValue('induction-date', result.inductionDate);
      setDateValue('induction-valid-until', result.validUntil);

      setCheckboxValue('ppe_helmet_own', result.ppe?.safetyHelmet?.own);
      setCheckboxValue('ppe_helmet_loan', result.ppe?.safetyHelmet?.loan);
      setCheckboxValue('ppe_boots_own', result.ppe?.safetyBoots?.own);
      setCheckboxValue('ppe_boots_loan', result.ppe?.safetyBoots?.loan);
      setCheckboxValue('ppe_overalls_own', result.ppe?.overalls?.own);
      setCheckboxValue('ppe_overalls_loan', result.ppe?.overalls?.loan);
      setCheckboxValue('ppe_eye_own', result.ppe?.eyeProtection?.own);
      setCheckboxValue('ppe_eye_loan', result.ppe?.eyeProtection?.loan);
      setCheckboxValue('ppe_hearing_own', result.ppe?.hearingProtection?.own);
      setCheckboxValue('ppe_hearing_loan', result.ppe?.hearingProtection?.loan);
      setCheckboxValue('ppe_gloves_own', result.ppe?.gloves?.own);
      setCheckboxValue('ppe_gloves_loan', result.ppe?.gloves?.loan);
      setCheckboxValue('ppe_harness_own', result.ppe?.safetyHarness?.own);
      setCheckboxValue('ppe_harness_loan', result.ppe?.safetyHarness?.loan);
      setCheckboxValue('ppe_heights_training', result.ppe?.heightsTraining);

      setRadioValue('medical_diabetes', result.medical?.diabetes);
      setRadioValue('medical_epilepsy', result.medical?.epilepsy);
      setRadioValue('medical_hypertension', result.medical?.hypertension);
      setRadioValue('medical_tuberculosis', result.medical?.tuberculosis);
      setRadioValue('medical_asthma', result.medical?.asthma);
      setRadioValue('declare_vision', result.medical?.vision);
      setRadioValue('declare_hearing', result.medical?.hearing);
      setRadioValue('declare_drugs', result.medical?.drugs);
      setRadioValue('declare_alcohol', result.medical?.alcohol);

      setInputValue('visitor-company', result.visitor?.company);
      setInputValue('visitor-contact', result.visitor?.contactNo);
      setInputValue('visitor-name', result.visitor?.name);
      setInputValue('visitor-id', result.visitor?.idNumber);

      drawSignatureImage(result.signatureUrl);
      applyReadOnlyState();
    } catch (error) {
      if (statusEl) statusEl.textContent = 'Network error while loading workshop details.';
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

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (!output.value) {
      if (statusEl) statusEl.textContent = 'Please add a signature before submitting.';
      return;
    }

    if (statusEl) statusEl.textContent = 'Submitting induction...';

    const payload = {
      visitorType: 'workshop',
      inductionDate: document.getElementById('induction-date')?.value || '',
      validUntil: document.getElementById('induction-valid-until')?.value || '',
      ppe: {
        safetyHelmet: {
          own: document.querySelector('input[name="ppe_helmet_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_helmet_loan"]')?.checked || false
        },
        safetyBoots: {
          own: document.querySelector('input[name="ppe_boots_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_boots_loan"]')?.checked || false
        },
        overalls: {
          own: document.querySelector('input[name="ppe_overalls_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_overalls_loan"]')?.checked || false
        },
        eyeProtection: {
          own: document.querySelector('input[name="ppe_eye_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_eye_loan"]')?.checked || false
        },
        hearingProtection: {
          own: document.querySelector('input[name="ppe_hearing_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_hearing_loan"]')?.checked || false
        },
        gloves: {
          own: document.querySelector('input[name="ppe_gloves_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_gloves_loan"]')?.checked || false
        },
        safetyHarness: {
          own: document.querySelector('input[name="ppe_harness_own"]')?.checked || false,
          loan: document.querySelector('input[name="ppe_harness_loan"]')?.checked || false
        },
        heightsTraining: document.querySelector('input[name="ppe_heights_training"]')?.checked || false
      },
      medical: {
        diabetes: document.querySelector('input[name="medical_diabetes"]:checked')?.value || '',
        epilepsy: document.querySelector('input[name="medical_epilepsy"]:checked')?.value || '',
        hypertension: document.querySelector('input[name="medical_hypertension"]:checked')?.value || '',
        tuberculosis: document.querySelector('input[name="medical_tuberculosis"]:checked')?.value || '',
        asthma: document.querySelector('input[name="medical_asthma"]:checked')?.value || '',
        vision: document.querySelector('input[name="declare_vision"]:checked')?.value || '',
        hearing: document.querySelector('input[name="declare_hearing"]:checked')?.value || '',
        drugs: document.querySelector('input[name="declare_drugs"]:checked')?.value || '',
        alcohol: document.querySelector('input[name="declare_alcohol"]:checked')?.value || ''
      },
      visitor: {
        company: document.getElementById('visitor-company')?.value || '',
        contactNo: document.getElementById('visitor-contact')?.value || '',
        name: document.getElementById('visitor-name')?.value || '',
        idNumber: document.getElementById('visitor-id')?.value || ''
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
        const message = result?.error || 'Failed to submit induction.';
        if (statusEl) statusEl.textContent = message;
        return;
      }

      if (statusEl) statusEl.textContent = 'Induction submitted successfully.';
      form.reset();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasDefaults();
      output.value = '';
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Network error while submitting. Please try again.';
    }
  });
});
