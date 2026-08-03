export const DEFAULT_AVATAR_KEY = 'user-blue';

export const AVATAR_KEYS = [
  'user-blue', 'user-green', 'user-purple', 'user-orange', 'user-pink',
  'engineer', 'manager', 'safety', 'maintenance', 'factory', 'robot', 'developer',
  'cat', 'dog', 'bear', 'fox', 'panda', 'rabbit', 'penguin', 'owl',
  'coffee', 'pizza', 'burger', 'donut', 'ramen', 'cake',
  'sun', 'moon', 'star', 'cloud', 'flower', 'cactus', 'planet',
  'ghost', 'alien', 'ninja', 'pirate', 'wizard', 'superhero', 'gamepad', 'sparkle',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const isAvatarKey = (value: string): value is AvatarKey =>
  (AVATAR_KEYS as readonly string[]).includes(value);
