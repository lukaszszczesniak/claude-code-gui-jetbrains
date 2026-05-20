import {ReactNode} from "react";

interface SettingSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-[0.9230rem] font-semibold text-text-tertiary uppercase tracking-wider mb-4">
        {title}
      </h2>
      {description && (typeof description === 'string' ? (
        <p className="text-[0.8461rem] font-normal text-text-tertiary -mt-2 mb-3">{description}</p>
      ) : description)}
      <div className="bg-surface-raised rounded-lg border border-border-default px-4">
        {children}
      </div>
    </section>
  );
}
