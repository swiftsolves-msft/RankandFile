// Local-only harness for eyeballing the Conference dashboards without a live
// session (Cosmos is private-endpoint-only, so the backend cannot run locally).
// Not part of the production build — vite only bundles index.html.
//
//   /preview.html                        host board + a player's personal report
//   /preview.html?view=presenter         the pop-out, driven by a stubbed host
//   /preview.html?view=instructions&mode=conference
//                                        the pop-out's lobby deck (no stub host,
//                                        so it stays on the instructions loop)
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ConferenceResults from './components/conference/ConferenceResults';
import PresenterView from './components/PresenterView';
import QuoteRotator from './components/QuoteRotator';
import ZeroRankTitle from './components/ZeroRankTitle';
import { publishPresenterResults, subscribePresenter } from './lib/presenter';
import { RoundAggregate } from './lib/types';
import './src/globals.css';

const names = [
  'Priya', 'Marcus', 'Chen', 'Aisha', 'Tomás', 'Nate', 'Ravi', 'Lena',
  'Ibrahim', 'Yuki', 'Sofia', 'Dmitri', 'Grace', 'Omar', 'Elena', 'Kwame',
  'Mei', 'Diego', 'Fatima', 'Jonas', 'Ana', 'Hassan', 'Nora', 'Sarah',
];
const scores = [
  100, 95, 95, 90, 90, 85, 85, 80, 80, 75, 75, 70,
  70, 65, 65, 60, 55, 50, 45, 40, 30, 25, 15, 5,
];

const HOST_ID = 'p5'; // Nate, mid-pack on purpose
const MAX_ROUNDS = 3;

const aggregate: RoundAggregate = {
  roundNum: 2,
  submittedCount: 24,
  playerCount: 24,
  consensus: [
    { noun: 'Ransomware', isSpicy: false, position: 1, meanRank: 1.8, distribution: [11, 7, 4, 1, 1], spread: 0.98 },
    { noun: 'Zero Trust', isSpicy: false, position: 2, meanRank: 2.4, distribution: [5, 9, 6, 3, 1], spread: 1.05 },
    { noun: 'Firewall', isSpicy: false, position: 3, meanRank: 2.9, distribution: [3, 5, 8, 6, 2], spread: 1.1 },
    { noun: 'Government Backdoor', isSpicy: true, position: 4, meanRank: 3.9, distribution: [2, 1, 4, 8, 9], spread: 1.24 },
    { noun: 'Mass Surveillance', isSpicy: true, position: 5, meanRank: 4.0, distribution: [7, 1, 1, 4, 11], spread: 1.71 },
  ],
  alignments: names.map((name, i) => ({
    playerId: `p${i}`,
    name,
    toRoom: scores[i],
    toHost: Math.max(0, Math.min(100, scores[i] - 10 + ((i * 5) % 20))),
  })),
  outliers: [
    { playerId: 'p23', name: 'Sarah', toRoom: 5, noun: 'Mass Surveillance', theirPosition: 1, roomPosition: 5 },
    { playerId: 'p22', name: 'Nora', toRoom: 15, noun: 'Firewall', theirPosition: 5, roomPosition: 3 },
    { playerId: 'p21', name: 'Hassan', toRoom: 25, noun: 'Government Backdoor', theirPosition: 1, roomPosition: 4 },
  ],
  roomAverageAlignment: 64.4,
  hostRanking: ['Zero Trust', 'Ransomware', 'Mass Surveillance', 'Firewall', 'Government Backdoor'],
  hasHostRanking: true,
  hostToRoom: 85,
  mostDivisiveNoun: 'Mass Surveillance',
  isFinalRound: false,
};

const myRanking = ['Ransomware', 'Firewall', 'Zero Trust', 'Mass Surveillance', 'Government Backdoor'];

/**
 * Stands in for the host's window. Only answers `presenter-ready`, which is the
 * path that matters: it proves a popup opened *after* results were published
 * still gets them replayed.
 */
function StubHost() {
  useEffect(
    () =>
      subscribePresenter(m => {
        if (m.type === 'presenter-ready') {
          publishPresenterResults({ aggregate, hostPlayerId: HOST_ID, maxRounds: MAX_ROUNDS });
        }
      }),
    []
  );
  return null;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <p style={{ color: '#71717a', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'system-ui' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

const view = new URLSearchParams(window.location.search).get('view');

createRoot(document.getElementById('root')!).render(
  view === 'landing' ? (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 48 }}>
      <ZeroRankTitle />
      <div style={{ marginTop: 24 }}>
        <QuoteRotator />
      </div>
      <div style={{ marginTop: 64 }}>
        <ZeroRankTitle size="large" />
      </div>
    </div>
  ) : view === 'instructions' ? (
    // No stub host, so nothing answers presenter-ready and the view stays on the
    // lobby instruction loop — the deck comes from the ?mode= param.
    <PresenterView />
  ) : view === 'presenter' ? (
    <>
      {/* Mounted first so its subscription is live before PresenterView asks. */}
      <StubHost />
      <PresenterView />
    </>
  ) : (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <Section label="Host board — the 2×2 shared to the room">
        <ConferenceResults
          aggregate={aggregate}
          hostPlayerId={HOST_ID}
          myPlayerId={HOST_ID}
          myRanking={aggregate.hostRanking}
          variant="host"
        />
      </Section>

      <Section label="Player personal report — panels 2 and 4 re-pointed at 'you'">
        <ConferenceResults
          aggregate={aggregate}
          hostPlayerId={HOST_ID}
          myPlayerId="p9"
          myRanking={myRanking}
          variant="player"
        />
      </Section>
    </div>
  )
);
