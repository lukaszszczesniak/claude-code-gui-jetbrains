interface SettingDescriptionProps {
  children: React.ReactNode;
}

export function SettingDescription({ children }: SettingDescriptionProps) {
  return (
    <p className="text-xs text-text-tertiary mt-1">
      {children}
    </p>
  );
}
