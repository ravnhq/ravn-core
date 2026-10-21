// `asksClaude`: the skill is hidden from the `/` menu, so Use asks Claude to run it.
export type Nudge = { skill: string; reason: string; asksClaude: boolean };

declare module "claude-code" {
  interface PluginState {
    "skill-nudge": {
      nudge: Nudge | null;
      offered: string[];
      turnsSinceJudgment: number;
    };
  }
}
