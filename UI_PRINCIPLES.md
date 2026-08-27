# Mobile-First Game UI Principles

This file is the source of truth for mobile-first UI work across browser games, including life simulations, career simulations, narrative games, management games, and games with tactical or combat modes.

These are defaults, not inflexible laws. A rule may be relaxed when a different treatment materially improves comprehension, accessibility, or play. Any exception must preserve the player's context, keep the primary action obvious, and be tested on a narrow mobile viewport.

## 1. Design Around the Player's Next Decision

1. Every gameplay screen should quickly answer four questions:
   - Where am I in the run?
   - What matters right now?
   - What changed?
   - What can I do next?
2. Give the current decision, event, or playable scene the most visual weight. Persistent navigation and secondary statistics must not compete with it.
3. Keep important cause and effect legible. Players should be able to connect outcomes to their condition, preparation, relationships, traits, and earlier choices rather than seeing unexplained number changes.
4. Reveal only information that can affect a decision, explain an outcome, reinforce identity, or contribute to the history of the run.
5. Repeated screens may keep the same structure, but their stakes and emphasis should evolve as the run progresses.

## 2. Mobile-First Layout

6. Start with a single-column vertical layout designed for narrow touch screens. Use approximately `320px` to `430px` as the primary design range.
7. On wider displays, center the core play surface and normally cap its reading width around `720px`. Wider layouts may add useful context, comparison, or navigation panels when they improve the experience without changing the fundamental information order or decision flow.
8. Use a predictable gameplay shell:
   - compact context or status header;
   - one dominant active surface;
   - optional scrollable middle content;
   - primary actions in a stable lower action area when the screen benefits from it.
9. Respect device safe areas with `env(safe-area-inset-*)`. Bottom actions must remain clear of browser chrome, home indicators, and virtual keyboards.
10. Do not introduce decorative or accidental empty space. Extra height may improve breathing room, enlarge the active scene, or separate important groups, but should not make related information feel disconnected.
11. Avoid generic admin-dashboard layouts. The interface should express the game's fantasy through typography, color, material, illustration, terminology, and restrained motion while preserving clarity.

## 3. Scrolling and Viewport Behavior

12. During common, repeated gameplay states, prefer a stable shell that fits within `100dvh` and does not require the entire page to scroll.
13. When the event, history, biography, comparison, roster, or other variable-length content cannot remain readable inside the viewport, make the central content region vertically scrollable. Keep the current context and primary action visible or readily recoverable.
14. A useful dense-screen structure is:

```text
fixed or compact context header
scrollable middle content: minmax(0, 1fr)
stable primary action area
```

15. Internal scrolling is an intentional tool, not a failure. Use it when shortening the content would remove meaningful choices, causal explanation, accessibility, or narrative value.
16. Make a scrollable region visually apparent through clipping, spacing, a subtle edge treatment, or partial content reveal. Do not hide essential content below an unmarked fold.
17. Avoid nested vertical scroll areas. Prefer one scroll owner per screen or modal.
18. Never require horizontal scrolling for normal gameplay. Use responsive stacking, wrapping, disclosure, or an alternate comparison view.
19. Full-page scrolling is acceptable for naturally document-like or low-frequency surfaces such as a complete life history, encyclopedia, credits, patch notes, accessibility settings, or an exported biography.
20. Preserve a player's reading position when closing a detail view or returning from a reversible sub-flow.

## 4. Typography and Readability

21. All visible player-facing text should normally be at least `14px`; body text should normally be at least `15px`. Supporting text may use `13px`, but should never fall below `12px`.
22. When content does not fit, shorten labels, hide secondary details, add disclosure, or allow the middle region to scroll before reducing type size.
23. Use comfortable line height and keep long-form text at a readable measure. Avoid dense full-width paragraphs even when the device is wide.
24. Use clear hierarchy through size, weight, spacing, and placement. Do not rely on low contrast or subtle color shifts to distinguish important information.
25. Traditional Chinese UI copy should use Source Han Sans TC, with Noto Sans TC and Traditional Chinese system fonts as fallbacks. Avoid small serif fallback text.
26. Allow for localized strings to expand. Controls must not depend on a short English label to retain their shape or meaning.
27. Prefer direct, player-facing language. Internal IDs, implementation terms, raw formulas, and unexplained abbreviations must not appear in the UI.

## 5. Touch, Controls, and Action Hierarchy

