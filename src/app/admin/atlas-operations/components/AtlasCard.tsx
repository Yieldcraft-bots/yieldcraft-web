type AtlasCardProps = {
  title: string;
  children: React.ReactNode;
};

export default function AtlasCard(props: AtlasCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        {props.title}
      </h2>

      <div className="mt-4">{props.children}</div>
    </section>
  );
}