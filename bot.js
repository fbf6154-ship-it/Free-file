/**
 * Telegram File Store Bot Server
 * With Real-time Admin Purchase & Error Alerts
 * Admin ID: 8468523960 (@Fahad_dev_bro)
 * Bot Token: 8914672895:AAEAKLnsTMhfwjTUeRXGNOo_JDcARdXOtk0
 */

const express = require('express');
const cors = require('cors');
const https = require('https');

const BOT_TOKEN = '8914672895:AAEAKLnsTMhfwjTUeRXGNOo_JDcARdXOtk0';
const ADMIN_ID = '8468523960'; // Admin Alert Destination
const REQUIRED_CHANNELS = ['@a54auraax', '@FHx_Technical'];
const WEBAPP_URL = 'https://freefile.fahimfaysal.shop/index.html';
const FIREBASE_DB_URL = 'https://freefile-a561a-default-rtdb.asia-southeast1.firebasedatabase.app';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'Online', bot: 'Running with Admin Alert Engine', time: new Date() });
});

// Telegram Native REST API Helper
function tgApi(method, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', (e) => {
      console.error(`TG API Error (${method}):`, e.message);
      resolve(null);
    });
    req.write(data);
    req.end();
  });
}

// 100% Accurate Telegram Post Link Parser
function parseTelegramLink(url) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  // Private Channel Link Format: https://t.me/c/3976610083/29
  const privateMatch = cleanUrl.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (privateMatch) {
    const rawId = privateMatch[1];
    const fullChatId = rawId.startsWith('100') ? `-${rawId}` : `-100${rawId}`;
    return {
      chatId: fullChatId,
      messageId: parseInt(privateMatch[2], 10)
    };
  }

  // Public Channel Link Format: https://t.me/channel_name/45
  const publicMatch = cleanUrl.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
  if (publicMatch && publicMatch[1] !== 'c') {
    return {
      chatId: `@${publicMatch[1]}`,
      messageId: parseInt(publicMatch[2], 10)
    };
  }

  return null;
}

