// Coalesce incoming updates instead of continuously superseding a slow request.
export function createChatRefresh(load: () => Promise<void>, onError: () => void) {
 let active = true, queued = false;
 let running: Promise<void> | null = null;
 return {
  refresh(): Promise<void> {
   if (!active) return Promise.resolve();
   queued = true;
   if (running) return running;
   running = (async () => {
    while (active && queued) {
     queued = false;
     try { await load(); } catch { if (active) onError(); }
    }
   })().finally(() => { running = null; });
   return running;
  },
  stop() { active = false; queued = false; },
 };
}
