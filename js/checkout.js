document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.querySelector('#checkoutBtn');
  const orderTotal = document.querySelector('#orderTotal');
  // Address fields
  const nomeInput = document.getElementById('nomeInput');
  const cepInput = document.getElementById('cepInput');
  const ruaInput = document.getElementById('ruaInput');
  const numeroInput = document.getElementById('numeroInput');
  const bairroInput = document.getElementById('bairroInput');
  const phoneInput = document.getElementById('phoneInput');
  const cpfCheck = document.getElementById('cpfCheck');
  const cpfInput = document.getElementById('cpfInput');

  // Insert warning message container
  let warnMsg = document.getElementById('checkoutWarnMsg');
  if (!warnMsg && checkoutBtn) {
    warnMsg = document.createElement('div');
    warnMsg.id = 'checkoutWarnMsg';
    warnMsg.style = 'color:#ff3c00;background:#fffbe6;border-radius:8px;padding:10px 14px;margin:12px 0 0 0;font-weight:700;display:none;text-align:center;';
    checkoutBtn.parentNode.insertBefore(warnMsg, checkoutBtn);
  }

  if (!checkoutBtn) return;

  function validateFields() {
    let valid = true;
    let missing = [];
    // Remove previous highlights
    [nomeInput, cepInput, ruaInput, numeroInput, phoneInput].forEach(f => { if (f) f.style.borderColor = ''; });
    if (nomeInput && !nomeInput.value.trim()) { nomeInput.style.borderColor = 'red'; valid = false; missing.push('nome'); }
    if (cepInput && !cepInput.value.trim()) { cepInput.style.borderColor = 'red'; valid = false; missing.push('CEP'); }
    if (ruaInput && !ruaInput.value.trim()) { ruaInput.style.borderColor = 'red'; valid = false; missing.push('rua'); }
    if (numeroInput && !numeroInput.value.trim()) { numeroInput.style.borderColor = 'red'; valid = false; missing.push('número'); }
    if (phoneInput) {
      const p = phoneInput.value.replace(/\D/g, '');
      if (!p || p.length < 10) { phoneInput.style.borderColor = 'red'; valid = false; missing.push('celular'); }
    }
    if (cpfCheck && cpfCheck.checked) {
      if (!cpfInput.value.trim() || !validateCPF(cpfInput.value)) { cpfInput.style.borderColor = 'red'; valid = false; missing.push('CPF'); }
    }
    return { valid, missing };
  }

  // Simple CPF validation (same as in script.js)
  function validateCPF(cpf) {
    cpf = (cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11; if (rest === 10 || rest === 11) rest = 0; if (rest !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11; if (rest === 10 || rest === 11) rest = 0; if (rest !== parseInt(cpf.substring(10, 11))) return false;
    return true;
  }

  checkoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    if (warnMsg) warnMsg.style.display = 'none';

    const { valid, missing } = validateFields();
    if (!valid) {
      if (warnMsg) {
        warnMsg.textContent = 'Por favor, preencha corretamente: ' + missing.join(', ') + '.';
        warnMsg.style.display = 'block';
      }
      // Scroll to warning
      warnMsg?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const orderId = 'order_' + Date.now();

    const payload = {
      amount: parseFloat(orderTotal.textContent.replace(/[^0-9,]/g, '').replace(',', '.')) * 100,
      description: "Promoção 2 marmitas",
      notification_url: "https://marmexp.netlify.app/webhook/mercadopago",
      external_reference: orderId
    };

    const resp = await fetch('/.netlify/functions/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const { init_point, error } = await resp.json();

    if (error) {
      if (warnMsg) {
        warnMsg.textContent = 'Erro ao criar pagamento: ' + error;
        warnMsg.style.display = 'block';
      }
      return;
    }

    window.location.href = init_point;
  });
});
