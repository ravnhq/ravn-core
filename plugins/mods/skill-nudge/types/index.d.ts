export type Nudge = { skill: string; reason: string };

declare module "claude-code" {
  interface PluginState {
    "skill-nudge": {
      nudge: Nudge | null;
      offered: string[];
      turnsSinceJudgment: number;
    };
  }
}
