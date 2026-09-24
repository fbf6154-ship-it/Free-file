/**
 * Telegram File Store Bot Server
 * Auto-Parse Telegram Message Links (Zero Forward Tags)
 * Bot Token: 8914672895:AAEAKLnsTMhfwjTUeRXGNOo_JDcARdXOtk0
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');

const BOT_TOKEN = '8914672895:AAEAKLnsTMhfwjTUeRXGNOo_JDcARdXOtk0';
const REQUIRED_CHANNELS = ['@a54auraax', '@FHx_Technical'];
const WEBAPP_URL = 'https://freefile.fahimfaysal.shop/index.html';
const FIREBASE_DB_URL = 'https://freefile-a561a-default-rtdb.asia-southeast1.firebasedatabase.app';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'Online', bot: 'Running', time: new Date() });
});

// Helper Function: Parse Any Telegram Post Link (Private /c/ or Public)
function parseTelegramLink(url) {
  if (!url || !url.includes('t.me/')) return null;
  
  // 1. Private Channel Format: https://t.me/c/2145678901/45
  const privateMatch = url.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (privateMatch) {
    return {
      chatId: '-100' + privateMatch[1], // Telegram private channel ID prefix
      messageId: parseInt(privateMatch[2])
    };
  }

  // 2. Public Channel Format: https://t.me/channel_name/45
  const publicMatch = url.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
  if (publicMatch && publicMatch[1] !== 'c') {
    return {
      chatId: '@' + publicMatch[1],
      messageId: parseInt(publicMatch[2])
    };
  }

  return null;
}

// API Endpoint to Deliver File cleanly
app.post('/api/send-file', async (req, res) => {
  const { userId, fileTitle, fileDesc, postLink } = req.body;

  if (!userId) return res.status(400).json({ success: false, error: 'User ID missing' });

  const captionText = `🎉 *অভিনন্দন! আপনি সফলভাবে ফাইলটি সংগ্রহ করেছেন।*\n\n` +
    `📂 *ফাইলের নাম:* ${fileTitle}\n` +
    `📝 *বিবরণ:* ${fileDesc || 'প্রিমিয়াম সোর্স কোড ও ফাইল'}\n\n` +
    `ধন্যবাদ আমাদের সাথে থাকার জন্য! ❤️`;

  const parsed = parseTelegramLink(postLink);

  try {
    if (parsed) {
      // Clean Copy without any forward tag
      await bot.copyMessage(userId, parsed.chatId, parsed.messageId, {
        caption: captionText,
        parse_mode: 'Markdown'
      });
    } else {
      // Fallback: If regular drive/direct download link
      await bot.sendMessage(userId, `${captionText}\n\n🔗 *ডাউনলোড লিংক:* ${postLink}`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delivery Error:', err.message);
    try {
      await bot.sendMessage(userId, `${captionText}\n\n🔗 *ডাউনলোড লিংক:* ${postLink}`, { parse_mode: 'Markdown' });
      return res.json({ success: true });
    } catch(e) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const bot = new TelegramBot(BOT_TOKEN, { 
  polling: { interval: 300, autoStart: true, params: { timeout: 10 } }
});

function fbGet(path) {
  return new Promise((resolve) => {
    https.get(`${FIREBASE_DB_URL}/${path}.json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function fbUpdate(path, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request(`${FIREBASE_DB_URL}/${path}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

async function isSubscribed(userId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const res = await bot.getChatMember(ch, userId);
      if (!['creator', 'administrator', 'member'].includes(res.status)) return false;
    } catch (e) { return false; }
  }
  return true;
}

bot.on('message', async (msg) => {
  if (!msg.text) return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const user = msg.from;

  if (text.startsWith('/start')) {
    let referrerId = 'none';
    const parts = text.split(' ');
    if (parts.length > 1 && parts[1].trim().startsWith('ref_')) {
      referrerId = parts[1].trim().replace('ref_', '');
    }
    if (String(referrerId) === String(user.id)) referrerId = 'none';

    const subscribed = await isSubscribed(user.id);
    if (!subscribed) {
      return bot.sendMessage(chatId, 
        `👋 *হ্যালো ${user.first_name || 'ইউজার'}!*\n\nআমাদের বট ব্যবহার করতে নিচের চ্যানেল দুটিতে জয়েন করুন:\n\n1️⃣ [Channel 1](https://t.me/a54auraax)\n2️⃣ [Channel 2](https://t.me/FHx_Technical)\n\nজয়েন করে নিচে *✅ ভেরিফাই করুন* বাটনে চাপ দিন।`, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 জয়েন চ্যানেল ১', url: 'https://t.me/a54auraax' }],
              [{ text: '📢 জয়েন চ্যানেল ২', url: 'https://t.me/FHx_Technical' }],
              [{ text: '✅ ভেরিফাই করুন', callback_data: `verify_${referrerId}` }]
            ]
          }
        }
      );
    }
    await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const user = query.from;
  const data = query.data;

  if (data.startsWith('verify_')) {
    const referrerId = data.replace('verify_', '').trim();
    const subscribed = await isSubscribed(user.id);
    if (!subscribed) {
      return bot.answerCallbackQuery(query.id, { text: '❌ আগে চ্যানেল দুটিতে জয়েন করুন!', show_alert: true });
    }
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
  }
});

async function completeVerification(chatId, user, referrerId) {
  const existingUser = await fbGet(`users/${user.id}`);
  let photoUrl = '';
  try {
    const photos = await bot.getUserProfilePhotos(user.id, { limit: 1 });
    if (photos.total_count > 0) {
      const file = await bot.getFile(photos.photos[0][0].file_id);
      photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    }
  } catch(e){}

  if (!existingUser) {
    const newUser = {
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      photo: photoUrl,
      coins: 0,
      referralCount: 0,
      referredBy: referrerId || null,
      adsWatchedToday: 0,
      lastAdDate: new Date().toISOString().slice(0, 10),
      totalDownloads: 0,
      isVerified: true
    };

    if (referrerId && String(referrerId) !== String(user.id)) {
      const inviter = await fbGet(`users/${referrerId}`);
      if (inviter) {
        await fbUpdate(`users/${referrerId}`, {
          coins: (parseInt(inviter.coins) || 0) + 1,
          referralCount: (parseInt(inviter.referralCount) || 0) + 1
        });
        bot.sendMessage(referrerId, `🎉 *অভিনন্দন!* আপনার রেফারে একজন জয়েন করায় *+1 পয়েন্ট* যোগ হয়েছে!`, { parse_mode: 'Markdown' }).catch(()=>{});
      }
    }
    await fbUpdate(`users/${user.id}`, newUser);
  }

  const me = await bot.getMe();
  const myRefLink = `https://t.me/${me.username}?start=ref_${user.id}`;
  const welcomeText = `🎉 *অভিনন্দন ${user.first_name || ''}! আপনার অ্যাকাউন্ট ভেরিফাইড।*\n\n` +
    `💡 *পয়েন্ট নিয়ম:*\n` +
    `• ১টি অ্যাড = ১ পয়েন্ট\n` +
    `• ১টি রেফারেল = ১ পয়েন্ট\n\n` +
    `🔗 *রেফারেল লিংক:*\n\`${myRefLink}\`\n\n` +
    `নিচের বাটনে ক্লিক করে অ্যাপ ওপেন করুন 👇`;

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 ওপেন ফাইল অ্যাপ (Mini App)', web_app: { url: WEBAPP_URL } }],
        [{ text: '👥 বন্ধুদের রেফার করুন', url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ফ্রি ফাইল ডাউনলোড করুন!")}` }]
      ]
    }
  });
}
