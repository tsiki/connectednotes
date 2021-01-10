import {discardPeriodicTasks, fakeAsync, TestBed, tick} from '@angular/core/testing';

import {FlashcardService, INITIAL_FLASHCARD_LEARNING_DATA} from './flashcard.service';
import {Flashcard} from './types';
import {BehaviorSubject} from 'rxjs';
import {StudyComponent} from './study/study.component';
import {StorageService} from './storage.service';
import {SettingsService} from './settings.service';



class MockNoteService {
  flashcards: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  saveFlashcard = (fc: Flashcard) => {};
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_PERIODS = [MILLIS_PER_DAY, 6 * MILLIS_PER_DAY];


class MockSettingsService {
  flashcardInitialDelayPeriod = new BehaviorSubject<any>(INITIAL_DELAY_PERIODS);
}

const createFlashcard = (creationTime: number, numRepetitions = 0, prevRepetitionIntervalMillis = 0) => {
  const learningData = Object.assign({}, INITIAL_FLASHCARD_LEARNING_DATA);
  learningData.numRepetitions = numRepetitions;
  learningData.prevRepetitionIntervalMillis = prevRepetitionIntervalMillis;
  return {
    id: 'qwe',
    createdEpochMillis: creationTime,
    lastChangedEpochMillis: creationTime,
    tags: [],
    side1: 'asd',
    side2: 'asd!',
    isTwoWay: true,
    learningData,
  };
};

function waitForFlashcardDebounce() {
  tick(600);
}

describe('FlashcardService', () => {
  let service: FlashcardService;
  let flashcards: BehaviorSubject<Flashcard[]>;
  let storage: StorageService;

  beforeEach(() => {
    storage = new MockNoteService() as StorageService;
    flashcards = storage.flashcards;
    TestBed.configureTestingModule({
      providers: [
        FlashcardService,
        { provide: StorageService, useValue: storage },
        { provide: SettingsService, useClass: MockSettingsService },
      ],
    });
    service = TestBed.inject(FlashcardService);
  });

  it('should be due after initial delay has passed', fakeAsync( () => {
    jasmine.clock().mockDate(new Date(1_000_000_000 + INITIAL_DELAY_PERIODS[0] + 1));
    flashcards.next([ createFlashcard( new Date(1_000_000_000).getTime()) ]);
    waitForFlashcardDebounce();
    expect(service.dueFlashcards.value.length).toBe(1);
  }));

  it("should not be due if first delay hasn't passed", fakeAsync( () => {
    jasmine.clock().mockDate(new Date(1_000_000_000 + INITIAL_DELAY_PERIODS[0] - 1000));
    flashcards.next([ createFlashcard( new Date(1_000_000_000).getTime()) ]);
    waitForFlashcardDebounce();
    expect(service.dueFlashcards.value.length).toBe(0);
  }));

  it('should be due after two initial delays have passed', fakeAsync( () => {
    let fc = createFlashcard( new Date(1_000_000_000).getTime());
    jasmine.clock().mockDate(new Date(1_000_000_000 + INITIAL_DELAY_PERIODS[0] + 1));
    spyOn(storage, 'saveFlashcard');
    const spy = storage.saveFlashcard as jasmine.Spy;

    // Submit 'successfully remembered' rating, take the saved flashcard and re-insert it to the queue
    service.submitFlashcardRating(3, fc);
    fc = spy.calls.mostRecent().args[0];
    tick(INITIAL_DELAY_PERIODS[1] - 1000);
    flashcards.next([ fc ]);

    // Make sure the re-inserted flashcard is displayed at the correct time
    expect(service.dueFlashcards.value.length).toBe(0);
    tick(2000);
    flashcards.next([ fc ]);
    waitForFlashcardDebounce();
    expect(service.dueFlashcards.value.length).toBe(1);
    service.submitFlashcardRating(3, fc);

    // Re-insert it once more to test delay calculation logic. The 3rd period should be at least
    // as long as the 2nd with rating 3 ('successfully remembered')
    fc = spy.calls.mostRecent().args[0];
    tick(INITIAL_DELAY_PERIODS[1] - 1000);
    flashcards.next([ fc ]);
    waitForFlashcardDebounce();
    expect(service.dueFlashcards.value.length).toBe(0);
    discardPeriodicTasks();
  }));

  it("should reset learning and re-enter queue if couldn't remember", fakeAsync( () => {
    const fc = createFlashcard( new Date(1_000_000_000).getTime());
    jasmine.clock().mockDate(new Date(1_000_000_000 + INITIAL_DELAY_PERIODS[0] + 1000));
    flashcards.next([ fc ]);
    waitForFlashcardDebounce();
    service.submitFlashcardRating(0, fc);
    waitForFlashcardDebounce();
    expect(service.dueFlashcards.value.length).toBe(1);
  }));
});
