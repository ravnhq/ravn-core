---
name: unslop-ui
description: >-
  Unslop a page or component: measure its rhythm, then strip the generic
  interface costume. Use when the user asks to unslop a page or component,
  or says that interface looks vibecoded. Invoke as /unslop-ui.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Unslop UI

Quiet the painted page or component the user named. Leave paragraphs alone.

## 1. See the region

Open the region the way a user does, and read the source that sets its spacing, type, and color. Done when you can name the region and the files that own those three.

## 2. Mark the costume

Record only what is on that region:

- a gradient or a glow on a surface, a border, or type
- an active item drawn as a different shape from the idle item
- emoji or extra punctuation on a metric
- a separate hue on a category, an icon, or a bar
- a border around every row in a list
- icons from more than one family

Done when each line names an element you saw.

## 3. Measure the rhythm

Read the vertical gaps and the horizontal insets. Give each gap one role: inside a control, between siblings, or between groups. Read the panel inset on its own, and the gap from an icon to its label on its own.

Done when each gap has a role and you can name the gaps that break it, plus the edges that should share a line (a sidebar with its content, cards in a row, a label with its value). When the costume list is empty and no gap breaks its role, stop and say the region is already quiet.

## 4. Edit the region

Keep the data, the actions, and which information sits where. Use the project's spacing and color tokens. A light region stays light, and a dark region stays dark. With no spacing tokens, use a 4-based scale and the three roles only.

1. Snap every gap to its role. Sibling gaps repeat. A group gap is the next step up. Set the panel inset once, and the icon-to-label gap once.
2. Align the shared edges from the measure.
3. Set hierarchy with size and weight.
4. Make repeated surfaces flat steps of the theme's hue. Sibling rows share a surface. A border wraps a group, not each row. A glow or a gradient is allowed on the active item and on the one primary action. A glow on the page, a card, or type goes. The active item keeps the idle item's shape.
5. Use one icon family. The primary action and the active item share one accent from the product. A status that needs a decision gets one other hue. A chart uses one neutral, and its extreme may take the accent. A category keeps a hue only when that hue is how the user tells the items apart. With nothing to mark, add no hue.

Done when the diff is spacing, alignment, type, color, and chrome, and you can point at the accent and any status hue, or at their absence.

## 5. Check the paint

Open the same region the way a user does and confirm the gaps on screen are the ones you set. Include a long label and an empty state when the region has them, at the width the user uses. Done when the screen matches the scale, or you have corrected it.
