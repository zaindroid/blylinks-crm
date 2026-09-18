import { MOTIVATIONAL_QUOTES } from './motivationalQuotes';

// Everything about "how do we celebrate this particular sale" lives here as a pure function
// (numbers in, words out) so it can be tested without rendering anything. The component only
// draws what this returns.

const PKT = 'Asia/Karachi';

const pktDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const pktMonth = (d) => pktDay(d).slice(0, 7);

// How many sales this agent has logged today / this month (Pakistan time), not counting rejected ones.
export function countMySales(sales, agentId, now = new Date()) {
  const mine = sales.filter(s => s.agentId === agentId && s.status !== 'Rejected' && s.saleDateIso);
  return {
    today: mine.filter(s => pktDay(s.saleDateIso) === pktDay(now)).length,
    month: mine.filter(s => pktMonth(s.saleDateIso) === pktMonth(now)).length
  };
}

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

// {name} is replaced with the agent's first name, {n} with a count, {campaign} with the campaign name.
const POOLS = {
  goalReachedByThisSale: [
    { headline: 'GOAL SMASHED, {name}! 🎯', message: 'That sale just pushed {campaign} over the monthly goal. The whole team owes you a coffee.' },
    { headline: 'You did it, {name}! 🏆', message: 'Monthly goal reached — and you delivered the deal that crossed the line. Legendary.' },
    { headline: 'Finish line crossed! 🚀', message: '{campaign} just hit its goal, and you were the one who got it there. Take a bow.' }
  ],
  goalAlreadyReached: [
    { headline: 'Over the top, {name}! 🔥', message: '{campaign} already hit the goal and you are still stacking wins. Pure momentum.' },
    { headline: 'Bonus round! ⭐', message: 'The goal is done — everything from here is extra credit, and you are collecting it.' }
  ],
  almostThere: [
    { headline: 'So close, {name}! 🏁', message: 'The goal is right there. A couple more like that and {campaign} is done.' },
    { headline: 'You can smell the finish line! 👃', message: 'Keep this exact energy — {campaign} is within touching distance.' }
  ],
  firstToday: [
    { headline: 'First one on the board, {name}! ☀️', message: 'Nothing beats getting off the mark early. Let the momentum build.' },
    { headline: 'And we are off! 🎬', message: 'Sale number one is in. The best shifts start exactly like this.' },
    { headline: 'Opening bell, rung! 🔔', message: 'You got the day started with a win. Now let us see how far it goes.' }
  ],
  hatTrick: [
    { headline: 'HAT-TRICK, {name}! 🎩', message: 'Three sales today. You are officially in the zone — do not stop now.' }
  ],
  highFive: [
    { headline: 'High five! 🖐️', message: 'Five sales today, {name}. That is not luck, that is skill.' }
  ],
  doubleDigits: [
    { headline: 'DOUBLE DIGITS! 🤯', message: 'Ten sales in a single day. People will be talking about this shift.' }
  ],
  personalReachedByThisSale: [
    { headline: 'TARGET HIT, {name}! 🎯', message: 'That sale takes you to your monthly target. Personal-best energy right there.' },
    { headline: 'You crushed it, {name}! 🏆', message: 'Your monthly target is done — and you closed the deal that got you there.' },
    { headline: 'Mission accomplished! 🚀', message: 'Monthly target reached. Take a moment. You earned it.' }
  ],
  personalAlreadyReached: [
    { headline: 'Beyond your target, {name}! 🔥', message: 'You already hit your monthly target and you are still stacking wins. Pure momentum.' },
    { headline: 'Extra credit! ⭐', message: 'Target done — everything from here is a bonus, and you are collecting it.' }
  ],
  personalAlmostThere: [
    { headline: 'So close, {name}! 🏁', message: 'Your monthly target is right there. A couple more like that and you are done.' },
    { headline: 'Finish line in sight! 👀', message: 'Keep this exact energy — you are almost at your target.' }
  ],
  rockstar: [
    { headline: 'Rockstar move, {name}! 🎸', message: 'That is how it is done. Confident, clean, and closed.' },
    { headline: 'Superstar in action! 🌟', message: 'You make it look easy — and we both know it is not.' },
    { headline: 'Boom! Another one! 💥', message: 'Closed like a champion. Keep that streak alive.' },
    { headline: 'Unstoppable, {name}! ⚡', message: 'The board just felt that one. Go get the next.' },
    { headline: 'Certified closer! 🏅', message: 'Deal locked in. Your future self says thank you.' }
  ]
};

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''));

