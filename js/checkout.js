document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.querySelector('#checkoutBtn');
  const orderTotal = document.querySelector('#orderTotal');

  if (!checkoutBtn) return;

  checkoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const payload = {
      amount: parseFloat(orderTotal.textContent.replace(/[^0-9,]/g, '').replace(',', '.')) * 100, // em centavos
      description: "Promoção 2 marmitas"
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

    // Redireciona para o checkout do Mercado Pago
    window.location.href = init_point;
  });
});
