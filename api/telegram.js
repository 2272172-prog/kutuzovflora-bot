export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ok");

  const token = process.env.BOT_TOKEN;
  const adminChatId = process.env.ADMIN_CHAT_ID; // 41830773
  if (!token) return res.status(500).send("BOT_TOKEN missing");
  if (!adminChatId) return res.status(500).send("ADMIN_CHAT_ID missing");

  const update = req.body || {};

  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text || "";
  const wad = update?.message?.web_app_data?.data;

  // Узнать свой chat_id
  if (text === "/id" && chatId) {
    await sendMessage(token, chatId, "Ваш chat_id: " + chatId);
    return res.status(200).json({ ok: true });
  }

  // Заказ из WebApp
  if (wad) {
    let data = null;
    try { data = JSON.parse(wad); } catch {}

    if (data?.type === "order") {
      const name = data.name || "Букет";
      const price = (data.price || data.price === 0) ? `${data.price} ₽` : "-";
      const desc = (data.desc || "").trim();
      const img = data.img || "";
      const link = data.link || "";

      const adminText =
        "🛒 НОВЫЙ ЗАКАЗ\n\n" +
        "Букет: " + name + "\n" +
        "Цена: " + price + "\n" +
        (desc ? "\nОписание:\n" + desc + "\n" : "") +
        (img ? "\nФото: " + img + "\n" : "") +
        (link ? "\nСсылка: " + link + "\n" : "") +
        "\nКлиент chat_id: " + (chatId ? chatId : "неизвестно");

      // 1) Сообщение админу (тебе)
      await sendMessage(token, adminChatId, adminText, link);

      // 2) Подтверждение клиенту
      if (chatId) {
        const clientText =
          "✅ Заказ принят! Мы скоро свяжемся с вами.\n\n" +
          (link ? "Ссылка на букет: " + link : "");
        await sendMessage(token, chatId, clientText, link);
      }
    }
  }

  return res.status(200).json({ ok: true });
}

async function sendMessage(token, chatId, text, link) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
  };

  // Кнопка "Открыть букет"
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
  if (!json.ok) {
    console.error("Telegram error:", json);
    throw new Error(json.description || "sendMessage failed");
  }
  return json;
}
