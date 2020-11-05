import { Injectable } from '@angular/core';
import {sortAscByNumeric} from './utils';
import {Flashcard, FlashcardLearningData} from './types';
import {NoteService} from './note.service';
import {SettingsService} from './settings.service';
import {BehaviorSubject, interval} from 'rxjs';
import {debounce} from 'rxjs/operators';

export const INITIAL_FLASHCARD_LEARNING_DATA: FlashcardLearningData = {
  easinessFactor: 2.5,
  numRepetitions: 0,
  prevRepetitionEpochMillis: 0,
  prevRepetitionIntervalMillis: 0,
};

@Injectable({
  providedIn: 'root'
})
export class FlashcardService {

  flashcards: BehaviorSubject<Flashcard[]>;
  dueFlashcards = new BehaviorSubject<Flashcard[]>([]);
  numDueFlashcards = new BehaviorSubject<number>(0);

  constructor(private readonly noteService: NoteService, private readonly settings: SettingsService) {
    this.flashcards = this.noteService.flashcards;
    // weird pattern, should probably improve this
    const debouncedFcs = this.noteService.flashcards.pipe(debounce(() => interval(500)));
    debouncedFcs.subscribe(unused => {
      this.dueFlashcards.next(this.getDueFlashcards());
      this.numDueFlashcards.next(this.dueFlashcards.value.length);
    });
  }

  // Rating is between 0 and 3 where 0 is total blackout and 3 is total recall
  private static getNewEasinessFactor(previous: number, rating: number) {
    const newEasiness = previous - 0.8 + 0.28 * rating - 0.02 * Math.pow(rating, 2);
    return Math.max(1.3, newEasiness);
  }

  submitFlashcardRating(rating: number, fc: Flashcard) {
    if (rating === 0) {
      fc.learningData = INITIAL_FLASHCARD_LEARNING_DATA;
    } else {
      fc.learningData.easinessFactor = FlashcardService.getNewEasinessFactor(fc.learningData.easinessFactor, rating);
    }
    fc.learningData.prevRepetitionEpochMillis = new Date().getTime();
    return this.noteService.saveFlashcard(fc);
  }

  getDueFlashcards() {
    const fcs = this.flashcards.value;
    const curTime = new Date().getTime();
    const activeFcs = fcs.filter(fc => this.getNextRepetitionTimeEpochMillis(fc) < curTime);
    sortAscByNumeric(activeFcs, fc => fc.learningData.prevRepetitionEpochMillis);
    return activeFcs;
  }

  isDue(fc: Flashcard) {
    const curTime = new Date().getTime();
    return this.getNextRepetitionTimeEpochMillis(fc) < curTime;
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
