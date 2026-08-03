import {
  BadgeHelp, Bird, Bot, Bug, CakeSlice, Cat, CircleUserRound, Cloud,
  Coffee, Crown, Dog, Factory, Flower2, Gamepad2, Ghost, HardHat,
  Moon, Mountain, Palette, Panda, Pizza, Rabbit, Rocket, ShieldCheck,
  ShoppingBag, Sparkles, Star, Sun, Swords, TreePine, UserRound, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AvatarCategory = '전체' | '기본' | '업무' | '동물' | '음식' | '자연' | '재미';

export interface AvatarOption {
  key: string;
  label: string;
  category: AvatarCategory;
  icon: LucideIcon;
  color: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { key: 'user-blue', label: '파랑 사람', category: '기본', icon: UserRound, color: 'text-blue-400' },
  { key: 'user-green', label: '초록 사람', category: '기본', icon: CircleUserRound, color: 'text-emerald-400' },
  { key: 'user-purple', label: '보라 사람', category: '기본', icon: UserRound, color: 'text-purple-400' },
  { key: 'user-orange', label: '주황 사람', category: '기본', icon: UserRound, color: 'text-orange-400' },
  { key: 'user-pink', label: '분홍 사람', category: '기본', icon: UserRound, color: 'text-pink-400' },
  { key: 'engineer', label: '엔지니어', category: '업무', icon: HardHat, color: 'text-amber-400' },
  { key: 'manager', label: '관리자', category: '업무', icon: ShoppingBag, color: 'text-blue-400' },
  { key: 'safety', label: '안전 담당', category: '업무', icon: ShieldCheck, color: 'text-rose-400' },
  { key: 'maintenance', label: '정비 담당', category: '업무', icon: Wrench, color: 'text-slate-300' },
  { key: 'factory', label: '공장', category: '업무', icon: Factory, color: 'text-cyan-400' },
  { key: 'robot', label: '로봇', category: '업무', icon: Bot, color: 'text-violet-400' },
  { key: 'developer', label: '개발자', category: '업무', icon: Palette, color: 'text-fuchsia-400' },
  { key: 'cat', label: '고양이', category: '동물', icon: Cat, color: 'text-orange-300' },
  { key: 'dog', label: '강아지', category: '동물', icon: Dog, color: 'text-amber-300' },
  { key: 'bear', label: '곰', category: '동물', icon: Panda, color: 'text-stone-300' },
  { key: 'fox', label: '여우', category: '동물', icon: Rabbit, color: 'text-orange-400' },
  { key: 'panda', label: '판다', category: '동물', icon: Panda, color: 'text-slate-200' },
  { key: 'rabbit', label: '토끼', category: '동물', icon: Rabbit, color: 'text-pink-300' },
  { key: 'penguin', label: '펭귄', category: '동물', icon: Bird, color: 'text-sky-300' },
  { key: 'owl', label: '부엉이', category: '동물', icon: Bird, color: 'text-yellow-300' },
  { key: 'coffee', label: '커피', category: '음식', icon: Coffee, color: 'text-amber-300' },
  { key: 'pizza', label: '피자', category: '음식', icon: Pizza, color: 'text-red-400' },
  { key: 'burger', label: '버거', category: '음식', icon: ShoppingBag, color: 'text-yellow-400' },
  { key: 'donut', label: '도넛', category: '음식', icon: CircleUserRound, color: 'text-pink-400' },
  { key: 'ramen', label: '라면', category: '음식', icon: Coffee, color: 'text-orange-400' },
  { key: 'cake', label: '케이크', category: '음식', icon: CakeSlice, color: 'text-fuchsia-300' },
  { key: 'sun', label: '태양', category: '자연', icon: Sun, color: 'text-yellow-300' },
  { key: 'moon', label: '달', category: '자연', icon: Moon, color: 'text-indigo-300' },
  { key: 'star', label: '별', category: '자연', icon: Star, color: 'text-yellow-300' },
  { key: 'cloud', label: '구름', category: '자연', icon: Cloud, color: 'text-sky-300' },
  { key: 'flower', label: '꽃', category: '자연', icon: Flower2, color: 'text-pink-400' },
  { key: 'cactus', label: '선인장', category: '자연', icon: TreePine, color: 'text-emerald-400' },
  { key: 'planet', label: '행성', category: '자연', icon: Mountain, color: 'text-violet-400' },
  { key: 'ghost', label: '유령', category: '재미', icon: Ghost, color: 'text-slate-200' },
  { key: 'alien', label: '외계인', category: '재미', icon: Bug, color: 'text-lime-400' },
  { key: 'ninja', label: '닌자', category: '재미', icon: Swords, color: 'text-red-400' },
  { key: 'pirate', label: '모험가', category: '재미', icon: Rocket, color: 'text-orange-400' },
  { key: 'wizard', label: '마법사', category: '재미', icon: BadgeHelp, color: 'text-purple-400' },
  { key: 'superhero', label: '히어로', category: '재미', icon: Crown, color: 'text-yellow-400' },
  { key: 'gamepad', label: '게이머', category: '재미', icon: Gamepad2, color: 'text-cyan-400' },
  { key: 'sparkle', label: '반짝이', category: '재미', icon: Sparkles, color: 'text-pink-300' },
];

export const AVATAR_CATEGORIES: AvatarCategory[] = ['전체', '기본', '업무', '동물', '음식', '자연', '재미'];

export const getAvatarOption = (key?: string | null): AvatarOption =>
  AVATAR_OPTIONS.find((option) => option.key === key) ?? AVATAR_OPTIONS[0];
