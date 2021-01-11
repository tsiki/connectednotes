import { Injectable } from '@angular/core';
import {sortAscByNumeric} from './utils';
import {Flashcard, FlashcardLearningData} from './types';
import {StorageService} from './storage.service';
import {SettingsService} from './settings.service';
import {BehaviorSubject, interval} from 'rxjs';
import {debounce, debounceTime} from 'rxjs/operators';
import {INITIAL_FLASHCARD_LEARNING_DATA} from './constants';

@Injectable({
  providedIn: 'root'
})
export class FlashcardService {

  flashcards = new BehaviorSubject<Flashcard[]>([]);
  dueFlashcards = new BehaviorSubject<Flashcard[]>([]);
  numDueFlashcards = new BehaviorSubject<number>(0);

  constructor(private readonly storage: StorageService, private readonly settings: SettingsService) {
    // weird pattern, should probably improve this
    const debouncedFcs = this.storage.flashcards.pipe(debounceTime(500));
    debouncedFcs.subscribe(fcs => {
      for (const fc of fcs) {
        if (!fc.nextRepetitionEpochMillis) {
          fc.nextRepetitionEpochMillis = this.getNextRepetitionTimeEpochMillis(fc);
        }
      }
      this.flashcards.next(fcs);
      this.dueFlashcards.next(this.getDueFlashcards(fcs));
      this.numDueFlashcards.next(this.dueFlashcards.value.length);
    });
  }

  // Rating is between 0 and 3 where 0 is total blackout and 3 is total recall
  private static getNewEasinessFactor(previous: number, rating: number) {
    const newEasiness = previous - 0.8 + 0.28 * rating - 0.02 * Math.pow(rating, 2);
    return Math.max(1.3, newEasiness);
  }

  deleteFlashcard(id: string) {
    this.storage.deleteFlashcard(id);
  }

  submitFlashcardRating(rating: number, fc: Flashcard) {
    const newLearningData = Object.assign({}, INITIAL_FLASHCARD_LEARNING_DATA);
    if (rating !== 0) {
      newLearningData.easinessFactor = FlashcardService.getNewEasinessFactor(fc.learningData.easinessFactor, rating);
      newLearningData.prevRepetitionIntervalMillis = new Date().getTime() - fc.learningData.prevRepetitionEpochMillis;
      newLearningData.prevRepetitionEpochMillis = new Date().getTime();
      newLearningData.numRepetitions = fc.learningData.numRepetitions + 1;
    }
    fc.learningData = newLearningData;
    fc.nextRepetitionEpochMillis = this.getNextRepetitionTimeEpochMillis(fc);
    return this.storage.saveFlashcard(fc);
  }

  isDue(fc: Flashcard) {
    const curTime = new Date().getTime();
    return this.getNextRepetitionTimeEpochMillis(fc) < curTime;
  }

  private getDueFlashcards(fcs: Flashcard[]) {
    const curTime = new Date().getTime();
    const activeFcs = fcs.filter(fc => curTime >= this.getNextRepetitionTimeEpochMillis(fc));
    sortAscByNumeric(activeFcs, fc => fc.learningData.prevRepetitionEpochMillis);
    return activeFcs;
  }

  private getNextRepetitionTimeEpochMillis(fc: Flashcard): number {
    const prevRepetitionIntervalMillis = fc.learningData.prevRepetitionIntervalMillis || 0;
    const prevRepetitionEpochMillis = fc.learningData.prevRepetitionEpochMillis || fc.createdEpochMillis;
    const {numRepetitions, easinessFactor} = fc.learningData;
    if (numRepetitions < this.settings.flashcardInitialDelayPeriod.value.length) {
      return prevRepetitionEpochMillis + this.settings.flashcardInitialDelayPeriod.value[numRepetitions];
    }
    const nextInterval = prevRepetitionIntervalMillis * easinessFactor;
    return prevRepetitionEpochMillis + nextInterval;
  }
}
