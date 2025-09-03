document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.querySelector('#checkoutBtn');
  const nomeInput = document.querySelector('#nomeInput');
  const cpfInput = document.querySelector('#cpfInput'); // Corrigido
  const cpfCheck = document.querySelector('#cpfCheck');
  const stateSelect = document.querySelector('#state');
  const citySelect = document.querySelector('#city');
  const cepInput = document.querySelector('#cepInput');
  const ruaInput = document.querySelector('#ruaInput'); // Corrigido
  const numeroInput = document.querySelector('#numeroInput'); // Corrigido
  const orderTotal = document.querySelector('#orderTotal');

  if (!checkoutBtn) return;

  checkoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const payload = {
      amount: parseFloat(orderTotal.textContent.replace(/[^0-9,]/g, '').replace(',', '.')),
      currency: 'BRL',
      order_id: `order-${Date.now()}`,
      payer: {
        name: nomeInput.value,
        email: '', // Pode adicionar campo de email se desejar
        document: cpfCheck.checked ? cpfInput.value.replace(/\D/g, '') : '',
        address: {
          state: stateSelect.value,
          city: citySelect.value,
          zip_code: cepInput.value.replace(/\D/g, ''),
          street: ruaInput.value,
          number: numeroInput.value
        }
      },
      notification_url: `${window.location.origin}/.netlify/functions/notifications`
    };

    const resp = await fetch('/.netlify/functions/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const { redirect_url, error } = await resp.json();
    if (error) return alert('Erro ao criar pagamento: ' + error);
    window.location.href = redirect_url;
  });
});
