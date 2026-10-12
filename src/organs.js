// One entry per organ. `mode` selects the warp in the tube shader,
// the copy feeds the specimen card.
export const ORGANS = [
  {
    id: 'brain', no: '01', latin: 'Cerebrum', name: 'Brain', mode: 0,
    color: '#a9e4ff', phosphor: 'P4 · cold white', tube: '15″ rectangular · 90° yoke',
    loop: 'Strobe recall',
    text: 'Holds one frame for five seconds, then flashes one of the other three for a single field, as if trying to remember it.',
    cover: 0.25,
  },
  {
    id: 'eye', no: '02', latin: 'Oculus', name: 'Eyes', mode: 1,
    color: '#8f8bff', phosphor: 'P11 · violet-blue', tube: '2 × 5″ viewfinder tubes on goosenecks',
    loop: 'Saccade',
    text: 'Stares, darts sideways, blinks, and for a second forgets it is not a camera. Both tubes turn to follow you.',
    cover: 1,
  },
  {
    id: 'lungs', no: '03', latin: 'Pulmo', name: 'Lungs', mode: 2,
    color: '#62ff93', phosphor: 'P31 · green', tube: '2 × 14″ portrait tubes on hinges',
    loop: 'Bellows',
    text: 'The raster inflates and empties fourteen times a minute while the tubes swing open and shut on their hinges. Every second exhale wipes in the next frame.',
    cover: 0.2,
  },
  {
    id: 'heart', no: '04', latin: 'Cor', name: 'Heart', mode: 3,
    color: '#ff5436', phosphor: 'P22R · red', tube: '7″ round radar tube',
    loop: '72 bpm',
    text: 'The picture swells with each beat. Every fourth beat knocks the next slide into place.',
    cover: 0,
  },
  {
    id: 'stomach', no: '05', latin: 'Gaster', name: 'Stomach', mode: 4,
    color: '#d9ff3d', phosphor: 'P1 · yellow-green', tube: '11″ rectangular, hung askew',
    loop: 'Churn',
    text: 'Frames are swallowed from the top of the raster and twisted on the way down.',
    cover: 0.3,
  },
  {
    id: 'kidney', no: '06', latin: 'Ren', name: 'Kidneys', mode: 5,
    color: '#ff52d9', phosphor: 'P22 · magenta', tube: '2 × 5″ tubes on swivel arms',
    loop: 'Filter',
    text: 'Each frame is folded down its middle and combed sideways into the next. The two tubes run two slides out of step.',
    cover: 0.35,
  },
  {
    id: 'gut', no: '07', latin: 'Intestinum', name: 'Gut', mode: 6,
    color: '#ffa63a', phosphor: 'P3 · amber', tube: '17″ rectangular · 9 m of coiled cord',
    loop: 'Conveyor',
    text: 'All four frames pass sideways, end to end, forever. Nothing is held and nothing is digested.',
    cover: 0.6,
  },
];
