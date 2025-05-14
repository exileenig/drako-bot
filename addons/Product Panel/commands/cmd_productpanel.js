const {
  SlashCommandBuilder: a
} = require("discord.js");
const b = require("js-yaml");
const c = require("fs");
const d = require("path");
const {
  handleProductPanelCommand: e
} = require("../events/productpanel");
const f = d.join(__dirname, "..", "config.yml");
const g = b.load(c.readFileSync(f, "utf8"));
module.exports = {
  data: new a().setName("productpanel").setDescription("Post your product panels").addStringOption(a => a.setName("panel").setDescription("The panel to send").setRequired(true).setChoices(...Object.keys(g.panels).map(a => {
    const b = g.panels[a].title || a;
    return {
      name: b,
      value: a
    };
  }))),
  async execute(a) {
    const b = a.member.roles.cache;
    const c = g.ProductPanelRole.some(a => b.has(a));
    if (!c) {
      await a.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true
      });
      return;
    }
    await e(a, g);
  }
};