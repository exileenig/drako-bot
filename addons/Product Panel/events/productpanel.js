const {
  ActionRowBuilder: a,
  ButtonBuilder: b,
  EmbedBuilder: c,
  ButtonStyle: d,
  StringSelectMenuBuilder: e,
  AttachmentBuilder: f
} = require("discord.js");
const g = require("fs");
const h = require("js-yaml");
const i = require("path");
const j = require("jszip");
const k = require("../schemas/Cooldown");
const l = require("../schemas/DownloadLog");
const m = i.join(__dirname, "..", "config.yml");
const n = h.load(g.readFileSync(m, "utf8"));
function o(a) {
  const b = {
    PRIMARY: d.Primary,
    SECONDARY: d.Secondary,
    SUCCESS: d.Success,
    DANGER: d.Danger
  };
  const c = b;
  return c[a] || d.Success;
}
function p(a) {
  if (Array.isArray(a)) {
    return a.join("\n");
  } else {
    return a;
  }
}
async function q(d, f) {
  const g = d.options.getString("panel");
  const h = f?.panels?.[g];
  if (!h) {
    const a = f.messages.panelNotFound.replace("%s", g);
    console.error(a);
    const b = {
      content: a,
      ephemeral: true
    };
    await d.reply(b);
    return;
  }
  const i = [];
  if (h.useButtons) {
    h.products.forEach((c, d) => {
      const e = new b().setCustomId("product_" + g + "_" + c.name).setLabel(c.buttonLabel).setStyle(o(c.buttonColor));
      if (c.emoji) {
        e.setEmoji(c.emoji);
      }
      if (d % 5 === 0) {
        i.push(new a());
      }
      i[i.length - 1].addComponents(e);
    });
  } else {
    const b = new e().setCustomId("select_" + g).setPlaceholder(f.selectMenu.placeholder).addOptions(h.products.map(a => ({
      label: a.name,
      description: a.description.substring(0, 100),
      value: "product_" + g + "_" + a.name,
      emoji: a.emoji
    })));
    i.push(new a().addComponents(b));
  }
  const j = new c().setColor(h.embedColor || "#0099ff").setTitle(h.title).setDescription(p(h.description));
  if (h.AuthorName && h.AuthorURL) {
    const a = {
      name: h.AuthorName,
      iconURL: h.AuthorURL
    };
    j.setAuthor(a);
  } else if (h.AuthorName) {
    const a = {
      name: h.AuthorName
    };
    j.setAuthor(a);
  }
  if (h.Footer) {
    const a = {
      text: h.Footer,
      iconURL: h.FooterURL || undefined
    };
    j.setFooter(a);
  }
  if (h.ThumbnailURL) {
    j.setThumbnail(h.ThumbnailURL);
  }
  try {
    const a = {
      embeds: [j],
      components: i
    };
    await d.channel.send(a);
    const b = f.messages.panelPosted;
    if (!d.replied) {
      const a = {
        content: b,
        ephemeral: true
      };
      await d.reply(a);
    } else {
      const a = {
        content: b,
        ephemeral: true
      };
      await d.followUp(a);
    }
  } catch (a) {
    console.error("Failed to send panel message: " + a);
    const b = f.messages.failedToDisplayPanel;
    if (!d.replied) {
      const a = {
        content: b,
        ephemeral: true
      };
      await d.reply(a);
    } else {
      const a = {
        content: b,
        ephemeral: true
      };
      await d.followUp(a);
    }
  }
}
async function r(a, b) {
  const c = new Date();
  const d = {
    userId: a,
    buttonId: b
  };
  const e = await k.findOne(d);
  if (e && e.cooldown > c) {
    return e.cooldown;
  }
  return null;
}
async function s(a, b, c) {
  const d = new Date(new Date().getTime() + c * 1000);
  const e = {
    userId: a,
    buttonId: b
  };
  const f = {
    cooldown: d
  };
  const g = {
    $set: f
  };
  await k.updateOne(e, g, {
    upsert: true
  });
}
async function t(a, b, c) {
  const d = n.panels[b];
  if (!d) {
    await a.reply({
      content: n.messages.panelNotFound.replace("%s", b),
      ephemeral: true
    });
    return;
  }
  const e = d.products.find(a => a.name === c);
  if (!e) {
    await a.reply({
      content: "Product not found.",
      ephemeral: true
    });
    return;
  }
  const h = e.roleId;
  const k = a.member.roles.cache.has(h);
  if (!k) {
    const b = {
      content: n.messages.noRequiredRole,
      ephemeral: true
    };
    await a.reply(b);
    return;
  }
  const l = d.cooldownDuration || n.globalSettings.cooldownDuration;
  const m = await r(a.user.id, "product_" + b + "_" + c);
  if (m) {
    const b = Math.floor(m.getTime() / 1000);
    const c = n.messages.cooldownMessage.replace("%s", "<t:" + b + ":R>");
    const d = {
      content: c,
      ephemeral: true
    };
    await a.reply(d);
    return;
  }
  await s(a.user.id, "product_" + b + "_" + c, l);
  await a.deferReply({
    ephemeral: true
  });
  try {
    const b = i.join(__dirname, e.zipFilePath);
    if (!g.existsSync(b)) {
      throw new Error("The product directory for \"" + c + "\" does not exist - " + b);
    }
    const d = await g.promises.readdir(b);
    let h;
    if (d.length === 1 && (d[0].endsWith(".zip") || d[0].endsWith(".rar"))) {
      const a = i.join(b, d[0]);
      const c = await g.promises.readFile(a);
      const e = {
        name: d[0]
      };
      h = new f(c, e);
    } else {
      const a = new j();
      await v(a, b, b);
      const d = await a.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: {
          level: 9
        }
      });
      const e = c.replace(/\s+/g, "_") + ".zip";
      const g = {
        name: e
      };
      h = new f(d, g);
    }
    const k = {
      content: n.messages.downloadReady,
      files: [h]
    };
    await a.editReply(k);
    u(a.client, a.user.id, c);
  } catch (b) {
    console.error("Error preparing the download:", b);
    const c = {
      content: n.messages.downloadError
    };
    await a.editReply(c);
  }
}
async function u(a, b, d) {
  const e = {
    userId: b,
    productName: d
  };
  const f = await l.findOneAndUpdate(e, {
    $inc: {
      downloadCount: 1
    },
    $set: {
      timestamp: new Date()
    }
  }, {
    new: true,
    upsert: true
  });
  if (n.Log.ChannelID) {
    const b = await a.channels.fetch(n.Log.ChannelID);
    const d = new c();
    if (n.Log.Embed.Title) {
      d.setTitle(n.Log.Embed.Title);
    }
    if (n.Log.Embed.Description) {
      const a = n.Log.Embed.Description.join("\n").replace("{user}", "<@" + f.userId + ">").replace("{productname}", f.productName).replace("{time}", "<t:" + Math.floor(new Date(f.timestamp).getTime() / 1000) + ":F>").replace("{downloadamount}", f.downloadCount);
      d.setDescription(a);
    }
    if (n.Log.Embed.Footer && n.Log.Embed.Footer.Text) {
      const a = {
        text: n.Log.Embed.Footer.Text,
        iconURL: n.Log.Embed.Footer.Icon || undefined
      };
      d.setFooter(a);
    }
    if (n.Log.Embed.Author && n.Log.Embed.Author.Text) {
      const a = {
        name: n.Log.Embed.Author.Text,
        iconURL: n.Log.Embed.Author.Icon || undefined
      };
      d.setAuthor(a);
    }
    if (n.Log.Embed.Color) {
      d.setColor(n.Log.Embed.Color);
    }
    if (n.Log.Embed.Image) {
      d.setImage(n.Log.Embed.Image);
    }
    if (n.Log.Embed.Thumbnail) {
      d.setThumbnail(n.Log.Embed.Thumbnail);
    }
    const e = {
      embeds: [d]
    };
    await b.send(e);
  }
}
async function v(a, b, c) {
  const d = await g.promises.readdir(b);
  for (const e of d) {
    const d = i.join(b, e);
    const f = await g.promises.stat(d);
    if (f.isDirectory()) {
      await v(a, d, c);
    } else {
      const b = g.createReadStream(d);
      const e = i.relative(c, d);
      a.file(e, b, {
        binary: true
      });
    }
  }
}
module.exports = {
  run: async a => {
    a.on("interactionCreate", async a => {
      if (a.isButton()) {
        const [b, c, d] = a.customId.split("_");
        if (b !== "product") {
          return;
        }
        await t(a, c, d);
      } else if (a.isCommand() && a.commandName === "productpanel") {
        await q(a, n);
      } else if (a.isStringSelectMenu()) {
        const [b, c, d] = a.values[0].split("_");
        if (b !== "product") {
          return;
        }
        await t(a, c, d);
      }
    });
  },
  handleProductPanelCommand: q
};