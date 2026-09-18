import { redirect } from "next/navigation";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export async function redirectWithQuery(
  pathname: string,
  searchParams: Promise<SearchParams>,
) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
      continue;
    }

    query.set(key, value);
  }

  const qs = query.toString();
  redirect(qs ? `${pathname}?${qs}` : pathname);
}
