import { readFileSync } from 'node:fs';
import type { Exercise } from '../core/model.js';
import type { Catalog } from '../core/ports.js';
export class JsonCatalog implements Catalog {
  readonly exercises: Exercise[];
  constructor() {
    const value: unknown = JSON.parse(readFileSync(new URL('./exercises.json', import.meta.url), 'utf8'));
    if (!Array.isArray(value) || !value.length) throw new Error('The exercise catalog is empty.');
    this.exercises = value.map((e: Exercise) => {
      if (!e.id || !e.name || !e.bodyPart || e.durationSeconds !== 60 || !Array.isArray(e.instructions) || !e.instructions.length || !e.source?.url)
        throw new Error('Invalid exercise catalog entry.');
      return e;
    });
  }
  select(previousId?: string) {
    const eligible = this.exercises.filter(e => e.id !== previousId);
    const list = eligible.length ? eligible : this.exercises;
    return list[Math.floor(Math.random() * list.length)]!;
  }
}
