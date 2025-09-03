const fetch = globalThis.fetch;


exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    const body = JSON.parse(event.body);

    // Substitua pelas suas chaves reais (use variáveis de ambiente no Netlify)
    const API_KEY = process.env.DLOCAL_API_KEY;
    const API_SECRET = process.env.DLOCAL_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Credenciais da API não configuradas' }),
      };
    }

const API_URL = process.env.DLOCAL_ENV === "sandbox"
  ? "https://api-sbx.dlocalgo.com/v1/payments"
  : "https://api.dlocalgo.com/v1/payments";

const dlocalResponse = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}:${API_SECRET}`,
  },
  body: JSON.stringify({
    currency: 'BRL',
    amount: Math.round(body.amount * 100),
    country: 'BR',
    order_id: body.order_id,
    description: `Pedido ${body.order_id} - Marmitaria Express`,
    success_url: process.env.SUCCESS_URL || 'https://example.com/success',
    back_url: process.env.BACK_URL || 'https://example.com/',
    notification_url: body.notification_url,
    payer: body.payer,
  }),
});


    const responseData = await dlocalResponse.json();

    if (!dlocalResponse.ok) {
      console.error('Erro da DLocal:', responseData);
      return {
        statusCode: dlocalResponse.status,
        body: JSON.stringify({ error: responseData.message || 'Erro ao criar pagamento' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        redirect_url: responseData.redirect_url,
      }),
    };

  } catch (error) {
    console.error('Erro interno:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno no servidor' }),
    };
  }
};
