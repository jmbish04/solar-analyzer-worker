// Env type extensions for secrets (set via `wrangler secret put`)
// These augment the generated worker-configuration.d.ts

declare global {
  interface Env {
    // Secrets - set via `wrangler secret put OPENAI_API_KEY`
    OPENAI_API_KEY?: string;
    ADMIN_PASSWORD?: string;
    JWT_SECRET?: string;
  }
}

export {};
