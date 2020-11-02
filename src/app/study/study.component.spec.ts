import {async, ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {INITIAL_FLASHCARD_LEARNING_DATA, StudyComponent} from './study.component';
import {BehaviorSubject} from 'rxjs';
import {NoteService} from '../note.service';
import {Flashcard} from '../types';
import {SettingsService} from '../settings.service';

class MockNoteService {
  flashcards: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  saveFlashcard = (fc: Flashcard) => {};
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

class MockSettingsService {
  flashcardInitialDelayPeriod = new BehaviorSubject<any>([MILLIS_PER_DAY, 6 * MILLIS_PER_DAY]);
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

fdescribe('StudyComponent', () => {
  let component: ComponentFixture<StudyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      providers: [
        StudyComponent,
        { provide: NoteService, useClass: MockNoteService },
        { provide: SettingsService, useClass: MockSettingsService },
      ],
      declarations: [ StudyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    component = TestBed.createComponent(StudyComponent);
  });

  it('should display due flashcards', async () => {
    const fcCreationTime = new Date(1_000_000_000);
    const nowTime = new Date(2_000_000_000);
    jasmine.clock().mockDate(nowTime);

    const fcs: Flashcard[] = [
      createFlashcard(fcCreationTime.getTime())
    ];
    component.componentInstance.noteService.flashcards.next(fcs);

    component.detectChanges();
    await component.whenStable();
    expect(component.componentInstance.dueFcsQueue.length).toBe(1);
  });

  it("should't display flashcards not due yet", async () => {
    const fcCreationTime = new Date(1_000_000_000);
    const nowTime = new Date(1_000_000_007);
    jasmine.clock().mockDate(nowTime);

    const fcs: Flashcard[] = [
      createFlashcard(fcCreationTime.getTime())
    ];
    component.componentInstance.noteService.flashcards.next(fcs);

    await component.whenStable();
    expect(component.componentInstance.dueFcsQueue.length).toBe(0);
  });

  it('should extend time if flashcard user is successful', async () => {
    const fcCreationTime = new Date(1_000_000_000);
    const nowTime = new Date(2_000_000_000);
    jasmine.clock().mockDate(nowTime);
    const prevRepetitionInterval = 100;
    const fcs: Flashcard[] = [ createFlashcard(fcCreationTime.getTime(), 2, prevRepetitionInterval) ];
    component.componentInstance.noteService.flashcards.next(fcs);
    await component.whenStable();
    component.detectChanges();
    const fc = component.componentInstance.dueFcsQueue[0];

    spyOn(component.componentInstance.noteService, 'saveFlashcard').and.callFake(async arg => {
      expect((component.componentInstance as any).getNextRepetitionTimeEpochMillis(arg))
          .toBeGreaterThan(prevRepetitionInterval);
    });
    component.componentInstance.submitRating(3, fc);
  });
});
