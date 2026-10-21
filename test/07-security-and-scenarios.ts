/**
 * Regression tests: untrusted inputs, expected pot shares and player-count / street matrix.
 */
import { expect } from 'chai';
import { Card, CardGroup, OddsCalculator, Suit } from '../src/index.js';

const group = (cards: string): CardGroup => CardGroup.fromString(cards);

function scenarioHands(shortDeck: boolean): string[] {
  const ranks: string[] = (shortDeck ? 'AKQJT9876' : 'AKQJT98765432').split('');
  const pairs: string[] = ranks.map((rank: string): string => `${rank}s${rank}h`);
  // Distinct suited connectors and Broadway cards: AKs, QJs, T9s, etc.
  // Together with the pairs this fills a whole valid physical deck.
  const suited: string[] = [];
  for (let i = 0; i + 1 < ranks.length; i += 2) {
    suited.push(`${ranks[i]}c${ranks[i + 1]}c`);
    suited.push(`${ranks[i]}d${ranks[i + 1]}d`);
  }
  if (ranks.length % 2 === 1) {
    const last: string = ranks[ranks.length - 1];
    suited.push(`${last}c${last}d`);
  }
  return pairs.concat(suited);
}

function communityCards(hands: string[]): string[] {
  const used: Set<string> = new Set(hands.flatMap((hand: string): string[] =>
    [hand.substring(0, 2), hand.substring(2, 4)]));
  const result: string[] = [];
  for (const rank of 'AKQJT98765432') {
    for (const suit of 'cdhs') {
      const card: string = rank + suit;
      if (!used.has(card)) result.push(card);
    }
  }
  return result;
}

describe('Security: inputs and bounded simulation', () => {
  const players: CardGroup[] = [group('AsAh'), group('KsKh')];

  it('rejects invalid numerical card construction and malformed card strings', () => {
    expect(() => new Card(0, Suit.CLUB)).to.throw('Invalid card rank or suit');
    expect(() => new Card(Infinity, Suit.CLUB)).to.throw('Invalid card rank or suit');
    expect(() => new Card(14, 0)).to.throw('Invalid card rank or suit');
    expect(() => Card.fromString('Ah<script>')).to.throw();
    expect(() => CardGroup.fromString('Ah<script>')).to.throw('Invalid cards input');
    expect(() => CardGroup.fromString('As\u001b[31m')).to.throw('Invalid cards input');
    expect(group('As, Kh').length).to.equal(2);
  });

  it('requires two players and exactly two cards in each hand', () => {
    expect(() => OddsCalculator.calculate([])).to.throw('Expected 2 to 23 players');
    expect(() => OddsCalculator.calculate([players[0]])).to.throw('Expected 2 to 23 players');
    expect(() => OddsCalculator.calculate([group('As'), players[1]])).to.throw('exactly two');
    expect(() => OddsCalculator.calculate([group('AsAhAd'), players[1]])).to.throw('exactly two');
    expect(() => OddsCalculator.calculate([group('AsAh'), group('AsKc')])).to.throw('duplicate');
  });

  it('rejects invalid board sizes, short deck cards and game variants', () => {
    expect(() => OddsCalculator.calculate(players, group('2c'))).to.throw('The board must contain');
    expect(() => OddsCalculator.calculate(players, group('2c3d'))).to.throw('The board must contain');
    expect(() => OddsCalculator.calculate(players, undefined, 'unknown')).to.throw('Invalid game variant');
    expect(() => OddsCalculator.calculate([group('2c3d'), players[0]], undefined, 'short'))
      .to.throw('Only cards rank 6 through A are valid');
  });

  it('blocks NaN, Infinity, negative, fractional and oversized simulations', () => {
    for (const iterations of [NaN, Infinity, -Infinity, -1, 1.5, 250001]) {
      expect(() => OddsCalculator.calculate(players, undefined, 'full', iterations))
        .to.throw('Iterations must be an integer');
    }
  });

  it('rejects player counts that leave fewer than five board cards', () => {
    const fullHands: CardGroup[] = scenarioHands(false).map(group);
    const shortHands: CardGroup[] = scenarioHands(true).map(group);
    expect(() => OddsCalculator.calculate(fullHands.slice(0, 24), undefined, 'full', 1))
      .to.throw('Expected 2 to 23 players');
    expect(() => OddsCalculator.calculate(shortHands.slice(0, 16), undefined, 'short', 1))
      .to.throw('Expected 2 to 15 players');
  });

  it('splits tied pots by their actual number of winners', () => {
    const board: CardGroup = group('TsJsQsKsAs');
    const result = OddsCalculator.calculate([group('2c3d'), group('4c5d'), group('6c7d')], board);
    expect(result.getIterationCount()).to.equal(1);
    for (const equity of result.equities) {
      expect(equity.getEquity()).to.equal(0);
      expect(equity.getTiePercentage()).to.equal(100);
      expect(equity.getPotEquity()).to.equal(33.33);
    }
  });
});

