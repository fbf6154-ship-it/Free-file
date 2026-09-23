/**
 * Telegram File Store Backend Server
 * Rules: 1 Ad = 1 Point | 1 Referral = 1 Point
 * Channels: @a54auraax & @FHx_Technical
 * Domain: https://freefile.fahimfaysal.shop/index.html
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');

const BOT_TOKEN = '8914672895:AAFNFl7VMvdYrQn83tfC1SAH0ihbPOv5D18';
const REQUIRED_CHANNELS = ['@a54auraax', '@FHx_Technical'];
const WEBAPP_URL = 'https://freefile.fahimfaysal.shop/index.html';
const FIREBASE_DB_URL = 'https://freefile-a561a-default-rtdb.asia-southeast1.firebasedatabase.app';

// 1. Web Server for Render Free Tier + UptimeRobot (24/7 Always ON)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'Online', message: 'Telegram File Bot is Active', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// 2. Telegram Bot Polling Instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Firebase Database REST Helper Functions
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

// Check Channel Subscription Status
async function isSubscribed(userId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const res = await bot.getChatMember(ch, userId);
      if (!['creator', 'administrator', 'member'].includes(res.status)) {
        return false;
      }
    } catch (e) {
      console.log(`Warning checking channel ${ch}:`, e.message);
      return false;
    }
  }
  return true;
}

// /start Command
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const rawParam = (match[1] || '').trim();

  let referrerId = 'none';
  if (rawParam.includes('ref_')) {
    referrerId = rawParam.split('ref_')[1].trim();
  }

  // Prevent self referral
  if (String(referrerId) === String(user.id)) {
    referrerId = 'none';
  }

  const subscribed = await isSubscribed(user.id);

  if (!subscribed) {
    return bot.sendMessage(chatId, 
      `👋 *হ্যালো ${user.first_name || 'ইউজার'}!*\n\nআমাদের বট ব্যবহার করতে এবং ফ্রিতে ফাইল ডাউনলোড করতে নিচের চ্যানেল দুটিতে জয়েন করুন:\n\n1️⃣ [Channel 1 - Join Here](https://t.me/a54auraax)\n2️⃣ [Channel 2 - Join Here](https://t.me/FHx_Technical)\n\nজয়েন করার পর নিচে *✅ ভেরিফাই করুন* বাটনে চাপ দিন।`, {
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
});

// Verify Button Click Callback
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const user = query.from;
  const data = query.data;

  if (data.startsWith('verify_')) {
    const referrerId = data.replace('verify_', '').trim();
    const subscribed = await isSubscribed(user.id);

    if (!subscribed) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ আপনি এখনো সব চ্যানেলে জয়েন করেননি! দয়া করে দুটি চ্যানেলেই জয়েন করে আবার ভেরিফাই করুন।',
        show_alert: true
      });
    }

    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
  }
});

// Complete Registration & Reward Inviter 1 Point
async function completeVerification(chatId, user, referrerId) {
  const existingUser = await fbGet(`users/${user.id}`);

  // Fetch Telegram Profile Photo
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
    // New User Entry
    const newUser = {
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      photo: photoUrl,
      coins: 0, // Starts at 0
      referralCount: 0,
      referredBy: referrerId || null,
      adsWatchedToday: 0,
      lastAdDate: new Date().toISOString().slice(0, 10),
      unlocked: {},
      isVerified: true
    };

    // Reward Inviter exactly 1 Point
    if (referrerId && String(referrerId) !== String(user.id)) {
      const inviter = await fbGet(`users/${referrerId}`);
      if (inviter) {
        const curCoins = parseInt(inviter.coins) || 0;
        const curRefs = parseInt(inviter.referralCount) || 0;

        await fbUpdate(`users/${referrerId}`, {
          coins: curCoins + 1, // +1 Point per referral
          referralCount: curRefs + 1
        });

        bot.sendMessage(referrerId, 
          `🎉 *অভিনন্দন!*\n\nআপনার রেফারেল লিংকে *${user.first_name}* জয়েন করেছে। আপনার অ্যাকাউন্টে *+1 পয়েন্ট* যোগ করা হয়েছে!`, 
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }

    await fbUpdate(`users/${user.id}`, newUser);
  } else {
    // Existing user sync
    await fbUpdate(`users/${user.id}`, {
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      photo: photoUrl || existingUser.photo || '',
      isVerified: true
    });
  }

  const me = await bot.getMe();
  const myRefLink = `https://t.me/${me.username}?start=ref_${user.id}`;

  const welcomeText = `🎉 *অভিনন্দন ${user.first_name || ''}! আপনার অ্যাকাউন্ট ভেরিফাইড হয়েছে।*\n\n` +
    `💡 *পয়েন্ট আয় করার নিয়ম:*\n` +
    `১. অ্যাপে ১টি বিজ্ঞাপন দেখলে পাবেন = *১ পয়েন্ট*।\n` +
    `২. আপনার রেফারেল লিংক শেয়ার করে প্রতি রেফারে পাবেন = *১ পয়েন্ট*।\n` +
    `৩. অর্জিত পয়েন্ট দিয়ে যে কোনো ফাইল ফ্রিতে আনলক করুন!\n\n` +
    `🔗 *আপনার রেফারেল লিংক:*\n\`${myRefLink}\` (ক্লিক করে কপি করুন)\n\n` +
    `এখনই নিচে বাটনে চাপ দিয়ে অ্যাপ ওপেন করুন 👇`;

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 ওপেন ফাইল অ্যাপ (Mini App)', web_app: { url: WEBAPP_URL } }],
        [{ text: '👥 বন্ধুদের রেফার করুন', url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ফ্রিতে ফাইল ডাউনলোড করতে এখনই জয়েন করুন!")}` }]
      ]
    }
  });
}
