import {Component, OnDestroy, OnInit} from '@angular/core';
import {NoteService} from '../note.service';
import {Flashcard, FlashcardLearningData} from '../types';
import {sortAscByNumeric, sortDescByNumeric} from '../utils';
import {Subscription} from 'rxjs';
import {SettingsService} from '../settings.service';

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export const INITIAL_FLASHCARD_LEARNING_DATA: FlashcardLearningData = {
  easinessFactor: 2.5,
  numRepetitions: 0,
  prevRepetitionEpochMillis: 0,
  prevRepetitionIntervalMillis: 0,
};

@Component({
  selector: 'app-study',
  template: `
    <div *ngIf="allFcs.length === 0">You haven't created any flashcards.</div>
    <div *ngIf="allFcs.length > 0 && dueFcs.length === 0">
      No flashcards are due.
    </div>
    <div id="due-fcs-container" *ngIf="dueFcs.length > 0">
      <div class="fc-side">{{displayedFc.side1}}</div>
      <button mat-button *ngIf="!revealed" (click)="reveal()">show answer</button>
      <ng-container *ngIf="revealed">
        <div id="rating-container">
          <button mat-button (click)="submitRating(0, displayedFc)">No idea</button>
          <button mat-button (click)="submitRating(1, displayedFc)">Hard</button>
          <button mat-button (click)="submitRating(2, displayedFc)">Moderate</button>
          <button mat-button (click)="submitRating(3, displayedFc)">Easy</button>
        </div>
        <div class="fc-side">{{displayedFc.side2}}</div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: space-around;
      margin-top: 20px;
    }

    #due-fcs-container {
      display: flex;
      flex-direction: column;
      max-width: 350px;
      min-height: 500px;
    }

    #rating-container {
      display: flex;
      justify-content: space-between;
    }

    #rating-container > button {
      flex-grow: 1;
    }
  `]
})
export class StudyComponent implements OnInit, OnDestroy {

  tagsToFcs: Map<string, Flashcard[]>;
  tagsAndFcs: [string, Flashcard[]][];
  allFcs: Flashcard[];
  dueFcs: Flashcard[];
  displayedFc?: Flashcard;
  revealed: boolean;

  private sub: Subscription;

  constructor(readonly noteService: NoteService, private readonly settings: SettingsService) {
    this.sub = this.noteService.flashcards.subscribe(fcs => {
      if (!fcs) {
        return;
      }
      this.allFcs = fcs;
      this.dueFcs = this.getDueFlashcards(fcs);
      const tagsToFlashcards = new Map<string, Flashcard[]>();
      for (const fc of fcs) {
        for (const tag of fc.tags) {
          if (!tagsToFlashcards.has(tag)) {
            tagsToFlashcards.set(tag, []);
          }
          tagsToFlashcards.get(tag).push(fc);
        }
      }
      const tagsAndFcs = Array.from(tagsToFlashcards.entries());
      sortDescByNumeric(tagsAndFcs, t => t[1].length);
      this.tagsAndFcs = tagsAndFcs;
      this.tagsToFcs = tagsToFlashcards;

      this.dueFcs = this.getDueFlashcards(fcs);
      // Present first note automatically
      this.displayedFc = this.dueFcs[0];
    });
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  reveal() {
    this.revealed = true;
  }

  submitRating(rating: number, fc: Flashcard) {
    if (rating === 0) {
      fc.learningData = INITIAL_FLASHCARD_LEARNING_DATA;
    } else {
      fc.learningData.easinessFactor = StudyComponent.getNewEasinessFactor(fc.learningData.easinessFactor, rating);
    }
    this.noteService.saveFlashcard(fc);
    this.dueFcs = this.dueFcs.slice(1);
    if (this.dueFcs.length > 0) {
      this.displayedFc = this.dueFcs[0];
    }
  }

  // Return flashcards that should be repeated, oldest one first.
  private getDueFlashcards(fcs: Flashcard[]) {
    const curTime = new Date().getTime();
    const activeFcs = fcs.filter(fc => this.getNextRepetitionTimeEpochMillis(fc) < curTime);
    sortAscByNumeric(activeFcs, fc => fc.learningData.prevRepetitionEpochMillis);
    return activeFcs;
  }

  // Rating is between 0 and 3 where 0 is total blackout and 3 is total recall
  private static getNewEasinessFactor(previous: number, rating: number) {
    const newEasiness = previous - 0.8 + 0.28 * rating - 0.02 * Math.pow(rating, 2);
    return Math.max(1.3, newEasiness);
  }

  private getNextRepetitionTimeEpochMillis(fc: Flashcard): number {
    const prevRepetitionIntervalMillis = fc.learningData.prevRepetitionIntervalMillis || fc.createdEpochMillis;
    const prevRepetitionEpochMillis = fc.learningData.prevRepetitionEpochMillis || fc.createdEpochMillis;
    const {numRepetitions, easinessFactor} = fc.learningData;
    if (numRepetitions < this.settings.flashcardInitialDelayPeriod.value.length) {
      return prevRepetitionEpochMillis + this.settings.flashcardInitialDelayPeriod.value[numRepetitions];
    }

    const nextInterval = prevRepetitionIntervalMillis * easinessFactor;
    return prevRepetitionEpochMillis + nextInterval;
  }
}
