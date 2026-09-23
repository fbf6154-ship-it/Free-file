/**
 * Telegram File Store Bot (100% Fixed for New Users & Deep Links)
 * Bot Token: 8914672895:AAFNFl7VMvdYrQn83tfC1SAH0ihbPOv5D18
 * Bot Username: frxfreebot
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');

const BOT_TOKEN = '8914672895:AAFNFl7VMvdYrQn83tfC1SAH0ihbPOv5D18';
const REQUIRED_CHANNELS = ['@a54auraax', '@FHx_Technical'];
const WEBAPP_URL = 'https://freefile.fahimfaysal.shop/index.html';
const FIREBASE_DB_URL = 'https://freefile-a561a-default-rtdb.asia-southeast1.firebasedatabase.app';

// 1. Express Server for Render Free Tier & UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send({ status: 'Online', bot: 'frxfreebot', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// 2. Telegram Bot Instance with Polling
const bot = new TelegramBot(BOT_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

// Firebase REST API Helpers
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

// Safe Channel Subscription Check
async function isSubscribed(userId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const res = await bot.getChatMember(ch, userId);
      if (!['creator', 'administrator', 'member'].includes(res.status)) {
        return false;
      }
    } catch (e) {
      console.log(`Channel check error for ${ch}:`, e.message);
      // যদি বট চ্যানেলে অ্যাডমিন না থাকে তবে ক্র্যাশ না করে সত্য ধরে নিবে
      return false; 
    }
  }
  return true;
}

// Global Message Listener (Catches both regular text and raw /start clicks)
bot.on('message', async (msg) => {
  if (!msg.text) return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const user = msg.from;

  // Handle /start (With or without ref parameter)
  if (text.startsWith('/start')) {
    let referrerId = 'none';

    // Parse ref parameter: Handles both `/start ref_123` and `/start`
    const parts = text.split(' ');
    if (parts.length > 1) {
      const param = parts[1].trim();
      if (param.startsWith('ref_')) {
        referrerId = param.replace('ref_', '').trim();
      }
    }

    // Prevent self referral
    if (String(referrerId) === String(user.id)) {
      referrerId = 'none';
    }

    try {
      const subscribed = await isSubscribed(user.id);

      if (!subscribed) {
        return bot.sendMessage(chatId, 
          `👋 হ্যালো ${user.first_name || 'ইউজার'}!\n\nআমাদের বট ব্যবহার করতে এবং ফাইল আনলক করতে নিচের চ্যানেল দুটিতে জয়েন করুন:\n\n1️⃣ Channel 1: https://t.me/a54auraax\n2️⃣ Channel 2: https://t.me/FHx_Technical\n\nজয়েন করার পর নিচে 'ভেরিফাই করুন' বাটনে চাপ দিন।`, {
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
    } catch (err) {
      console.error('Error handling start:', err);
    }
  }
});

// Verify Callback Handler (When user clicks ✅ ভেরিফাই করুন)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const user = query.from;
  const data = query.data;

  if (data.startsWith('verify_')) {
    const referrerId = data.replace('verify_', '').trim();

    try {
      const subscribed = await isSubscribed(user.id);

      if (!subscribed) {
        return bot.answerCallbackQuery(query.id, {
          text: '❌ আপনি এখনো সব চ্যানেলে জয়েন করেননি! দয়া করে দুটি চ্যানেলেই জয়েন করে আবার চাপ দিন।',
          show_alert: true
        });
      }

      try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
      await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
    } catch (err) {
      console.error('Callback error:', err);
    }
  }
});

// Complete User Verification & Add +1 Point
async function completeVerification(chatId, user, referrerId) {
  try {
    const existingUser = await fbGet(`users/${user.id}`);

    if (!existingUser) {
      // New User
      const newUser = {
        id: user.id,
        name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
        username: user.username || 'No Username',
        coins: 0,
        referralCount: 0,
        referredBy: referrerId || null,
        adsWatchedToday: 0,
        lastAdDate: new Date().toISOString().slice(0, 10),
        unlocked: {},
        isVerified: true
      };

      // Add 1 Point to the Inviter
      if (referrerId && String(referrerId) !== String(user.id)) {
        const inviter = await fbGet(`users/${referrerId}`);
        if (inviter) {
          const curCoins = parseInt(inviter.coins) || 0;
          const curRefs = parseInt(inviter.referralCount) || 0;

          await fbUpdate(`users/${referrerId}`, {
            coins: curCoins + 1,
            referralCount: curRefs + 1
          });

          bot.sendMessage(referrerId, 
            `🎉 অভিনন্দন! আপনার রেফারেল লিংকে একজন নতুন মেম্বার (${user.first_name}) জয়েন করেছে। আপনার অ্যাকাউন্টে +1 পয়েন্ট যোগ হয়েছে!`
          ).catch(() => {});
        }
      }

      await fbUpdate(`users/${user.id}`, newUser);
    } else {
      // Existing User update
      await fbUpdate(`users/${user.id}`, {
        name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
        username: user.username || 'No Username',
        isVerified: true
      });
    }

    const myRefLink = `https://t.me/frxfreebot?start=ref_${user.id}`;

    const welcomeText = `🎉 অভিনন্দন ${user.first_name || ''}! আপনার অ্যাকাউন্ট ভেরিফাইড হয়েছে।\n\n` +
      `💡 পয়েন্ট আয় করার নিয়ম:\n` +
      `১. অ্যাপে ১টি বিজ্ঞাপন দেখলে পাবেন = ১ পয়েন্ট।\n` +
      `২. আপনার রেফারেল লিংক শেয়ার করে প্রতি রেফারে পাবেন = ১ পয়েন্ট।\n` +
      `৩. অর্জিত পয়েন্ট দিয়ে ফাইল ডাউনলোড করুন!\n\n` +
      `🔗 আপনার রেফারেল লিংক:\n${myRefLink}\n\n` +
      `নিচের বাটনে চাপ দিয়ে অ্যাপ ওপেন করুন 👇`;

    bot.sendMessage(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 ওপেন ফাইল অ্যাপ (Mini App)', web_app: { url: WEBAPP_URL } }],
          [{ text: '👥 বন্ধুদের রেফার করুন', url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ফ্রি ফাইল ডাউনলোড করতে জয়েন করুন!")}` }]
        ]
      }
    });
  } catch (err) {
    console.error('Error in completeVerification:', err);
  }
}
