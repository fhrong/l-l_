const fetch = globalThis.fetch;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Método não permitido" };
    }

    const body = JSON.parse(event.body);

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, // Access Token definido no Netlify
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: body.description,
            quantity: 1,
            currency_id: "BRL",
            unit_price: body.amount / 100, // volta de centavos para reais
          }
        ],
        back_urls: {
          success: process.env.SUCCESS_URL,
          failure: process.env.BACK_URL,
          pending: process.env.BACK_URL,
        },
        auto_return: "approved",
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify(data) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ init_point: data.init_point }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
