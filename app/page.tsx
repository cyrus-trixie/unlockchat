import Link from "next/link";

const steps = [
  ["Chat", "Message anyone by username."],
  ["Lock", "Send an image as free or locked."],
  ["Unlock", "Recipients pay $3 to see locked images in full."],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <p className="mb-3 text-sm font-medium text-indigo-400">UnlockChat</p>
      <h1 className="text-4xl font-bold leading-tight">Chat privately. Share images. Unlock the ones worth seeing.</h1>
      <div className="mt-8 flex gap-3">
        <Link href="/signup" className="btn">Sign up</Link>
        <Link href="/login" className="btn-ghost">Log in</Link>
      </div>
      <ol className="mt-12 space-y-4">
        {steps.map(([title, desc], i) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-sm font-semibold text-indigo-300">{i + 1}</span>
            <div><p className="font-semibold">{title}</p><p className="text-sm text-neutral-400">{desc}</p></div>
          </li>
        ))}
      </ol>
    </main>
  );
}