/**
 * @param {object} input
 * @param {string} input.agentName
 * @param {string} [input.campaignName]
 * @param {number} input.salesToday    this agent's sales logged today, including the one just submitted
 * @param {number} input.salesThisMonth this agent's sales logged this month, including the one just submitted
 * @param {number} [input.goal]        the campaign's monthly sales goal (0/undefined = none set)
 * @param {number} [input.goalProgress] sales the campaign has logged this month, including the one just submitted
 * @param {() => number} [rand]        injectable for tests
 */
export function buildCelebration(input, rand = Math.random) {
  const { agentName = '', campaignName = 'the campaign', salesToday = 1, salesThisMonth = 1, goal = 0, goalProgress = 0, goalKind = 'campaign' } = input;
  const personal = goalKind === 'personal';
  const name = agentName.trim().split(/\s+/)[0] || 'Champ';
  const vars = { name, campaign: campaignName, n: salesToday };

  const hasGoal = goal > 0;
  const remaining = hasGoal ? Math.max(goal - goalProgress, 0) : 0;
  const reached = hasGoal && goalProgress >= goal;
  const justReached = reached && goalProgress - 1 < goal; // the sale just submitted is what crossed it

  let pool;
  if (justReached) pool = personal ? POOLS.personalReachedByThisSale : POOLS.goalReachedByThisSale;
  else if (reached) pool = personal ? POOLS.personalAlreadyReached : POOLS.goalAlreadyReached;
  else if (hasGoal && remaining <= 3) pool = personal ? POOLS.personalAlmostThere : POOLS.almostThere;
  else if (salesToday === 10) pool = POOLS.doubleDigits;
  else if (salesToday === 5) pool = POOLS.highFive;
  else if (salesToday === 3) pool = POOLS.hatTrick;
  else if (salesToday === 1) pool = POOLS.firstToday;
  else pool = POOLS.rockstar;

  const chosen = pick(pool, rand);
  // Once in a while, swap the supporting line for one of the classic quotes so it never gets stale.
  const message = pool === POOLS.rockstar && rand() < 0.4
    ? pick(MOTIVATIONAL_QUOTES, rand)
    : fill(chosen.message, vars);

  let tracker = null;
  if (hasGoal) {
    const pct = Math.min(100, Math.round((goalProgress / goal) * 100));
    // A personal target is "your monthly target"; the campaign's is "this month's goal".
    const noun = personal ? 'your monthly target' : "this month's goal";
    let line;
    if (reached) line = `${personal ? 'Target' : 'Goal'} reached: ${goalProgress} of ${goal} sales this month. Everything from here is a bonus.`;
    else if (remaining === 1) line = `Just 1 more sale to hit ${noun} of ${goal}. You've got this!`;
    else line = `${remaining} more sales to hit ${noun} of ${goal}. You've got this!`;
    tracker = { goal, current: goalProgress, remaining, pct, reached, line, kind: goalKind, title: personal ? 'Monthly sales target progress' : 'Monthly sales goal progress' };
  }

  const stats = [
    { label: 'Today', value: salesToday },
    { label: 'This month', value: salesThisMonth }
  ];

  return {
    headline: fill(chosen.headline, vars),
    message,
    stats,
    tracker,
    // Bigger moments get a bigger show.
    intensity: justReached || salesToday === 10 ? 'epic' : (reached || salesToday === 5 || salesToday === 3 || (hasGoal && remaining <= 3)) ? 'big' : 'normal'
  };
}