// 🚀 LIVE FILE DELIVERY & ADMIN ALERT ENDPOINT
app.post('/api/send-file', async (req, res) => {
  const { userId, fileTitle, postLink } = req.body;

  if (!userId) return res.status(400).json({ success: false, error: 'User ID missing' });

  const links = (postLink || '').split(/[\n,\s]+/).map(l => l.trim()).filter(Boolean);

  try {
    // 1. Initial Notice to User
    await tgApi('sendMessage', {
      chat_id: userId,
      text: `⏳ *File Found!*\n\n⚡ আপনার File এখন পাঠানো হচ্ছে...`,
      parse_mode: 'Markdown'
    });

    await new Promise(r => setTimeout(r, 400));

    let deliveryErrors = [];

    // 2. Deliver Files to User
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const parsed = parseTelegramLink(link);

      if (parsed) {
        const copyRes = await tgApi('copyMessage', {
          chat_id: userId,
          from_chat_id: parsed.chatId,
          message_id: parsed.messageId
        });

        if (!copyRes || !copyRes.ok) {
          deliveryErrors.push(`Failed to copy from ${link} -> Error: ${copyRes ? copyRes.description : 'Unknown'}`);
        }
      } else {
        await tgApi('sendMessage', {
          chat_id: userId,
          text: `🔗 *File ${i + 1}:* ${link}`,
          disable_web_page_preview: true
        });
      }

      await new Promise(r => setTimeout(r, 400));
    }

    // 3. User Success Notice
    await tgApi('sendMessage', {
      chat_id: userId,
      text: `📦 *FILE READY*\n\n📄 *${fileTitle || 'File Package'}*\n⚡ Delivered by *@krz_fahim*`,
      parse_mode: 'Markdown'
    });

    // 4. 🔔 Send Purchase Alert to Admin (@Fahad_dev_bro)
    const adminAlertText = `🛍️ *নতুন ফাইল আনলক নোটিফিকেশন!*\n\n` +
      `👤 *ইউজার আইডি:* \`${userId}\`\n` +
      `📂 *ফাইলের নাম:* ${fileTitle}\n` +
      `📦 *মোট লিংক/ফাইল সংখ্যা:* ${links.length} টি\n` +
      `⏰ *সময়:* ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}\n\n` +
      `✅ ইউজারের ইনবক্সে ডেলিভারি সম্পন্ন হয়েছে।`;

    await tgApi('sendMessage', {
      chat_id: ADMIN_ID,
      text: adminAlertText,
      parse_mode: 'Markdown'
    });

    // 5. ⚠️ Send Error Alert to Admin (If any error occurred during copy)
    if (deliveryErrors.length > 0) {
      const adminErrorText = `🚨 *ডেলিভারি এরর নোটিফিকেশন!*\n\n` +
        `👤 *ইউজার আইডি:* \`${userId}\`\n` +
        `📂 *ফাইল:* ${fileTitle}\n\n` +
        `⚠️ *সমস্যার বিবরণ:*\n${deliveryErrors.join('\n')}\n\n` +
        `💡 *টিপস:* আপনার প্রাইভেট চ্যানেলে বট অ্যাডমিন আছে কিনা এবং "Restrict saving content" বন্ধ আছে কিনা চেক করুন।`;

      await tgApi('sendMessage', {
        chat_id: ADMIN_ID,
        text: adminErrorText,
        parse_mode: 'Markdown'
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delivery Error:', err.message);

    // Send Critical Crash Alert to Admin
    await tgApi('sendMessage', {
      chat_id: ADMIN_ID,
      text: `❌ *সিস্টেম এরর এলার্ট!*\n\nইউজার ID: \`${userId}\` এর ফাইল সেন্ড করতে সমস্যা হয়েছে।\nError: \`${err.message}\``,
      parse_mode: 'Markdown'
    });

    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Firebase Database Helpers
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

// Channel Subscription Check
async function isSubscribed(userId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const res = await tgApi('getChatMember', { chat_id: ch, user_id: userId });
      if (!res || !res.ok || !['creator', 'administrator', 'member'].includes(res.result.status)) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  return true;
}

// Native Polling Engine
let updateOffset = 0;

async function pollUpdates() {
  try {
    const res = await tgApi('getUpdates', { offset: updateOffset, timeout: 10 });
    if (res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        updateOffset = update.update_id + 1;
        handleUpdate(update);
      }
    }
  } catch (err) {
    console.error('Polling Error:', err.message);
  }
  setTimeout(pollUpdates, 400);
}

// Clean Hook Reset & Start Polling
tgApi('deleteWebhook', { drop_pending_updates: true }).then(() => {
  console.log('🚀 Polling Started Cleanly.');
  pollUpdates();
});

// Handle Bot Events
async function handleUpdate(update) {
  if (update.message && update.message.text) {
    const msg = update.message;
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
        return tgApi('sendMessage', {
          chat_id: chatId,
          text: `👋 *হ্যালো ${user.first_name || 'ইউজার'}!*\n\nআমাদের বট ব্যবহার করতে নিচের চ্যানেল দুটিতে জয়েন করুন:\n\n1️⃣ [Channel 1](https://t.me/a54auraax)\n2️⃣ [Channel 2](https://t.me/FHx_Technical)\n\nজয়েন করে নিচে *✅ ভেরিফাই করুন* বাটনে চাপ দিন।`,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📢 জয়েন চ্যানেল ১', url: 'https://t.me/a54auraax' }],
              [{ text: '📢 জয়েন চ্যানেল ২', url: 'https://t.me/FHx_Technical' }],
              [{ text: '✅ ভেরিফাই করুন', callback_data: `verify_${referrerId}` }]
            ]
          }
        });
      }

      await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
    }
  }

  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const user = query.from;
    const data = query.data;

    if (data.startsWith('verify_')) {
      const referrerId = data.replace('verify_', '').trim();
      const subscribed = await isSubscribed(user.id);

      if (!subscribed) {
        return tgApi('answerCallbackQuery', {
          callback_query_id: query.id,
          text: '❌ আগে চ্যানেল দুটিতে জয়েন করুন!',
          show_alert: true
        });
      }

      tgApi('deleteMessage', { chat_id: chatId, message_id: query.message.message_id });
      await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
    }
  }
}

// Complete Verification & +1 Point Reward
async function completeVerification(chatId, user, referrerId) {
  const existingUser = await fbGet(`users/${user.id}`);

  if (!existingUser) {
    const newUser = {
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
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
        tgApi('sendMessage', {
          chat_id: referrerId,
          text: `🎉 *অভিনন্দন!* আপনার রেফারেল লিংকে একজন জয়েন করায় *+1 পয়েন্ট* যোগ হয়েছে!`,
          parse_mode: 'Markdown'
        });
      }
    }
    await fbUpdate(`users/${user.id}`, newUser);
  }

  const botInfo = await tgApi('getMe', {});
  const botUsername = (botInfo && botInfo.result) ? botInfo.result.username : 'frxfreebot';
  const myRefLink = `https://t.me/${botUsername}?start=ref_${user.id}`;

  const welcomeText = `🎉 *অভিনন্দন ${user.first_name || ''}! আপনার অ্যাকাউন্ট ভেরিফাইড।*\n\n` +
    `💡 *পয়েন্ট নিয়ম:*\n` +
    `• ১টি অ্যাড = ১ পয়েন্ট\n` +
    `• ১টি রেফারেল = ১ পয়েন্ট\n\n` +
    `🔗 *রেফারেল লিংক:*\n\`${myRefLink}\`\n\n` +
    `নিচের বাটনে ক্লিক করে অ্যাপ ওপেন করুন 👇`;

  tgApi('sendMessage', {
    chat_id: chatId,
    text: welcomeText,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 ওপেন ফাইল অ্যাপ (Mini App)', web_app: { url: WEBAPP_URL } }],
        [{ text: '👥 বন্ধুদের রেফার করুন', url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ফ্রি ফাইল ডাউনলোড করুন!")}` }]
      ]
    }
  });
}
