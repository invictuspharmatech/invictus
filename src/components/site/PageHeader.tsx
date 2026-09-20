export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-16 text-center sm:px-6">
      {kicker ? (
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          {kicker}
        </p>
      ) : null}
      <h1 className="display-font mt-3 text-4xl font-semibold sm:text-5xl">{title}</h1>
      {lede ? (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {lede}
        </p>
      ) : null}
    </div>
  );
}
