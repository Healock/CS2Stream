export function parseDouyuEventTitle(title: string): string | undefined {
  const firstPart = title.split("_", 1)[0]?.trim();
  return firstPart ? firstPart : undefined;
}
