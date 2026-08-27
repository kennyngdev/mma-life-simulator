import { describe, expect, it } from 'vitest';
import { effectForAction, timelineMarkerPresentation } from './combat-effects';
import { sects } from './life-engine';

describe('combat presentation', () => {
  it('gives every sect one move in each visual effect family', () => {
    for (const sect of sects) {
      expect(sect.moves.map((move) => effectForAction(move.id)).sort()).toEqual(['guard', 'power', 'recovery', 'swift']);
    }
  });

  it('separates tied timeline markers and holds the acting marker at the endpoint', () => {
    const actors = [{ id: 'player', progress: 0 }, { id: 'enemy-0', progress: 26.3333 }, { id: 'enemy-1', progress: 26.3333 }];
    expect(timelineMarkerPresentation(actors, 'enemy-0')).toEqual({ progress: 26.3333, shift: -10 });
    expect(timelineMarkerPresentation(actors, 'enemy-1')).toEqual({ progress: 26.3333, shift: 10 });
    expect(timelineMarkerPresentation(actors, 'enemy-1', null, 'enemy-1')).toEqual({ progress: 100, shift: 0 });
    expect(timelineMarkerPresentation(actors, 'player', 'player')).toEqual({ progress: 100, shift: 0 });
    const closeActors = [{ id: 'faster', progress: 85 }, { id: 'slower', progress: 82 }];
    expect(timelineMarkerPresentation(closeActors, 'slower').shift).toBe(-10);
    expect(timelineMarkerPresentation(closeActors, 'faster').shift).toBe(10);
  });
});
