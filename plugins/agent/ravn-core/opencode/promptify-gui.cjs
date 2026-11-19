var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// plugins/agent/ravn-core/opencode/promptify-gui.ts
var exports_promptify_gui = {};
__export(exports_promptify_gui, {
  default: () => promptify_gui_default
});
module.exports = __toCommonJS(exports_promptify_gui);
var import_gui = require("@opencode/plugin/gui");

// plugins/agent/ravn-core/opencode/promptify-rpc.ts
var import_rpc = require("@opencode/plugin/rpc");
var import_effect = require("effect");
var promptifyRpc = import_rpc.Rpc.define({
  id: "ravn-promptify",
  methods: {
    draft: {
      input: import_effect.Schema.toStandardSchemaV1(import_effect.Schema.Struct({ sessionID: import_effect.Schema.String })),
      output: import_effect.Schema.toStandardSchemaV1(import_effect.Schema.Struct({ text: import_effect.Schema.String, draft: import_effect.Schema.String }))
    }
  },
  events: {}
});

// plugins/agent/ravn-core/opencode/promptify-gui.ts
var promptify_gui_default = import_gui.Plugin.define({
  setup(ctx) {
    ctx.add(import_gui.Command, {
      id: "insert-promptify-draft",
      title: "Insert Promptify draft",
      section: "prompt",
      slash: { name: "promptify-insert" },
      async run() {
        const session = ctx.sessions.current();
        if (!session)
          return;
        const { text, draft } = await session.server.client.rpc(promptifyRpc).draft({ sessionID: session.id }, { location: session.location });
        if (!draft) {
          ctx.toast.show({ title: text });
          return;
        }
        if (ctx.sessions.current()?.key !== session.key)
          return;
        const composer = ctx.screen.current()?.composer;
        if (composer)
          composer.insert(`${composer.text() ? `

` : ""}${draft}`);
      }
    });
  }
});
