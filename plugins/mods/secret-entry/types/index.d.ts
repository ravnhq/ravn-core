export type Entry = {
  origin: string;
  file: string;
  template: string | null;
  edit: { old: string; replaceAll: boolean } | null;
  keys: string[];
  values: Record<string, string>;
  index: number;
  field: string;
  note: string | null;
  decision: null | "write" | "cancel";
};

declare module "claude-code" {
  interface PluginState {
    "secret-entry": {
      entry: Entry | null;
    };
  }
}
