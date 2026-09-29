// Header navigation model. Plain (not "use client") so the server-rendered header can build it; the
// client NavLinks component renders it.

export type NavLink = { href: string; label: string };
/** A top-level link, or a labelled group shown as a dropdown. */
export type NavItem = NavLink | { label: string; items: NavLink[] };

/** Drops empty groups, and turns a group with one link into that plain link. */
export function navItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (!("items" in item)) return [item];
    if (item.items.length === 0) return [];
    return item.items.length === 1 ? [item.items[0]] : [item];
  });
}
