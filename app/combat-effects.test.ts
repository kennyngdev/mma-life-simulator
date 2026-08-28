import { describe, expect, it } from 'vitest';
import { effectForAction, timelineMarkerPresentation } from './combat-effects';
import { sects } from './life-engine';

describe('combat presentation', () => {
  it('gives every sect one move in each visual effect family', () => {
    for (const sect of sects) {
      expect(sect.moves.map((move) => effectForAction(move.id)).sort()).toEqual(['guard', 'power', 'recovery', 'swift']);
    }
  });

  it('separates tied timeline markers and displays the engine’s post-action overflow', () => {
    const actors = [{ id: 'player', progress: 0 }, { id: 'enemy-0', progress: 26.3333 }, { id: 'enemy-1', progress: 26.3333 }];
    expect(timelineMarkerPresentation(actors, 'enemy-0')).toEqual({ progress: 26.3333, shift: -10 });
    expect(timelineMarkerPresentation(actors, 'enemy-1')).toEqual({ progress: 26.3333, shift: 10 });
    expect(timelineMarkerPresentation(actors, 'player')).toEqual({ progress: 0, shift: 0 });
    expect(timelineMarkerPresentation([{ id: 'enemy-1', progress: 6.5 }], 'enemy-1')).toEqual({ progress: 6.5, shift: 0 });
    const closeActors = [{ id: 'faster', progress: 85 }, { id: 'slower', progress: 82 }];
    expect(timelineMarkerPresentation(closeActors, 'slower').shift).toBe(-10);
    expect(timelineMarkerPresentation(closeActors, 'faster').shift).toBe(10);
  });

  it('holds the ready actor at the exact end of the timeline while everyone is paused', () => {
    const actors = [{ id: 'player', progress: 2 }, { id: 'enemy-0', progress: 98 }];
    expect(timelineMarkerPresentation(actors, 'player', 'player')).toEqual({ progress: 100, shift: 0 });
    expect(timelineMarkerPresentation(actors, 'enemy-0', 'player')).toEqual({ progress: 98, shift: -20 });
  });
});
