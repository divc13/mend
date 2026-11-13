# MEND character system (v2)

Paper-cut protagonist + ink-line supporting cast. Everything is SVG, no external
character assets. All components are frame-driven by default and also accept an
explicit `frame` / `progress` for deterministic scene choreography.

## Cast

| Component | Role | Key props |
| --- | --- | --- |
| `Sam` | Layered paper-cut protagonist | `pose`, `progress`, `phoneScreen`, `phoneScreenSrc`, `flash`, `flip` |
| `StickFigure` | Reusable ink-line figure | `pose`, `armAngles`, `legAngles`, `accessory`, `hardHat`, `colorTag`, `sash`, `stamp` |
| `Neighbor` | Stick figure with phone | `pose`, `colorTag` |
| `Contractor` | Hard hat + wrench | `pose`, `showWrench` |
| `Inspector` | Clipboard + check stamp + glasses | `pose`, `stamp` |
| `CouncilTable` | 3 sashed voters, 2 YES + 1 ABSTAIN | `votes`, `revealProgress` |
| `BidderRow` | 3 sealed bidders, lock/reveal, winner bounce | `revealed`, `winner`, `bids` |

## Usage

```tsx
import { Img } from 'remotion';
import { Sam } from './characters/Sam';
import { StickFigure } from './characters/StickFigure';
import { CouncilTable } from './characters/CouncilTable';
import { BidderRow } from './characters/BidderRow';

<Sam pose="raise-phone" progress={1} width={300} height={570} />

<Sam
  pose="look-at-screen"
  progress={1}
  width={300}
  height={570}
  phoneScreen={<Img src={reportScreenshot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
/>

<Sam pose="raise-phone" phoneScreenSrc={reportScreenshot} width={300} height={570} />

<StickFigure pose="hold-envelope" width={110} height={190} colorTag="#8fd3b4" />

<CouncilTable width={900} height={320} votes={['yes', 'yes', 'abstain']} revealProgress={1} />

<BidderRow width={900} height={300} revealed winner="B" bids={{ A: 92, B: 78, C: 85 }} />
```

`Sam` poses: `walk`, `stop`, `kneel`, `raise-phone`, `take-photo`, `look-at-screen`.

`StickFigure` poses: `stand`, `walk`, `kneel`, `raise-card`, `hold-envelope`,
`hold-clipboard`, `hold-phone`.

Angles are degrees measured from straight down; positive rotates toward the
figure's right (viewer right). `armAngles` / `legAngles` override the upper
segment, `forearmAngles` / `shinAngles` override the lower segment.

The `CharacterGallery` composition in `src/Root.tsx` renders every pose at
1920×1080, 30 fps, 150 frames.
