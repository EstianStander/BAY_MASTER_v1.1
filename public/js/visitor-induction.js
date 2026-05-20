document.addEventListener('DOMContentLoaded', () => {
  const workshopBtn = document.getElementById('visitor-type-workshop');
  const visitorBtn = document.getElementById('visitor-type-visitor');
  const workshopPanel = document.getElementById('visitor-form-panel');
  const visitorPanel = document.getElementById('visitor-simple-panel');
  const switchToWorkshop = document.getElementById('switch-to-workshop');
  const form = document.getElementById('visitor-induction-form');
  const statusEl = document.getElementById('visitor-form-status');

  const setVisitorType = (type) => {
    const isWorkshop = type === 'workshop';
    workshopBtn.classList.toggle('is-active', isWorkshop);
    visitorBtn.classList.toggle('is-active', !isWorkshop);
    workshopPanel.hidden = !isWorkshop;
    visitorPanel.hidden = isWorkshop;
    if (isWorkshop) {
      workshopPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  workshopBtn?.addEventListener('click', () => setVisitorType('workshop'));
  visitorBtn?.addEventListener('click', () => setVisitorType('visitor'));
  switchToWorkshop?.addEventListener('click', () => setVisitorType('workshop'));
  setVisitorType('workshop');

  const canvas = document.getElementById('signature-pad');
  const clearBtn = document.getElementById('signature-clear');
  const output = document.getElementById('signature-data');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
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
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

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

  canvas.addEventListener('pointerdown', startDrawing);
  canvas.addEventListener('pointermove', drawLine);
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointerleave', stopDrawing);

  clearBtn?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasDefaults();
    output.value = '';
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (!output.value) {
      if (statusEl) statusEl.textContent = 'Please add a signature before submitting.';
      return;
    }

    if (statusEl) statusEl.textContent = 'Submitting induction...';

    const payload = {
      visitorType: workshopBtn?.classList.contains('is-active') ? 'workshop' : 'visitor',
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
