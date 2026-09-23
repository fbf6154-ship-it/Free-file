/**
 * Telegram File Store Bot Server (100% Guaranteed Referral Tracking)
 * Token: 8914672895:AAFNFl7VMvdYrQn83tfC1SAH0ihbPOv5D18
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');

const BOT_TOKEN = '8914672895:AAFNFl7VMvdYrQn83tfC1SAH0ihbPOv5D18';
const REQUIRED_CHANNELS = ['@a54auraax', '@FHx_Technical'];
const WEBAPP_URL = 'https://freefile.fahimfaysal.shop/index.html';
const FIREBASE_DB_URL = 'https://freefile-a561a-default-rtdb.asia-southeast1.firebasedatabase.app';

// 1. Express Server for Render & UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'Online', bot: 'Running', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is active on port ${PORT}`);
});

// 2. Telegram Bot Polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Robust Firebase REST API Requests
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
    }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

// Channel Join Verification Check
async function isSubscribed(userId) {
  for (const ch of REQUIRED_CHANNELS) {
    try {
      const res = await bot.getChatMember(ch, userId);
      if (!['creator', 'administrator', 'member'].includes(res.status)) {
        return false;
      }
    } catch (e) {
      console.log(`Channel verification check warning for ${ch}:`, e.message);
      // If bot is not admin in channel, allow temporarily or return false
      return false;
    }
  }
  return true;
}

// /start Command Handler
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const rawParam = (match[1] || '').trim();

  // Extract Referral ID precisely
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
      `👋 *হ্যালো ${user.first_name || 'ইউজার'}!*\n\nআমাদের বটে কাজ করতে এবং ফ্রি ফাইল ও স্ক্রিপ্ট ডাউনলোড করতে নিচের দুটি চ্যানেলে জয়েন করুন:\n\n1️⃣ [Channel 1 - Join Here](https://t.me/a54auraax)\n2️⃣ [Channel 2 - Join Here](https://t.me/FHx_Technical)\n\nজয়েন করার পর নিচে *✅ ভেরিফাই করুন* বাটনে চাপ দিন।`, {
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

// Verify Callback Handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const user = query.from;
  const data = query.data;

  if (data.startsWith('verify_')) {
    const referrerId = data.replace('verify_', '').trim();
    const subscribed = await isSubscribed(user.id);

    if (!subscribed) {
      return bot.answerCallbackQuery(query.id, {
        text: '❌ আপনি এখনো সব চ্যানেলে জয়েন করেননি! দয়া করে দুটি চ্যানেলেই জয়েন করে আবার ভেরিফাই বাটনে চাপুন।',
        show_alert: true
      });
    }

    try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) {}
    await completeVerification(chatId, user, referrerId === 'none' ? null : referrerId);
  }
});

// Complete Verification & Process Referral Instantly
async function completeVerification(chatId, user, referrerId) {
  const settings = (await fbGet('settings')) || { referralBonus: 20, botUsername: 'FilePayBot' };
  const existingUser = await fbGet(`users/${user.id}`);

  const bonusAmount = parseInt(settings.referralBonus) || 20;

  // New User Registration & Referral Reward
  if (!existingUser) {
    const newUser = {
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      coins: 10, // Initial welcome bonus
      referralCount: 0,
      referredBy: referrerId || null,
      adsWatchedToday: 0,
      lastAdDate: new Date().toISOString().slice(0, 10),
      unlocked: {},
      isVerified: true
    };

    // Credit bonus to the inviter
    if (referrerId && String(referrerId) !== String(user.id)) {
      const inviter = await fbGet(`users/${referrerId}`);
      if (inviter) {
        const currentCoins = parseInt(inviter.coins) || 0;
        const currentRefs = parseInt(inviter.referralCount) || 0;

        await fbUpdate(`users/${referrerId}`, {
          coins: currentCoins + bonusAmount,
          referralCount: currentRefs + 1
        });

        // Notify the inviter immediately
        bot.sendMessage(referrerId, 
          `🎉 *অভিনন্দন!*\n\nআপনার রেফারেল লিংকে একজন নতুন মেম্বার (*${user.first_name}*) জয়েন করেছে। আপনার একাউন্টে *+${bonusAmount} কয়েন* যোগ করা হয়েছে!`, 
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }

    await fbUpdate(`users/${user.id}`, newUser);
  } else {
    // If existing user was not referred before and came with a referrer now
    if (!existingUser.referredBy && referrerId && String(referrerId) !== String(user.id)) {
      const inviter = await fbGet(`users/${referrerId}`);
      if (inviter) {
        const currentCoins = parseInt(inviter.coins) || 0;
        const currentRefs = parseInt(inviter.referralCount) || 0;

        await fbUpdate(`users/${referrerId}`, {
          coins: currentCoins + bonusAmount,
          referralCount: currentRefs + 1
        });

        await fbUpdate(`users/${user.id}`, { referredBy: referrerId });

        bot.sendMessage(referrerId, 
          `🎉 *অভিনন্দন!*\n\nআপনার রেফারেল লিংকে একজন মেম্বার অ্যাকাউন্ট নিশ্চিত করেছে। আপনি *+${bonusAmount} কয়েন* পেয়েছেন!`, 
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }

    // Keep user state verified
    await fbUpdate(`users/${user.id}`, {
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
      username: user.username || 'No Username',
      isVerified: true
    });
  }

  const me = await bot.getMe();
  const myRefLink = `https://t.me/${me.username}?start=ref_${user.id}`;

  const welcomeText = `🎉 *অভিনন্দন ${user.first_name || ''}! আপনার অ্যাকাউন্ট ভেরিফাইড।*\n\n` +
    `💡 *কাজের নিয়ম:*\n` +
    `১. অ্যাপে প্রতিদিন বিজ্ঞাপন দেখে ফ্রিতে কয়েন আয় করুন।\n` +
    `২. আপনার রেফারেল লিংক শেয়ার করে প্রতি রেফারে *${bonusAmount} কয়েন* আয় করুন।\n` +
    `৩. অর্জিত কয়েন দিয়ে আপনার পছন্দের যে কোনো ফাইল বা স্ক্রিপ্ট এক ক্লিকে আনলক করুন!\n\n` +
    `🔗 *আপনার রেফারেল লিংক:*\n\`${myRefLink}\` (ক্লিক করে কপি করুন)\n\n` +
    `এখনই নিচে বাটনে চাপ দিয়ে অ্যাপে প্রবেশ করুন 👇`;

  bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 ওপেন ফাইল অ্যাপ (Mini App)', web_app: { url: WEBAPP_URL } }],
        [{ text: '👥 বন্ধুদের রেফার করুন', url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ফ্রিতে প্রিমিয়াম ফাইল ডাউনলোড করতে এখনই জয়েন করুন!")}` }]
      ]
    }
  });
}