28. Interactive targets should normally be at least `44px` in both dimensions. Frequently used or primary actions should generally be `48px` to `56px` high or larger.
29. Place frequent primary actions within comfortable thumb reach when practical. Do not put a destructive action beside the most common continuation action without sufficient separation and confirmation.
30. A screen should normally have one visually dominant primary action. Secondary and tertiary actions must be recognizable without competing at equal weight.
31. Buttons with supporting copy should use a vertical stack: action title first, explanation second. Do not place long supporting text inline beside the title.
32. Disable unavailable actions explicitly and explain the unmet requirement nearby. Do not let a button appear usable and fail only after it is tapped.
33. Preserve control placement across repeated turns where possible so players build motor familiarity.
34. Do not require hover for essential information or interaction. Hover may enhance desktop use, but touch and keyboard users need equivalent access.
35. Confirm irreversible actions. Routine, reversible actions should remain fast and should not be burdened with unnecessary confirmations.

## 6. Information Density and Progressive Disclosure

36. Show the smallest set of status information required for the current decision. Put complete statistics, records, history, settings, and explanations behind deliberate disclosure.
37. Prefer plain text and spacing when they provide enough structure. Use cards, panels, and borders only when they add meaningful grouping, interaction, state, contrast, or hierarchy.
38. Do not give every statistic equal visual weight. Prioritize urgent risks, constrained resources, current goals, and recently changed values.
39. Use labeled bars for bounded attributes when shape and proportion matter. Preserve exact values in visible detail text or accessible labels.
40. When development includes both current ability and future possibility, distinguish current value from potential clearly and provide a visual key.
41. Use color as reinforcement, never as the only carrier of status. Pair it with labels, icons, shape, position, or patterns.
42. Keep advanced formulas and detailed probability breakdowns optional. The default view should communicate the main causes, trade-offs, and degree of uncertainty in plain language.

## 7. Events, Choices, and Results

43. Event screens should establish context before presenting choices. The player should understand who is involved, what is at stake, and why the decision is happening now.
44. Multi-beat scenes should reveal one readable beat at a time when timing or comprehension benefits from it. Long prose may instead use the scrollable middle region when uninterrupted reading is the better experience.
45. Choices in the same event should share a consistent structure and expose the information needed to compare them. They do not need equal height in a vertical list unless equal sizing materially improves comparison.
46. Distinguish guaranteed effects, possible effects, requirements, costs, and unknown consequences. Never imply certainty when an outcome is probabilistic.
47. Let the entire choice row be tappable. Do not repeat a redundant small call-to-action inside every row.
48. Result surfaces should show only actual changes, meaningful consequences, and useful causal explanation. Do not dump every unchanged statistic.
49. A transient result may use a blocking dialog over the previous context. Keep the underlying scene recognizable, use one clear continuation action, and avoid stacking multiple blocking layers.
50. If a result is too long to fit legibly, allow the dialog body to scroll while keeping its title and continuation action stable. A no-scroll dialog is preferable only when the content remains complete and readable.
51. Surface delayed consequences when they become relevant, and reference the earlier decision that caused or influenced them.

## 8. Life-Simulation and Long-Run Context

52. Keep the character's identity, current life phase, age or time, and immediate objective easy to recover without displaying the entire character sheet at all times.
53. Preserve important history: turning points, promises, injuries, debts, records, relationships, rivals, institutions, and unrealized opportunities. History screens may be scrollable and should prioritize story-shaped milestones over raw logs.
54. Reuse named characters visibly. When someone returns, remind the player of the relevant shared history rather than presenting them as a new disposable event actor.
55. Relationship displays should communicate why the relationship matters now. Avoid exposing multiple relationship meters unless each can change a decision or outcome.
56. Character creation should use progressive disclosure. Ask for identity and meaningful starting choices first, then provide a concise confirmation of committed traits, resources, risks, and starting circumstances before the run begins.
57. Separate current ability from potential when growth matters. Potential may be uncertain or partially hidden, but the interface should provide enough evidence for players to form expectations.
58. Make time advancement explicit and predictable. Do not require a button merely to reveal automatic, non-player activity; reserve actions for decisions, preparation, interruption, or meaningful acknowledgement.
59. Support multiple forms of success. Avoid a single end score that invalidates resilient, unusual, ethical, relationship-focused, or modest lives.
60. End-of-run presentation should synthesize a biography: defining turning points, relationships, achievements, failures, unresolved possibilities, and legacy. Detailed statistics may follow as a secondary section.
61. Seed or replay information should be easy to copy and share when it supports comparison, challenges, or alternate-life exploration, but it must not dominate normal play.

## 9. Lists, Selection, and Comparison

