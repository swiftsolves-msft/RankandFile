// Local-only harness for eyeballing the Conference dashboards without a live
// session (Cosmos is private-endpoint-only, so the backend cannot run locally).
// Not part of the production build — vite only bundles index.html.
import { createRoot } from 'react-dom/client';
import ConferenceResults from './components/conference/ConferenceResults';
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

createRoot(document.getElementById('root')!).render(
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

    <Section label="Pop-out single panel, large scale (Phase 3 preview)">
      <ConferenceResults
        aggregate={aggregate}
        hostPlayerId={HOST_ID}
        myPlayerId={HOST_ID}
        myRanking={aggregate.hostRanking}
        variant="host"
        focus="verdict"
        scale="large"
      />
    </Section>
  </div>
);
