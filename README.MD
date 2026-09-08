# ZeroRank

A real-time, multiplayer exercise in which a room ranks cybersecurity concepts by
personal importance, then compares answers. It surfaces where a team genuinely
agrees, where it quietly does not, and which topics are worth arguing about.

**[Play at zerorank.net](https://zerorank.net)**

![ZeroRank](images/zeroranklogo.png)

---

## Overview

Every round, all players receive the same five cards drawn from a pool of
cybersecurity terms, and rank them from most to least important. What happens
next depends on the game mode the host selects.

The card pool mixes established practice with deliberately contested topics
(government backdoors, mass surveillance, employee monitoring, hack-back laws).
Those are included because consensus is not the interesting result.

Runs in a browser on any device. Players join with a six-character code or by
scanning a QR code.

---

## Game modes

The host selects a game mode before the first round. It determines what a round
does with everyone's answers.

### Ice Breaker

Built for teams of roughly 2 to 20 who want to get to know each other.

1. Everyone ranks the same five cards.
2. Each player is secretly paired with another and guesses how their partner
   ranked the same cards. Pairings rotate each round and avoid repeats. With an
   odd number of players, one group of three forms a guessing cycle.
3. Guesses are scored: three points for an exact position, one point for being
   off by one.
4. A discussion timer runs while the pair compares answers, then the leaderboard
   updates.

### Conference

Built for larger rooms, workshops and conference sessions, where pairing
everyone is impractical and the room's collective view is the point.

1. Everyone ranks the same five cards. There is no pairing and no guessing.
2. The round closes as soon as everyone present has submitted, or when the timer
   expires — whichever comes first. Nobody waits on a dropped connection.
3. All answers are aggregated into the room's collective ranking and shown as
   four dashboards.

Conference mode awards no points and produces no winner. Ranking players by how
closely they match the consensus would reward conformity and discourage exactly
the minority opinions that make the discussion worth having.

#### Conference dashboards

| Panel | Shows |
| --- | --- |
| The Room's Verdict | The collective ranking by mean rank, with a per-card distribution of where votes actually landed, and the card that divided the room most |
| Alignment | How closely each player tracked the room, or the host. Presented as a distribution, not a scoreboard |
| The Contrarians | The players furthest from consensus, each with the single card they diverged on hardest — the discussion prompts |
| Host vs The Room | The host's ranking against the room's, card by card |

Every player also receives a personal version of the same four panels, with the
alignment and comparison panels re-pointed from the room to themselves. A
player's own standing is reported against the room average rather than as an
ordinal rank, for the same reason the mode is unscored.

Alignment is measured with Spearman's rank correlation, rescaled to 0-100.

---

## Card modes

Independent of game mode, the host chooses how the cards read.

- **Normal** — professional definitions.
- **Meme** — irreverent descriptions of the same terms.

---

## Custom card decks

The built-in deck is cybersecurity, but the game itself is subject-agnostic. A
host can upload their own deck in the lobby to run the same exercise for cloud
architecture, AI strategy, product prioritisation, or any other topic where a
team's ranking is worth comparing.

Select **Custom Upload** under Card Deck in the lobby and choose a JSON file. The
deck is validated in the browser and again on the server before it is accepted,
and it applies to every round of that session.

A complete working example ships in this repository:
[`decks/cloud-and-ai.json`](decks/cloud-and-ai.json). The same file is linked
from the upload control in-game, so a host can download it, adapt it, and upload
the result.

### Format

```json
{
  "name": "Cloud and AI",
  "description": "Optional one-line summary of the deck.",
  "cards": [
    {
      "noun": "Shared Responsibility Model",
      "tooltip": "The split between what your cloud provider secures and what you still own.",
      "tooltipMeme": "The contract everyone cites after the incident and nobody reads before it.",
      "category": "Cloud Governance",
      "isSpicy": false
    }
  ]
}
```

| Field | Required | Purpose |
| --- | --- | --- |
| `name` | Yes | Deck name, shown to the host once loaded. Maximum 80 characters |
| `description` | No | Short summary. Maximum 200 characters |
| `cards` | Yes | The card list |
| `cards[].noun` | Yes | The term players rank. Must be unique within the deck. Maximum 60 characters |
| `cards[].tooltip` | Yes | Straight definition, shown in Normal card mode. Maximum 300 characters |
| `cards[].tooltipMeme` | Yes | Irreverent version, shown in Meme card mode. Maximum 300 characters |
| `cards[].category` | Yes | Grouping label, for example "Cloud Governance" |
| `cards[].isSpicy` | No | `true` marks a contested card. Defaults to `false` |

A bare JSON array of cards is also accepted, in which case the filename is used
as the deck name.

### Rules

- At least **4** cards with `isSpicy: false` and **2** with `isSpicy: true`. Each
  round deals four standard and one spicy card, or three and two, so a deck
  thinner than this cannot fill a hand.
- Maximum 100 cards, and a maximum file size of 512 KB.
- Nouns must be unique, compared case-insensitively. Nouns key each round's
  rankings, so a duplicate could be dealt twice into one hand and corrupt that
  round's scoring.
- Every card needs all four text fields populated. `tooltipMeme` is required
  because the host can switch to Meme card mode at any point before kickoff.

Validation reports every problem it finds at once, identified by card number and
noun, rather than stopping at the first.

### Designing a good deck

Include some deliberately contested cards. Rounds where everyone agrees produce
a tidy result and no conversation; the value of the exercise comes from the cards
that split the room. In the built-in deck those are topics like government
backdoors and mass surveillance. In the cloud and AI sample they are questions
such as training on customer data, autonomous agents holding production access,
and how much machine-written code belongs in critical systems.

---

## Presenting to a room

The host can open a separate full-screen window to share on a projector or in a
video call. Before the game starts it loops the how-to-play instructions for the
selected game mode. After a Conference round it displays the results, with each
of the four panels available full-screen plus a combined view. Arrow keys cycle
between them.

---

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, dnd-kit, hosted on Azure Static Web Apps |
| Backend | ASP.NET Core 8 SignalR hub on Azure App Service, VNet integrated |
| Real-time | Azure SignalR Service |
| State | Azure Cosmos DB, reached over a private endpoint using managed identity |
| Telemetry | Application Insights |

Players hold a durable identity independent of their connection, so a refresh or
a brief network drop resumes the same player with their score and submitted
ranking intact. Round completion is measured against connected players only, and
the host role migrates automatically if the host disconnects.

---

## Repository layout

```
backend/
  RankandFile.Core/        Models, services (card generation, pairing, scoring, consensus)
  RankandFile.GameHub/     SignalR hub and application host
frontend/
  components/              Game screens, including conference/ dashboards
  lib/                     Shared client logic (SignalR, identity, instructions)
infra/
  main.bicep               All Azure resources
nouns/                     Built-in cybersecurity card content
decks/                     Sample uploadable decks
```

---

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
`.github/workflows/deploy.yml`, which deploys the Bicep infrastructure, the
backend, and the frontend.

Required repository secrets:

| Secret | Purpose |
| --- | --- |
| `AZURE_CREDENTIALS` | Service principal for deployment |
| `AZURE_SUBSCRIPTION_ID` | Target subscription |
| `AZURE_ENV_NAME` | Environment name, used for resource naming |
| `AZURE_LOCATION` | Azure region |
| `VITE_HUB_URL` | Public URL of the SignalR hub endpoint |

---

## Local development

```bash
cd frontend
npm install
npm run dev
```

The backend requires Cosmos DB, which is reachable only through its private
endpoint, so it cannot be run end to end from a workstation. `frontend/preview.html`
renders the Conference dashboards and the presenter view against mock data for
UI work without a live session.