62. For a short set of consequential options, show complete choices directly. For a long or growing set, use a compact list, segmented control, searchable selector, or dropdown paired with one focused detail panel.
63. Selection state must be obvious through more than color. Repeat the selected item near the action area when loss of context is likely on a narrow screen.
64. Comparisons should align equivalent information and emphasize meaningful differences. Hide unchanged or irrelevant fields.
65. When replacing an equipped ability, role, item, plan, or relationship commitment, show the normal acquisition result first and then a dedicated keep-or-replace comparison before advancing.
66. Large rosters and histories should support filtering or grouping before adding increasingly dense rows.

## 10. Modals, Drawers, and Navigation

67. Use a modal only for a focused interruption, confirmation, result, or comparison that must be resolved before play continues.
68. Use drawers or dedicated screens for optional reference material, settings, records, histories, and multi-step management.
69. Do not stack modals. Resolve or replace the current overlay before opening another.
70. Closing a non-destructive overlay should return the player to the same game state, selection, and reading position.
71. Back behavior must be predictable on both browser and device controls. It should close the top reversible surface before abandoning the current run or navigation context.

## 11. Feedback, Motion, and Tone

72. Give immediate feedback for taps, selections, resource spending, state changes, saves, and errors.
73. Reserve strong animation for meaningful state changes, danger, rewards, phase transitions, and onboarding. Avoid constant motion that competes with reading or decision-making.
74. Respect `prefers-reduced-motion`. Essential state changes must remain understandable without animation.
75. Keep feedback proportional. Routine actions need a quick acknowledgement; turning points deserve more space, sound, motion, or ceremony.
76. Sound and haptics may reinforce feedback but must never be required to understand the outcome.

## 12. Accessibility and Resilience

77. Maintain readable contrast in every theme and state, including disabled controls, overlays, bars, and text over images.
78. Support keyboard navigation and visible focus states where the platform allows it. Use semantic DOM controls and accessible names for interactive elements.
79. Do not rely on rapid reactions, precise dragging, or multi-touch gestures unless they are fundamental to the game; provide an accessible alternative when possible.
80. Preserve user progress through refreshes, temporary disconnections, accidental navigation, and backgrounding when the game architecture permits it.
81. Save settings for text size, motion, sound, contrast, and other accessibility preferences independently from a run.
82. Test with browser zoom and larger system text. Critical controls and information must remain reachable without overlap.

## 13. Playfield and Mode-Specific Rules

83. When a game includes a visual playfield, arena, board, map, or real-time scene, protect its center and lower-middle area from persistent UI whenever spatial reading is important.
84. Default to one primary persistent HUD cluster and at most one small secondary cluster. Put journals, logs, lore, detailed objectives, and long control references behind disclosure.
85. Pause or gate playfield input when a modal, menu, or pointer-driven overlay is active.
86. Tactical timelines and automatic turns should advance without requiring empty confirmation taps. Interrupt only when the player has a meaningful decision.
87. During target-based play, selectable targets need obvious selected, unavailable, and defeated states, plus accessible names. Repeat the current target near the associated actions on narrow screens.
88. Communicate survival, health, energy, or other critical state through more than tiny numbers alone.

## 14. Implementation Defaults

89. Use DOM UI for text-heavy, interactive, and accessible surfaces. Use canvas or WebGL for the game world when appropriate rather than forcing all interface content into one rendering layer.
90. Define theme, spacing, typography, safe-area, status, and motion tokens with CSS custom properties.
91. Implement the gameplay shell with resilient sizing such as `min-height: 100dvh`, `minmax(0, 1fr)` for the flexible middle region, and `overflow-y: auto` only on the intended scroll owner.
92. Test loading, empty, partial, disabled, error, offline, resumed, and completed states—not only the ideal populated screen.
93. Optimize the initial experience for fast comprehension and interaction. Defer heavy media and secondary data that are not required for the first decision.

## Mobile UX Review Checklist

Before accepting a screen, verify:

- The current context and next meaningful action are obvious within a few seconds.
- The layout works at `320px` width and with device safe areas.
- Text remains readable without shrinking below the stated minimums.
- Primary controls are thumb-friendly and do not move unpredictably between repeated turns.
- No essential action or consequence is hidden behind an unmarked fold.
- Long content uses one intentional scroll region with stable context and actions where appropriate.
- There is no horizontal scrolling or hover-only information.
- Choices communicate costs, requirements, certainty, and risk honestly.
- Results show actual changes and enough explanation to preserve causal ownership.
- Returning characters, past choices, and long-term consequences retain visible continuity.
- Modals, back behavior, refreshes, and interrupted sessions preserve the player's state.
- The screen feels like part of the game rather than a generic dashboard.
