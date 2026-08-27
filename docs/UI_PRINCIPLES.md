# UI principles

- Use one mobile-first vertical frame capped at 720px on wider screens; do not turn the game into a desktop dashboard.
- Fit each play state within `100dvh` without page scrolling. A clearly bounded internal reading panel may scroll when a biography is dense.
- Keep player-facing type at 14px minimum, with normal story text at 15px or larger. Reduce secondary detail before shrinking text.
- Use available space purposefully. Primary actions stay obvious and reachable by touch and keyboard.
- Represent bounded attributes with labeled horizontal bars. When growth has a cap, show current and potential fills together, include a visual key, and retain exact values in accessible labels.
- Enemy cards occupy the upper battle lane and allies the lower lane. Living enemies are selectable only on the player's turn; selected and defeated states must be obvious.
- Keep the timeline above the arena, repeat the current target near actions, and anchor available moves at the bottom.
- Health and inner power rely on bars as well as numbers. Do not communicate combat state through tiny text alone.
- Advance timelines automatically through allies and enemies. Never require a button merely to reveal the next actor.
- Respect reduced-motion preferences. Sound is optional and never carries essential information.