describe('Known multiway outcomes', () => {
  it('splits a 3-player final pot equally between the two wheel straights', () => {
    const players = [group('AsAh'), group('AcAd'), group('KsKh')];
    const result = OddsCalculator.calculate(players, group('2c3d4h5s9c'));
    expect(result.equities.map((e) => e.getPotEquity())).to.deep.equal([50, 50, 0]);
    expect(result.equities.map((e) => e.getTiePercentage())).to.deep.equal([100, 100, 0]);
  });

  it('reports a completely decided heads-up river accurately', () => {
    const result = OddsCalculator.calculate(
      [group('AsAh'), group('KsKh')], group('2c3d4h9cTd'));
    expect(result.equities.map((e) => e.getPotEquity())).to.deep.equal([100, 0]);
  });
});

describe('Player-count and street coverage (full and short decks)', () => {
  for (const shortDeck of [false, true]) {
    const variant: string = shortDeck ? 'short' : 'full';
    const maxPlayers: number = shortDeck ? 15 : 23;
    it(`checks 2 through ${maxPlayers} players, preflop/flop/turn/river in ${variant}`, () => {
      for (let playerCount = 2; playerCount <= maxPlayers; playerCount += 1) {
        const hands: string[] = scenarioHands(shortDeck).slice(0, playerCount);
        const community: string[] = communityCards(hands)
          .filter((card: string): boolean => !shortDeck || '6789TJQKA'.includes(card[0]));
        const players: CardGroup[] = hands.map(group);
        for (const street of [0, 3, 4, 5]) {
          const board = street === 0 ? undefined : group(community.slice(0, street).join(''));
          const result = OddsCalculator.calculate(players, board, variant, 100);
          const remaining = (shortDeck ? 36 : 52) - 2 * playerCount - street;
          const expected = street === 0 ? 100
            : street === 3 ? (remaining * (remaining - 1)) / 2
              : street === 4 ? remaining : 1;
          expect(result.getIterationCount(), `${variant} ${playerCount} players street ${street}`)
            .to.equal(expected);
          expect(result.equities.length).to.equal(playerCount);
          let potEquityTotal = 0;
          for (const equity of result.equities) {
            expect(equity.getEquity()).to.be.within(0, 100);
            expect(equity.getTiePercentage()).to.be.within(0, 100);
            expect(equity.getPotEquity()).to.be.within(0, 100);
            potEquityTotal += equity.getPotEquity();
          }
          expect(potEquityTotal, `pot equity sum (${variant}, ${playerCount}, ${street})`)
            .to.be.within(99, 101);
        }
      }
    });
  }
});

describe('Popular starting hands (preflop)', () => {
  const cases = [
    { name: 'AA vs KK', hands: ['AsAh', 'KsKh'], favorite: 0 },
    { name: 'AA vs AK suited', hands: ['AdAc', 'AsKs'], favorite: 0 },
    { name: 'QQ vs AK suited', hands: ['QsQh', 'AdKd'], favorite: 0 },
    { name: '77 vs AK offsuit', hands: ['7s7h', 'AcKd'], favorite: 0 },
    { name: 'JT suited vs 22', hands: ['JsTs', '2c2h'], favorite: 1 }
  ];
  for (const { name, hands, favorite } of cases) {
    it(`computes ${name}`, () => {
      const result = OddsCalculator.calculate(hands.map(group), undefined, 'full', 2000);
      expect(result.getIterationCount()).to.equal(2000);
      expect(result.equities[favorite].getPotEquity()).to.be.above(45);
      expect(result.equities.reduce((sum, equity) => sum + equity.getPotEquity(), 0))
        .to.be.within(99, 101);
    });
  }
});
