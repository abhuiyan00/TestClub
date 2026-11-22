import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'tc-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './guide.html',
  styleUrl: './guide.scss',
})
export class Guide {
  protected readonly content = inject(ContentService);
  protected readonly keys: [string, string][] = [
    ['1 – 4 or A – D', 'Answer a multiple-choice question'],
    ['H', 'Show the hint (the answer then counts as helped)'],
    ['G', 'Mark your answer as a guess ("not sure")'],
    ['Space', 'Reveal the options (recall mode) or the model answer'],
    ['1 / 2 / 3', 'Grade an open question: missed, partly, got it'],
    ['Enter or →', 'Next question'],
    ['← →', 'Move between questions in a mock exam'],
    ['/', 'Search from anywhere'],
    ['Esc', 'Close a menu, the course index or a slide'],
  ];
}
