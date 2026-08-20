export const MOTIVATIONAL_QUOTES = [
  'Great job, Super Star — you are a Hero!',
  "Amazing work, Superman! Don't let Batman catch you.",
  'Boom! Another deal closed like a champion.',
  "That's how legends are made. Keep it up!",
  'Unstoppable! The board just felt that one.',
  "You're on fire today — literally can't be stopped.",
  'Sale locked in! Somewhere, a commission check just smiled.',
  'Certified closer. Take a bow.',
  'Another one in the books! Keep stacking wins.',
  "That's the energy we need. Incredible closing!"
];

export function randomMotivationalQuote() {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
}
