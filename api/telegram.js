module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ok");

  const token = process.env.BOT_TOKEN;
  const adminChatId = process.env.ADMIN_CHAT_ID; // 41830773

  if (!token) return res.status(500).send("BOT_TOKEN missing");
  if (!adminChatId) return res.status(500).send("ADMIN_CHAT_ID missing");

  const update = req.body || {};
  const msg = update.message || {};
  const chatId = msg?.chat?.id;
  const text = msg?.text || "";
  const wad = msg?.web_app_data?.data;

  // /id — узнать chat_id
  if (text === "/id" && chatId) {
    await sendMessage(token, chatId, "Ваш chat_id: " + chatId);
    return res.status(200).json({ ok: true });
  }

  // Заказ из WebApp
  if (wad) {
    let data = null;
    try { data = JSON.parse(wad); } catch (e) {}

    if (data && data.type === "order") {
      const name = data.name || "Букет";
      const price = (data.price || data.price === 0) ? (String(data.price) + " ₽") : "-";
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

      await sendMessage(token, adminChatId, adminText, link);

      if (chatId) {
        const clientText =
          "✅ Заказ принят! Мы скоро свяжемся с вами.\n\n" +
          (link ? "Ссылка на букет: " + link : "");
        await sendMessage(token, chatId, clientText, link);
      }
    }
  }

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
