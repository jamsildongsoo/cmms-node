import { getAvatarOption } from '../features/account/avatar-options';

interface Props {
  avatarKey?: string | null;
  size?: number;
  className?: string;
}

export default function UserAvatar({ avatarKey, size = 48, className = '' }: Props) {
  const option = getAvatarOption(avatarKey);
  const Icon = option.icon;

  return (
    <Icon
      size={size}
      className={`${option.color} ${className}`}
      aria-label={option.label}
    />
  );
}
