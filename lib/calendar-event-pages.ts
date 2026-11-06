// Read all RLS-filtered pages; never replace a loaded calendar with partial data.
export async function readCalendarPages<T>(readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
 const rows: T[] = [];
 for (let from = 0; ; from += 500) {
  const result = await readPage(from, from + 499);
  if (result.error) return { data: null, error: result.error };
  rows.push(...(result.data ?? []));
  if ((result.data ?? []).length < 500) return { data: rows, error: null };
 }
}
