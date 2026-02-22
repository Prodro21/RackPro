export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8px] font-bold text-text-label tracking-[.12em] mb-[5px] mt-2">
      {children}
    </div>
  );
}
