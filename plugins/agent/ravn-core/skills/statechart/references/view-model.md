# View model

Use `--view` to give the command a module that maps model values to the words a reader sees. Export `state(vars)` returning a string for a flat chart, an array for parent states, or an object whose keys are parallel regions. A TLA+ sequence arrives as an object with keys starting at `1`; a set arrives as an array.

`step(action, from, to)` labels arrows. Give actions that lead to the same result the same label. Name the observable event or outcome, not the TLA+ action. A bracketed condition can narrow a step when it can only happen in that situation. On region charts let the command label conditions in other regions; a manual bracket replaces its inferred condition.

Optional exports: `group(vars)` supplies each phase name, `colors` maps names to `blue`, `orange`, `purple`, `yellow`, `teal`, `tan`, or `pink`, and `title` labels the chart. A state merged across groups has no group color. The command memoizes labeling, so each function must depend only on its arguments.

Aim for about 20 arrows. The chart draws label changes, so split labels to show an important transition; coarsen labels if distinctions do not matter. Keep separate bug-path states and marks when merging would turn `breaks` into `mayBreak` or obscure which rule broke. To hide an unneeded arrow return `null` from `step()` for every step it represents. Preserve reachability from a start and at least one outgoing arrow for each state with a step out. Say which steps the chart hides.
