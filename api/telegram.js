module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ok");

  const token = process.env.BOT_TOKEN;
  const adminChatId = process.env.ADMIN_CHAT_ID; // 41830773

  if (!token) return res.status(500).send("BOT_TOKEN missing");
  if (!adminChatId) return res.status(500).send("ADMIN_CHAT_ID missing");

  const update = req.body || {};
  const msg = update.message || {};
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();

  // /id — узнать chat_id
  if (text === "/id" && chatId) {
    await sendMessage(token, chatId, "Ваш chat_id: " + chatId);
    return res.status(200).json({ ok: true });
  }

  // ✅ Заказ через deep link: /start order_<PRODUCT_ID>
  // Пример: /start order_abc123
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const payload = (parts[1] || "").trim();

    if (payload.startsWith("order_")) {
      const productId = payload.slice("order_".length);
      const link = "https://flower-app-ten.vercel.app/?p=" + encodeURIComponent(productId);

      const adminText =
        "🛒 НОВЫЙ ЗАКАЗ (deep link)\n\n" +
        "Товар ID: " + productId + "\n" +
        "Ссылка: " + link + "\n" +
        "Клиент chat_id: " + (chatId ? chatId : "неизвестно");

      await sendMessage(token, adminChatId, adminText, link);

      if (chatId) {
        const clientText =
          "✅ Заказ принят! Мы скоро свяжемся с вами.\n\n" +
          "Ссылка на букет: " + link;

        await sendMessage(token, chatId, clientText, link);
      }

      return res.status(200).json({ ok: true });
    }

    // обычный /start без payload
    if (chatId) {
      await sendMessage(token, chatId, "Привет! Открой витрину через кнопку меню 🙂");
    }
    return res.status(200).json({ ok: true });
  }

  // если пришло что-то другое — просто OK
  return res.status(200).json({ ok: true });
};

async function sendMessage(token, chatId, text, link) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
  };

  if (link) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "🌸 Открыть букет", url: link }]],
    };
  }

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!json.ok) throw new Error(json.description || "sendMessage failed");
  return json;
}
