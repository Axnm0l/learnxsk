export interface TutorResponse {
  hint: string;
  source: string;
  offline?: boolean;
}

export class GemmaClient {
  private static readonly ENDPOINT = '/api/hint';

  public static async requestHint(query: { prompt?: string; topic?: string; mission?: string }): Promise<TutorResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          hint: data.hint || 'Check your directory using `ls` and navigate with `cd`!',
          source: data.source || 'api',
          offline: data.offline || false
        };
      }
    } catch (e) {
      // Offline fallback
    }

    // Client-side offline fallback
    return {
      hint: 'Tip: You can use `cd /var/backups` followed by `ls` to locate backup files, then `cat token.env` to read the key!',
      source: 'client-offline-fallback',
      offline: true
    };
  }
}
