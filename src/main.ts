// Apartment Parser
// Developed by Yaroslav Volkivskyi (TheLaidSon)

// Actual v1.0

// Main File

import arch from "./base/architecture";
import Parser from "./data/steps/ScheduleParser";
import Start from "./data/steps/Start";
import TBC from "./data/steps/ToBeContinued";

async function main() {
  const [ onTextMessage, bot, db, mongodb ] = await arch();

  await Start(bot, db);

  await TBC(onTextMessage, db);

  Parser(bot.telegram, mongodb);

  bot.launch();
}

main();