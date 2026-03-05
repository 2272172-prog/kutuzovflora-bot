module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ok");

  const token = process.env.BOT_TOKEN;
  const adminChatId = String(process.env.ADMIN_CHAT_ID || "").trim(); // "1144072957"

  if (!token) return res.status(500).send("BOT_TOKEN missing");
  if (!adminChatId) return res.status(500).send("ADMIN_CHAT_ID missing");

  const update = req.body || {};
  const msg = update.message || {};
  const chatId = msg?.chat?.id ? String(msg.chat.id) : null;
  const text = (msg?.text || "").trim();

  // /id — узнать chat_id
  if (text === "/id" && chatId) {
    await sendMessage(token, chatId, "Ваш chat_id: " + chatId);
    return res.status(200).json({ ok: true });
  }

  // Клиент отправил номер (Contact)
  if (msg?.contact && chatId) {
    const c = msg.contact;
    const phone = c.phone_number ? String(c.phone_number) : "";
    const first = c.first_name ? String(c.first_name) : "";
    const last = c.last_name ? String(c.last_name) : "";
    const userId = c.user_id ? String(c.user_id) : "";

    const who =
      (first || last ? (first + (last ? " " + last : "")) : "Клиент") +
      (userId ? " (id " + userId + ")" : "");

    const adminText =
      "📞 Номер телефона получен\n\n" +
      who + "\n" +
      (phone ? ("Телефон: +" + phone.replace(/^\+/, "") + "\n") : "") +
      (userId ? ("Написать: tg://user?id=" + userId) : "");

    await sendMessage(token, adminChatId, adminText);

    // клиенту спасибо
    await sendMessage(token, chatId, "✅ Спасибо! Мы получили ваш номер и скоро свяжемся.");
    return res.status(200).json({ ok: true });
  }

  // /start payload
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const payload = (parts[1] || "").trim();

    // заказ: /start order_<PRODUCT_ID>
    if (payload.startsWith("order_")) {
      const productId = payload.slice("order_".length);
      const link = "https://flower-app-ten.vercel.app/?p=" + encodeURIComponent(productId);

      const from = msg.from || {};
      const userId = from.id ? String(from.id) : "";
      const username = from.username ? "@" + String(from.username) : "";
      const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();

      // ---- админу ----
      const adminText =
        "🛒 НОВЫЙ ЗАКАЗ\n\n" +
        "Товар ID: " + productId + "\n" +
        "Ссылка: " + link + "\n\n" +
        "Клиент: " + (fullName || "—") + "\n" +
        (username ? ("Username: " + username + "\n") : "") +
        (userId ? ("user_id: " + userId + "\n") : "");

      const adminButtons = [];
      if (userId) {
        // tg://user?id=... работает в Telegram-клиентах
        adminButtons.push([{ text: "✍️ Написать клиенту", url: "tg://user?id=" + userId }]);
      }
      adminButtons.push([{ text: "🌸 Открыть букет", url: link }]);

      await sendMessage(token, adminChatId, adminText, adminButtons);

      // ---- клиенту ----
      // чтобы у тебя при тесте не было “2 сообщений в одном чате”
      if (chatId && chatId !== adminChatId) {
        const clientText =
          "✅ Заказ принят! Мы скоро свяжемся с вами.\n\n" +
          "Ваш букет: " + link;

        const clientButtons = [
          [{ text: "🌸 Открыть букет", url: link }],
          [{ text: "📞 Отправить телефон", request_contact: true }],
        ];

        await sendMessage(token, chatId, clientText, clientButtons);
      }

      return res.status(200).json({ ok: true });
    }

    // обычный /start
    if (chatId) {
      await sendMessage(token, chatId, "Привет! Открой витрину через кнопку меню 🙂");
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
};

// Универсальная отправка сообщения с кнопками
async function sendMessage(token, chatId, text, inlineKeyboardOrContactKeyboard) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
  };

  // Если передали массив кнопок — это inline keyboard
  if (Array.isArray(inlineKeyboardOrContactKeyboard)) {
    // Если внутри есть request_contact — это уже НЕ inline, а обычная клавиатура (reply keyboard)
    const hasContact =
      inlineKeyboardOrContactKeyboard.some((row) =>
        row.some((btn) => btn && typeof btn === "object" && btn.request_contact)
      );

    if (hasContact) {
      // reply keyboard
      payload.reply_markup = {
        keyboard: inlineKeyboardOrContactKeyboard,
        resize_keyboard: true,
        one_time_keyboard: true,
      };
    } else {
      // inline keyboard
      payload.reply_markup = {
        inline_keyboard: inlineKeyboardOrContactKeyboard,
      };
    }
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
