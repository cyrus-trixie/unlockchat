/* eslint-disable @next/next/no-img-element */
export default function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const style = { width: size, height: size };
  return url ? (
    <img src={url} alt={name} style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <div style={style} className="flex shrink-0 items-center justify-center rounded-full bg-indigo-600/30 text-sm font-semibold uppercase text-indigo-200">
      {name.slice(0, 1)}
    </div>
  );
}
