interface SidebarFooterProps {
  user: { login: string; avatarUrl?: string } | null;
  onOpenSettings: () => void;
}

export function SidebarFooter({ user, onOpenSettings }: SidebarFooterProps) {
  return (
    <div className="p-2 border-t border-border/50">
      <button
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
        onClick={onOpenSettings}
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.login} className="w-6 h-6 rounded-full" />
        ) : (
          <UserIcon className="w-6 h-6" />
        )}
        <span className="text-[0.8125rem] text-muted-foreground truncate flex-1 text-left">
          {user?.login || 'Settings'}
        </span>
      </button>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}
