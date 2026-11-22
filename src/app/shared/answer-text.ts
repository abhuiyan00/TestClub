import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

/** Plain text to paragraphs and lists: lines starting with "- " become list items. No HTML is ever parsed. */
export function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const last = out.at(-1);
    if (line.startsWith('- ')) {
      if (last?.kind === 'ul') last.items.push(line.slice(2));
      else out.push({ kind: 'ul', items: [line.slice(2)] });
    } else out.push({ kind: 'p', text: line });
  }
  return out;
}

@Component({
  selector: 'tc-answer-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (b of blocks(); track $index) {
      @if (b.kind === 'p') {
        <p>{{ b.text }}</p>
      } @else {
        <ul>
          @for (i of b.items; track $index) {
            <li>{{ i }}</li>
          }
        </ul>
      }
    }
  `,
  styles: `:host { display: grid; gap: var(--sp-2); line-height: 1.6; } ul { display: grid; gap: 4px; } li::marker { color: var(--accent, var(--primary)); }`,
})
export class AnswerText {
  readonly text = input.required<string>();
  protected readonly blocks = computed(() => toBlocks(this.text()));
}
