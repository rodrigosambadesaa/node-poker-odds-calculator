/**
 * OddsCalculator
 *
 */
import uniqBy from 'lodash/uniqBy.js';
import random from 'lodash/random.js';
import { Card, Suit } from './Card.js';
import { CardGroup } from './CardGroup.js';
import { FullDeckGame, IGame, ShortDeckGame } from './Game.js';
import { HandRank } from './HandRank.js';

export class HandEquity {
  protected possibleHandsCount: number;
  protected bestHandCount: number;
  protected tieHandCount: number;
  protected splitPotShares: number;

  public constructor() {
    this.possibleHandsCount = 0;
    this.bestHandCount = 0;
    this.tieHandCount = 0;
    this.splitPotShares = 0;
  }

  public addPossibility(isBestHand: boolean, isTie: boolean, tiedPlayers: number = 2): void {
    if (isBestHand && isTie) {
      throw new Error('A result cannot be both a sole win and a tie');
    }
    if (isTie && (!Number.isSafeInteger(tiedPlayers) || tiedPlayers < 2)) {
      throw new Error('Invalid number of tied players');
    }
    this.possibleHandsCount += 1;
    if (isBestHand) {
      this.bestHandCount += 1;
    } else if (isTie) {
      this.tieHandCount += 1;
      this.splitPotShares += 1 / tiedPlayers;
    }
  }

  public getEquity(): number {
    if (this.possibleHandsCount === 0) {
      return 0;
    }
    return Math.round(this.bestHandCount * 100.0 / this.possibleHandsCount);
  }

  /** Percentage of the pot won, including a fractional share of tied pots. */
  public getPotEquity(): number {
    if (this.possibleHandsCount === 0) {
      return 0;
    }
    return Math.round(10000 * (this.bestHandCount + this.splitPotShares) / this.possibleHandsCount) / 100;
  }

  public getTiePercentage(): number {
    if (this.possibleHandsCount === 0) {
      return 0;
    }
    return Math.round(this.tieHandCount * 100.0 / this.possibleHandsCount);
  }

  public toString(): string {
    let s: string = `${this.getEquity()}%`;
    const tie: number = this.getTiePercentage();
    if (tie > 0) {
      s += ` (Tie: ${tie}%)`;
    }
    return s;
  }
}

export class OddsCalculator {
  public static DEFAULT_ITERATIONS: number = 100000;
  public static readonly MAX_ITERATIONS: number = 250000;
  public equities: HandEquity[];
  protected odds: number[];
  protected handranks: HandRank[];
  protected iterations: number;
  protected elapsedTime: number;

  protected constructor(equities: HandEquity[], handranks: HandRank[], iterations: number, elapsedTime: number) {
    this.equities = equities;
    this.handranks = handranks;
    this.iterations = iterations;
    this.elapsedTime = elapsedTime;
  }

