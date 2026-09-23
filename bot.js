/**
 * Telegram File Store Bot Server
 * Configured for: Render.com & UptimeRobot
 * WebApp Domain: https://freefile.fahimfaysal.shop/index.html
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');

const BOT_TOKEN = '8914672895:AAFNFl7VMvdYrQn83tfC1SAH0ihbPOv5D18';
const REQUIRED_CHANNELS = ['@a54auraax', '@FHx_Technical'];
const WEBAPP_URL = 'https://freefile.fahimfaysal.shop/index.html';
const FIREBASE_DB_URL = 'https://freefile-a561a-default-rtdb.asia-southeast1.firebasedatabase.app';

// 1. Express Server for Render & UptimeRobot Health Check
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send({ status: 'Online', service: 'Telegram File Bot', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// 2. Telegram Bot Polling Initialize
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Firebase Database REST Helpers
function getFirebaseData(path) {
  return new Promise((resolve) => {
    https.get(`${FIREBASE_DB_URL}/${path}.json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function updateFirebaseData(path, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request(`${FIREBASE_DB_URL}/${path}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, () => resolve(true));
    req.write(data);
    req.end();
  });
}

// Check Channel Membership
async function isSubscribed(userId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const res = await bot.getChatMember(ch, userId);
      if (!['creator', 'administrator', 'member'].includes(res.status)) {
        return false;
      }
    } catch (e) {
      console.error(`Error checking channel ${ch}:`, e.message);
      return false;
    }
  }
  return true;
}

// /start Command Handler
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const startParam = (match[1] || '').trim();

  let referrerId = null;
  if (startParam.startsWith('ref_')) {
    referrerId = startParam.replace('ref_', '');
  }

  const subscribed = await isSubscribed(user.id);

  if (!subscribed) {
    return bot.sendMessage(chatId, 
      `👋 *হ্যালো ${user.first_name || 'ইউজার'}!*\n\nআমাদের বটে কাজ করতে এবং ফ্রি ফাইল ও স্ক্রিপ্ট ডাউনলোড করতে নিচের দুটি চ্যানেলে জয়েন করুন:\n\n1️⃣ [Channel 1 - Join Here](https://t.me/a54auraax)\n2️⃣ [Channel 2 - Join Here](https://t.me/FHx_Technical)\n\nজয়েন করার পর নিচে *✅ ভেরিফাই করুন* বাটনে চাপ দিন।`, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '📢 জয়েন চ্যানেল ১', url: 'https://t.me/a54auraax' }],
            [{ text: '📢 জয়েন চ্যানেল ২', url: 'https://t.me/FHx_Technical' }],
            [{ text: '✅ ভেরিফাই করুন', callback_data: `verify_${referrerId || 'none'}` }]
          ]
        }
      }
    );
  }

  await completeVerification(chatId, user, referrerId);
});

// Callback Query Handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const user = query.from;
  const data = query.data;

  if (data.startsWith('verify_')) {
    const referrerId = data.replace('verify_', '');
    const subscribed = await isSubscribed(user.id);

    if (!subscribed) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ আপনি এখনো সব চ্যানেলে জয়েন করেননি! দয়া করে দুটি চ্যানেলেই জয়েন করে আবার চেষ্টা করুন।',
        show_alert: true
      });
    }

    try { await bot.deleteMessage(chatId, query.message.message_id); } catch(e){}
    await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
  }
});

// Verification Complete & Referral Engine
async function completeVerification(chatId, user, referrerId) {
  const settings = (await getFirebaseData('settings')) || { referralBonus: 20, botUsername: 'FilePayBot' };
  const existingUser = await getFirebaseData(`users/${user.id}`);

  // Get user profile photo
  let photoUrl = '';
  try {
    const photos = await bot.getUserProfilePhotos(user.id, { limit: 1 });
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      const file = await bot.getFile(fileId);
      photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    }
  } catch(e){}

  if (!existingUser) {
    const newUser = {
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      photo: photoUrl,
      coins: 10,
      referralCount: 0,
      adsWatchedToday: 0,
      lastAdDate: new Date().toISOString().slice(0, 10),
      unlocked: {},
      isVerified: true
    };

    if (referrerId && String(referrerId) !== String(user.id)) {
      const refUser = await getFirebaseData(`users/${referrerId}`);
      if (refUser) {
        const bonus = settings.referralBonus || 20;
        await updateFirebaseData(`users/${referrerId}`, {
          coins: (refUser.coins || 0) + bonus,
          referralCount: (refUser.referralCount || 0) + 1
        });
        bot.sendMessage(referrerId, `🎉 *অভিনন্দন!* আপনার রেফার লিংকে একজন নতুন মেম্বার জয়েন করেছে। আপনি *+${bonus} কয়েন* পেয়েছেন!`, { parse_mode: 'Markdown' });
      }
    }

    await updateFirebaseData(`users/${user.id}`, newUser);
  } else {
    // Keep name & photo updated
    await updateFirebaseData(`users/${user.id}`, {
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      photo: photoUrl || existingUser.photo || '',
      isVerified: true
    });
  }

  const me = await bot.getMe();
  const myRefLink = `https://t.me/${me.username}?start=ref_${user.id}`;

  const welcomeText = `🎉 *অভিনন্দন ${user.first_name}! আপনার অ্যাকাউন্ট সফলভাবে ভেরিফাই হয়েছে।*\n\n` +
    `💡 *কিভাবে কাজ করবেন:*\n` +
    `১. অ্যাপে প্রতিদিন বিজ্ঞাপন দেখে ফ্রিতে কয়েন আর্ন করুন।\n` +
    `২. আপনার রেফারেল লিংক বন্ধুদের মাঝে শেয়ার করে প্রতি রেফারে *${settings.referralBonus || 20} কয়েন* আয় করুন।\n` +
    `৩. অর্জিত কয়েন দিয়ে আপনার পছন্দের যে কোনো ফাইল বা স্ক্রিপ্ট এক ক্লিকে আনলক করুন!\n\n` +
    `🔗 *আপনার রেফারেল লিংক:*\n\`${myRefLink}\` (ক্লিক করে কপি করুন)\n\n` +
    `এখনই নিচে বাটনে চাপ দিয়ে অ্যাপে প্রবেশ করুন 👇`;

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 ওপেন ফাইল অ্যাপ (Mini App)', web_app: { url: WEBAPP_URL } }],
        [{ text: '👥 বন্ধুদের ইনভাইট করুন', url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ফ্রিতে প্রিমিয়াম ফাইল ডাউনলোড করতে এখনই জয়েন করুন!")}` }]
      ]
    }
  });
}
