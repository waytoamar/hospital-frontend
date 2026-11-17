import { Component, EventEmitter, Input, Output, booleanAttribute } from '@angular/core';

const MAX_SUGGESTIONS = 8;

/**
 * Text box (or text area) that offers values typed before.
 * Use with two-way binding: <app-suggest-field [(value)]="form.symptoms" [options]="pastSymptoms" />
 */
@Component({
  selector: 'app-suggest-field',
  standalone: true,
  templateUrl: './suggest-field.html',
  styleUrl: './suggest-field.css',
})
export class SuggestField {
  @Input() value = '';
  @Input() options: string[] = [];
  @Input() placeholder = '';
  @Input() label = '';
  @Input({ transform: booleanAttribute }) multiline = false;
  @Input() rows = 3;
  /** Tab key takes the first suggestion. */
  @Input({ transform: booleanAttribute }) acceptOnTab = false;

  @Output() valueChange = new EventEmitter<string>();
  /** A suggestion was clicked (typing does not fire this). */
  @Output() picked = new EventEmitter<string>();

  open = false;

  get matches(): string[] {
    const query = (this.value || '').trim().toLowerCase();
    return this.options
      .filter((option) => !query || option.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }

  type(text: string): void {
    this.value = text;
    this.valueChange.emit(text);
  }

  pick(option: string): void {
    this.type(option);
    this.picked.emit(option);
    this.open = false;
  }

  onTab(event: Event): void {
    const first = this.matches[0];
    if (this.acceptOnTab && first) {
      event.preventDefault();
      this.pick(first);
    }
  }
}