  public static calculate(cardgroups: CardGroup[], board?: CardGroup, gameVariant?: string, iterations?: number): OddsCalculator {
    if (gameVariant !== undefined && gameVariant !== 'full' && gameVariant !== 'short') {
      throw new Error('Invalid game variant: expected full or short');
    }
    const deckSize: number = gameVariant === 'short' ? 36 : 52;
    const maxPlayers: number = Math.floor((deckSize - 5) / 2);
    if (!Array.isArray(cardgroups) || cardgroups.length < 2 || cardgroups.length > maxPlayers) {
      throw new Error(`Expected 2 to ${maxPlayers} players`);
    }
    if (cardgroups.some((group: CardGroup) => !Array.isArray(group) || group.length !== 2)) {
      throw new Error('Each player must have exactly two hole cards');
    }
    if (board != null && !Array.isArray(board)) {
      throw new Error('Invalid board');
    }
    if (board && [0, 3, 4, 5].indexOf(board.length) === -1) {
      throw new Error('The board must contain 0, 3, 4 or 5 cards');
    }
    if (iterations != null &&
        (!Number.isSafeInteger(iterations) || iterations < 0 || iterations > OddsCalculator.MAX_ITERATIONS)) {
      throw new Error(`Iterations must be an integer from 0 to ${OddsCalculator.MAX_ITERATIONS}`);
    }

    const allGroups: CardGroup[] = board ? cardgroups.concat(board) : cardgroups;
    let allCards: Card[] = [];
    allGroups.forEach((group: CardGroup) => {
      allCards = allCards.concat(group);
    });
    // Reject forged, malformed or tampered-with card objects before evaluation.
    if (allCards.some((card: Card) => !(card instanceof Card) ||
        !Number.isInteger(card.getRank()) || card.getRank() < 2 || card.getRank() > 14 ||
        !Number.isInteger(card.getSuit()) || !Suit.all().includes(card.getSuit()))) {
      throw new Error('Invalid card');
    }
    // Invalid card values
    if (gameVariant === 'short') {
      allCards.forEach((card: Card) => {
        if (card.getRank() < 6) {
          throw new Error('Only cards rank 6 through A are valid.');
        }
      });
    }
    const uniqCards: Card[] = uniqBy(allCards, (card: Card) => {
      return card.getRank() + '-' + card.getSuit();
    });

    if (uniqCards.length !== allCards.length) {
      throw new Error('Detected duplicate cards');
    }

    iterations = iterations || 0;

    let game: IGame;

    if (gameVariant === 'short') {
      game = new ShortDeckGame();
    } else {
      game = new FullDeckGame();
    }

    let handranks: HandRank[] = [];

    // Find out which cards are left in the deck
    const remainingCards: CardGroup = new CardGroup();
    if (!board || board.length <= 4) {
      for (const suit of Suit.all()) {
        for (const rank of game.rank.all()) {
          const c: Card = new Card(rank, suit);
          let isUsed: boolean = false;

          if (board) {
            for (const boardCard of board) {
              if (c.equals(boardCard)) {
                isUsed = true;
                break;
              }
            }
          }

          if (!isUsed) {
            for (const cardgroup of cardgroups) {
              for (const card of cardgroup) {
                if (c.equals(card)) {
                  isUsed = true;
                  break;
                }
              }
              if (isUsed) {
                break;
              }
            }
          }

          if (!isUsed) {
            remainingCards.push(c);
          }
        }
      }
    }

    const remainingCount: number = remainingCards.length;

    // Figure out hand ranking
    handranks = cardgroups.map((cardgroup: CardGroup): HandRank => {
      return HandRank.evaluate(game, board ? cardgroup.concat(board) : cardgroup);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const equities: HandEquity[] = cardgroups.map((cardgroup: CardGroup): HandEquity => {
      return new HandEquity();
    });

    const selectWinners = (simulatedBoard: CardGroup): void => {
      let highestRanking: HandRank = null;
      let highestRankingIndex: number[] = [];
      for (let i: number = 0; i < cardgroups.length; i += 1) {
        const handranking: HandRank = HandRank.evaluate(
          game,
          cardgroups[i].concat(simulatedBoard)
        );
        const isBetter: number = highestRanking
          ? handranking.compareTo(highestRanking)
          : -1;
        if (highestRanking === null || isBetter >= 0) {
          if (isBetter === 0) {
            highestRankingIndex.push(i);
          } else {
            highestRankingIndex = [i];
          }
          highestRanking = handranking;
        }
      }
      for (let i: number = 0; i < cardgroups.length; i += 1) {
        let isWinning: boolean = false;
        let isTie: boolean = false;

        if (highestRankingIndex.length > 1) {
          isTie = (highestRankingIndex.indexOf(i) > -1);
        } else {
          isWinning = (highestRankingIndex.indexOf(i) > -1);
        }

        equities[i].addPossibility(isWinning, isTie, highestRankingIndex.length);
      }
    };

    const jobStartedAt: number = +new Date();
    if (!board || board.length === 0) {
      iterations = iterations || OddsCalculator.DEFAULT_ITERATIONS;
      if (!Number.isSafeInteger(iterations) || iterations < 1 ||
          iterations > OddsCalculator.MAX_ITERATIONS) {
        throw new Error(`Iterations must be an integer from 1 to ${OddsCalculator.MAX_ITERATIONS}`);
      }

      for (let x: number = iterations; x > 0; x -= 1) {
        const index1: number = random(0, remainingCount - 1);
        let index2: number;
        let index3: number;
        let index4: number;
        let index5: number;

        do {
          index2 = random(0, remainingCount - 1);
        } while (index2 === index1);

        do {
          index3 = random(0, remainingCount - 1);
        } while (index3 === index1 || index3 === index2);

        do {
          index4 = random(0, remainingCount - 1);
        } while (index4 === index1 || index4 === index2 || index4 === index3);

        do {
          index5 = random(0, remainingCount - 1);
        } while (index5 === index1 || index5 === index2 || index5 === index3 || index5 === index4);

        const simulatedBoard: CardGroup = CardGroup.fromCards([
          remainingCards[index1],
          remainingCards[index2],
          remainingCards[index3],
          remainingCards[index4],
          remainingCards[index5]
        ]);

        selectWinners(simulatedBoard);
      }
    } else if (board.length >= 5) {
      iterations = 1;
      selectWinners(board);
    } else if (board.length === 4) {
      for (const c of remainingCards) {
        const simulatedBoard: CardGroup = board.concat(CardGroup.fromCards([c]));
        iterations += 1;
        selectWinners(simulatedBoard);
      }
    } else if (board.length === 3) {
      for (let a: number = 0; a < remainingCount; a += 1) {
        for (let b: number = a + 1; b < remainingCount; b += 1) {
          const simulatedBoard: CardGroup = board.concat(CardGroup.fromCards([remainingCards[a], remainingCards[b]]));
          iterations += 1;
          selectWinners(simulatedBoard);
        }
      }
    }

    const jobEndedAt: number = +new Date();
    return new OddsCalculator(equities, handranks, iterations, jobEndedAt - jobStartedAt);
  }

  public getIterationCount(): number {
    return this.iterations;
  }

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  public getHandRank(index: number): HandRank {
    return this.handranks[index];
  }
}
