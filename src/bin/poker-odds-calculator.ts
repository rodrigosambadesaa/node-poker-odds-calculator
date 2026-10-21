#!/usr/bin/env node
/**
 * Odds Calculator CLI
 */
/* eslint-disable */
import chalk from "chalk";
import { Command } from "commander";
import { CardGroup, OddsCalculator } from "../index.js";

const program = new Command();
program
  .option('-b, --board <cards>', 'sets the board')
  .option('-g, --game <game variant name>', 'sets the game variant for calculation. options: full, short.', 'full')
  .option('-i, --iterations <count>', 'pre-flop Monte Carlo iterations (1-250000)')
  .argument('<hand...>', 'players hands')
  .parse(process.argv);

const opts = program.opts<{ game: string; board?: string; iterations?: string }>();
const hands: string[] = program.args;

function printHeader() {
  console.log(
    chalk.bold.magentaBright("\n♠️♥️ Poker Odds Calculator ♣️♦️\n")
  );
}

function suitToEmoji(card: string) {
  return card
    .replace(/h/g, "♥️")
    .replace(/d/g, "♦️")
    .replace(/s/g, "♠️")
    .replace(/c/g, "♣️");
}

try {
  printHeader();
  const gameVariant: string = opts.game;
  if (gameVariant !== "short" && gameVariant !== "full") {
    program.outputHelp();
    throw Error(`❌ Invalid game variant: ${gameVariant}`);
  }

  const board: CardGroup | null = opts.board
    ? CardGroup.fromString(opts.board)
    : null;
  const cardgroups: CardGroup[] = [];

  for (const hand of hands) {
    cardgroups.push(CardGroup.fromString(hand));
  }

  if (cardgroups.length <= 1) {
    throw new Error("❌ You must enter at least 2 hands");
  }

  const result: OddsCalculator = OddsCalculator.calculate(
    cardgroups,
    board,
    gameVariant,
    opts.iterations === undefined ? undefined : Number(opts.iterations)
  );
  const prepend: string = board !== null ? "" : "~";

  if (board) {
    console.log(
      chalk.yellowBright.bold(
        "Board: " + suitToEmoji(board.toString().replace(/ /g, "  "))
      )
    );
    console.log("");
  }

  // Find winners for gold coloring 🥇
  let mostEquityIndex: number[] = [];
  let mostEquity: number = 0;
  for (let i: number = 0; i < cardgroups.length; i += 1) {
    const curEquity: number =
      result.equities[i].getEquity() + result.equities[i].getTiePercentage();
    if (curEquity >= mostEquity) {
      if (curEquity > mostEquity) {
        mostEquityIndex = [i];
      } else {
        mostEquityIndex.push(i);
      }
      mostEquity = curEquity;
    }
  }

  for (let i: number = 0; i < cardgroups.length; i += 1) {
    const s = `Player #${i + 1}  ${mostEquityIndex.includes(i) ? "🥇" : "  "}  `
      + chalk.cyanBright(suitToEmoji(cardgroups[i].toString().replace(/ /g, "  ")))
      + "  "
      + prepend + result.equities[i];

    if (mostEquityIndex.includes(i)) {
      console.log(chalk.bold.greenBright(s));
    } else {
      console.log(chalk.redBright(s));
    }
  }

  if (board === null || board.length <= 3) {
    console.log("");
    console.log(
      chalk.gray(
        `⏱️  Simulated ${result.getIterationCount().toLocaleString()} random boards in ${(result.getElapsedTime() / 1000).toFixed(1)} seconds`
      )
    );
  }
  console.log();
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(chalk.redBright(`❌ ${message}`));
  process.exitCode = 1;
}