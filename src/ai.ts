import type { Card, SourcePage } from "./core";
type Status = { configured: boolean; model: string };
export type Analysis = {
  cards: Card[];
  coverage: string;
  rejected: number;
  batches: number;
  requests: number;
  model: string;
};
declare global {
  interface Window {
    palaceAI?: {
      status(): Promise<Status>;
      models(): Promise<{ id: string; name: string; context: number }[]>;
      open(name: string): Promise<void>;
      save(value: { key: string; model: string }): Promise<Status>;
      remove(): Promise<boolean>;
      test(): Promise<{ valid: boolean; remaining: number | null }>;
      estimate(pages: SourcePage[]): Promise<{ requests: number }>;
      analyze(request: {
        pages: SourcePage[];
        objective: string;
        target: number;
        consent: boolean;
      }): Promise<Analysis>;
      cancel(): Promise<boolean>;
      onProgress(callback: (message: string) => void): () => void;
    };
  }
}
export function ai() {
  if (!window.palaceAI)
    throw Error(
      "Cloud AI requires the desktop app, where your API key can be encrypted. Use manual passages in the browser preview.",
    );
  return window.palaceAI;
}
