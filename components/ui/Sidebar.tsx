"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { signOut } from "@/app/actions";

const links = [
  { href: "/chats", label: "Chats", icon: "💬" },
  { href: "/profile", label: "Profile", icon: "👤" },
  { href: "/earnings", label: "Earnings", icon: "💰" },
];

export default function Sidebar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  const pathname = usePathname();
  const item = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-900 hover:text-white"}`;
  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-900 p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <p className="mb-6 px-3 text-lg font-bold">Unlock<span className="text-indigo-400">Chat</span></p>
        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={item(pathname.startsWith(l.href))}><span>{l.icon}</span>{l.label}</Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-3 px-3"><Avatar name={username} url={avatarUrl} size={32} /><span className="truncate text-sm">{username}</span></div>
          <form action={signOut}><button className={item(false) + " w-full"}><span>🚪</span>Logout</button></form>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t border-neutral-900 bg-neutral-950/95 backdrop-blur md:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`flex flex-col items-center text-xs ${pathname.startsWith(l.href) ? "text-white" : "text-neutral-500"}`}>
            <span className="text-lg">{l.icon}</span>{l.label}
          </Link>
        ))}
        <form action={signOut}><button className="flex flex-col items-center text-xs text-neutral-500"><span className="text-lg">🚪</span>Logout</button></form>
      </nav>
    </>
  );
}
