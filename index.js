import { Telegraf, Markup } from "telegraf";
import fs from "fs/promises";

const BOT_TOKEN = "bot token mu cik";
const bot = new Telegraf(BOT_TOKEN);

const INTERFACE = "eth0"; 
const ATTACK_DURATION = 100000; 
const VPS_COOLDOWN = 60000; 

const VPS_LIST = [
  { name: "VPS Singapore", ip: "178.128.214.244" },
  { name: "VPS AWS Tokyo", ip: "178.128.214.244" },
  { name: "VPS AWS US-East", ip: "178.128.214.244" },
];

const CHANNEL_ID = "-1002389760390";  //bisa lu gnti jadi chatid grub/prib

let attackRunning = false;
let selectedVpsIp = null;
let attackStartTime = null;

async function readNetworkStats() {
  try {
    const data = await fs.readFile("/proc/net/dev", "utf-8");
    const lines = data.split("\n");
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith(INTERFACE + ":")) {
        const parts = line.split(/[: ]+/).filter(Boolean);
        return {
          rx_bytes: parseInt(parts[1]),
          rx_packets: parseInt(parts[2]),
          tx_bytes: parseInt(parts[9]),
          tx_packets: parseInt(parts[10]),
        };
      }
    }
  } catch (err) {
    console.error("Failed to read /proc/net/dev", err.message);
  }
  return null;
}

let prevStats = null;

async function getTrafficStats() {
  const stats = await readNetworkStats();
  if (!stats || !prevStats) {
    prevStats = stats;
    return null;
  }

  const deltaRxBytes = stats.rx_bytes - prevStats.rx_bytes;
  const deltaTxBytes = stats.tx_bytes - prevStats.tx_bytes;
  const deltaRxPackets = stats.rx_packets - prevStats.rx_packets;
  const deltaTxPackets = stats.tx_packets - prevStats.tx_packets;

  prevStats = stats;

  const totalBytes = deltaRxBytes + deltaTxBytes;
  const totalPackets = deltaRxPackets + deltaTxPackets;

  const gbps = (totalBytes * 8) / 1e9; // Gigabit per second
  const pps = totalPackets;

  return { gbps, pps };
}

bot.start(async (ctx) => {
  attackRunning = false;
  selectedVpsIp = null;
  attackStartTime = null;
  prevStats = null;

  await ctx.replyWithPhoto(
    { url: "https://example.com/your-image.jpg" }, // ganti pake url foto mu ( terserah wajib di isi )
    {
      caption: "Welcome! Please choose an attack layer:",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("L4", "choose_l4")],
      ]),
    }
  );
});

bot.action("choose_l4", async (ctx) => {
  await ctx.editMessageText("Choose protection type:", Markup.inlineKeyboard([
    [Markup.button.callback("Non Protect", "non_protect")],
    [Markup.button.callback("Protect", "protect")],
  ]));
});

bot.action("non_protect", async (ctx) => {
  const buttons = VPS_LIST.map(vps =>
    [Markup.button.callback(vps.name, `vps_${vps.ip}`)]
  );

  await ctx.editMessageText("Select VPS IP to attack:", Markup.inlineKeyboard(buttons));
});

bot.action(/vps_(.+)/, async (ctx) => {
  if (attackRunning) {
    return ctx.answerCbQuery("Attack already running. Please wait.");
  }
  const ip = ctx.match[1];
  selectedVpsIp = ip;

  await ctx.editMessageText(`Starting attack on IP: ${ip}\nDuration: 100 seconds`);

  attackRunning = true;
  attackStartTime = Date.now();

  // Reset prev s
  prevStats = await readNetworkStats();

  const attackInterval = setInterval(async () => {
    const elapsed = Date.now() - attackStartTime;

    if (elapsed >= ATTACK_DURATION) {
      clearInterval(attackInterval);
      attackRunning = false;

      // Att
      const stats = await getTrafficStats();

      // Kirim ke chat user
      await ctx.reply(`Attack finished on IP: ${selectedVpsIp}\n` +
        `Traffic stats:\n` +
        `• Bandwidth: ${stats ? stats.gbps.toFixed(3) : "N/A"} Gbps\n` +
        `• Packets: ${stats ? stats.pps : "N/A"} pps\n\n` +
        `VPS will now enter cooldown for 1 minute.`);

      // Kirim data ke channel Telegram
      const channelMsg = `🔥 Attack finished on IP: ${selectedVpsIp}\n` +
        `📊 Traffic stats:\n` +
        `• Bandwidth: ${stats ? stats.gbps.toFixed(3) : "N/A"} Gbps\n` +
        `• Packets: ${stats ? stats.pps : "N/A"} pps\n` +
        `⏳ Duration: ${ATTACK_DURATION / 1000} seconds`;

      await bot.telegram.sendMessage(CHANNEL_ID, channelMsg);

      //cooldown (misal shutdown VPS - ganti sesuai kebutuhan)
      setTimeout(() => {
        ctx.reply(`Cooldown finished. You can start a new attack now.`);
      }, VPS_COOLDOWN);
    } else {
      // Optional: update tiap 30 detik ( bisa lu ubah setiap berapa detik cuk )
      if (elapsed % 30000 < 1000) {
        const stats = await getTrafficStats();
        if (stats) {
          ctx.reply(`Attack progress:\n` +
            `• Elapsed: ${(elapsed / 1000).toFixed(0)}s\n` +
            `• Bandwidth: ${stats.gbps.toFixed(3)} Gbps\n` +
            `• Packets: ${stats.pps} pps`);
        }
      }
    }
  }, 1000);
});

bot.launch();
console.log("Bot running...");