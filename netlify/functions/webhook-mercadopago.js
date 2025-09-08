// netlify/functions/webhook-mercadopago.js
export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    const body = JSON.parse(event.body);
    console.log("Webhook recebido:", body);

    // Dados Evolution API
    const API_URL = "https://evolution-api-ny08.onrender.com/message/sendText/marmexp";
    const API_TOKEN = "91910192";

    // Mensagem a ser enviada
    const payload = {
      number: "5511987713651", // Seu número WhatsApp com DDI
      options: { delay: 123, presence: "composing" },
      textMessage: { text: "WebHook recebido ! Dados: \n" + JSON.stringify(body) }
    };

    // Envia mensagem
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": API_TOKEN
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("Resposta Evolution API:", result);

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, evolution: result })
    };
  } catch (error) {
    console.error("Erro no webhook:", error);
    return {
      statusCode: 400,
      body: "Invalid payload"
    };
  }
}
