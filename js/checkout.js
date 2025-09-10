document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.querySelector('#checkoutBtn');
  const orderTotal = document.querySelector('#orderTotal');

  if (!checkoutBtn) return;

  checkoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (typeof window.isOrderFormValid === 'function' && !window.isOrderFormValid(true)) {
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
      alert('Erro ao criar pagamento: ' + error);
      return;
    }

    window.location.href = init_point;
  });
});
