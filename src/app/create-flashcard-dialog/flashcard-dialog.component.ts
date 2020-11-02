import {Component, Inject, OnInit, EventEmitter, HostListener, AfterViewInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {NoteService} from '../note.service';
import {Flashcard, FlashcardSuggestion} from '../types';
import {INITIAL_FLASHCARD_LEARNING_DATA} from '../flashcard.service';

@Component({
  selector: 'app-flashcard-dialog',
  template: `
    <div id="wrapper">
      <div id="loading-spinner" *ngIf="submitting">
        <mat-spinner></mat-spinner>
      </div>
      <h1>Create a flashcard</h1>
      <div>
        The final card will consist of the visible side and hidden side. To hide a word from the visible side click on the
        word. The flashcard will be associated with the given tags. To remove a tag, click on it.
      </div>
      <h3>Visible side:</h3>
      <ng-container *ngFor="let word of visibleSentence; let i = index">
        <button class="word" mat-button (click)="toggleWordHiding(i)">{{word}}</button>
        <span>&nbsp;</span>
      </ng-container>
      <h3>Hidden side:</h3>
      <span *ngFor="let word of originalSentence">{{word}} </span>
      <h3>Tags:</h3>
      <div id="tags">
        <mat-chip-list>
          <mat-chip *ngFor="let tag of tags" (click)="toggleIgnoredTag(tag)">
            <span [class.greyed-out]="ignoredTags.has(tag)">{{ tag }}</span>
          </mat-chip>
        </mat-chip-list>
      </div>
      <div>
        <button mat-button (click)="saveAndClose()">save</button>
        <button mat-button (click)="dialogRef.close()">cancel</button>
      </div>
    </div>
  `,
  styles: [`
    #wrapper {
      position: relative;
    }

    .word {
      font-weight: 400;
      min-width: initial;
      line-height: initial;
      padding: initial;
    }

    h3 {
      margin: 10px 0 0 0;
    }

    mat-chip {
      cursor: pointer;
    }

    .greyed-out {
      opacity: 0.3;
    }

    #loading-spinner {
      position: absolute;
      display: flex;
      justify-content: space-around;
      align-items: center;
      width: 100%;
      height: 100%;
      background-color: var(--primary-background-color);
      opacity: 0.5;
      z-index: 10;
    }
  `]
})
export class FlashcardDialogComponent implements OnInit {

  originalSentence: string[];
  visibleSentence: string[];
  hiddenWords: boolean[];
  tags: string[];
  selectNextSuggestion = new EventEmitter();
  suggestions: FlashcardSuggestion[];
  selectedSuggestionIndex: number;
  ignoredTags: Set<string> = new Set();
  submitting = false;

  @HostListener('window:keydown', ['$event'])
  shortcutHandler(e) {
    const ctrlPressed = e.ctrlKey || e.metaKey;
    if (e.key === 'j' && ctrlPressed) {
      this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % this.suggestions.length;
      this.selectionChanged();
    }
  }

  constructor(
      public dialogRef: MatDialogRef<FlashcardDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: any,
      private readonly noteService: NoteService) {
    this.suggestions = data.flashcardSuggestions;
    this.tags = data.tags;
  }

  ngOnInit(): void {
    this.selectedSuggestionIndex = 0;
    this.selectionChanged();
  }

  selectionChanged() {
    const suggestion = this.suggestions[this.selectedSuggestionIndex];
    this.originalSentence = suggestion.text.split(/[\s\n]+/);
    this.hiddenWords = Array(this.originalSentence.length).fill(false);
    this.visibleSentence = this.originalSentence.slice();
    const {start, end} = this.suggestions[this.selectedSuggestionIndex];
    this.selectNextSuggestion.emit({start, end});
  }

  toggleWordHiding(wordIndex: number) {
    if (this.hiddenWords[wordIndex]) {
      this.hiddenWords[wordIndex] = false;
      this.visibleSentence[wordIndex] = this.originalSentence[wordIndex];
    } else {
      this.hiddenWords[wordIndex] = true;
      const len = this.originalSentence[wordIndex].length;
      const allUnderscoresReplacementWord = Array(len).fill('_').join('');
      const replacementArray = this.visibleSentence.slice();
      replacementArray[wordIndex] = allUnderscoresReplacementWord;
      this.visibleSentence = replacementArray;
    }
  }

  toggleIgnoredTag(tag: string) {
    if (this.ignoredTags.has(tag)) {
      this.ignoredTags.delete(tag);
    } else {
      this.ignoredTags.add(tag);
    }
  }

  async saveAndClose() {
    const fc: Flashcard = {
      tags: this.tags.filter(t => !this.ignoredTags.has(t)),
      side1: this.visibleSentence.join(' '),
      side2: this.originalSentence.join(' '),
      isTwoWay: false, // TODO: let user select
      learningData: INITIAL_FLASHCARD_LEARNING_DATA,
    };
    this.submitting = true;
    await this.noteService.createFlashcard(fc);
    this.dialogRef.close();
  }
}
