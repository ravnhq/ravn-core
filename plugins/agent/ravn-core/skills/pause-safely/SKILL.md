---
name: pause-safely
description: >-
  Pause work and leave a resumable checkpoint another agent, in any harness,
  can pick up cold. Use when the user asks to pause, stop for now, go
  offline, restart, or hand off. Requests to keep going and automatic
  context compaction are not pauses. Use session-pickup to resume.
license: See LICENSE.txt
---

# Pause Safely

You own a clean stop. The checkpoint is a handoff note a cold-start agent resumes from without reconstructing this session.

Only an explicit request pauses. On "keep going", "don't stop", or a context compaction, keep the same checkpoint facts in mind and continue the authorized work.

## Step 1. Stop at a safe boundary

Finish the current atomic step, or back out of only your own incomplete change; leave unrelated work as it is. Start nothing new. Settle or stop background work you started (processes, subagents) where that is safe, and record anything still running and how to inspect it.

Done when nothing you started is mid-edit and every running operation is either stopped or recorded.

## Step 2. Commit the work

Commit your in-progress edits on the current branch, staging only the changes this work made, with a conventional commit message that describes them. If the tree is broken, say so in one line of the commit body. Take no outward action to pause: no push, no PR, no messages.

## Step 3. Write the handoff note

Write `.agents/handoffs/<id>.md` at the repository root, where `<id>` is your session ID when your harness exposes one. Otherwise `<id>` is the UTC date as `YYYYMMDD` plus a short kebab-case slug naming the work, such as `20261001-hourly-digest-job`. Outside a repository, write it in the working directory.

The note covers:

- **Objective**: the original goal and the user's current constraints.
- **State**: branch, worktree, base, and whether the tree is clean or broken.
- **Done**: completed work, with what was verified and at which commit.
- **Pending**: remaining work and open decisions.
- **Running**: operations still in flight and how to inspect them.
- **Key paths**: files and artifacts that matter, plus gotchas.
- **Next action**: the first concrete step on resume.

Link to existing evidence (commits, PRs, logs) instead of copying it. Keep secrets out.

Done when an agent with only the note and the repository could take the next action.

## Step 4. Commit the note

Commit the note as `chore: pause handoff`. The pause request authorizes the work and note commits and nothing more. If the directory is not a repository or a hook rejects the commit, leave the note on disk and report why it is uncommitted.

## Report

This is a pause, not a final report. Give the note path, the commits made, whether the tree is clean, anything unverified or still running, and the first action on resume.
