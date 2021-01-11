import {async, ComponentFixture, fakeAsync, flush, TestBed, waitForAsync} from '@angular/core/testing';

import {ALL_FCS_QUEUE_NAME, DUE_FCS_QUEUE_NAME, StudyComponent} from './study.component';
import {FlashcardService, INITIAL_FLASHCARD_LEARNING_DATA} from '../flashcard.service';
import {BehaviorSubject} from 'rxjs';
import {Flashcard} from '../types';
import {By} from '@angular/platform-browser';
import {SubviewManagerService} from '../subview-manager.service';
import {MatDialogModule} from '@angular/material/dialog';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';

fdescribe('StudyComponent', () => {
  let component: StudyComponent;
  let fixture: ComponentFixture<StudyComponent>;
  let flashcardService;
  let subviewManager;

  beforeEach(waitForAsync(() => {
    flashcardService = {
      flashcards: new BehaviorSubject<Flashcard[]>([]),
      submitFlashcardRating: () => {},
      isDue: () => true,
    };

    subviewManager = {
      closeView: () => {},
    };

    TestBed.configureTestingModule({
      declarations: [ StudyComponent ],
      imports: [
        MatDialogModule,
        MatSelectModule,
        MatFormFieldModule,
        NoopAnimationsModule,
        MatIconModule,
        MatMenuModule,
      ],
      providers: [
        { provide: FlashcardService, useValue: flashcardService },
        { provide: SubviewManagerService, useValue: subviewManager },
      ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StudyComponent);
    component = fixture.componentInstance;
  });

  // test cases:
  // remove: if FC is in two queues we might mess up here, it needs to be removed from both
  // that FCs end up in 'all FCs' and/or 'due FCs' queue

  it("receive one flashcard, submit rating, ensure it's not shown again", fakeAsync(() => {
    const fc = {
      side1: 'visible side',
      side2: 'hidden side',
      tags: [],
      learningData: INITIAL_FLASHCARD_LEARNING_DATA
    } as Flashcard;

    const spy = spyOn(flashcardService, 'submitFlashcardRating');
    fixture.detectChanges();
    flashcardService.flashcards.next([ fc ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedFc).toBeTruthy();
    expect(fixture.componentInstance.front.nativeElement.innerHTML).toContain('visible side');
    expect(fixture.componentInstance.back.nativeElement.innerHTML).toContain('hidden side');
    const revealButton = fixture.debugElement.queryAll(
        By.css('#show-answer-button'))[0].nativeElement as HTMLButtonElement;
    revealButton.click();
    fixture.detectChanges();
    const remeberingWasEasyButton = fixture.debugElement.queryAll(
        By.css('#rating-container > button'))[0].nativeElement as HTMLButtonElement;
    remeberingWasEasyButton.click();
    fixture.detectChanges();
    expect(spy.calls.mostRecent().args).toEqual([3, fc]);
    flashcardService.isDue = f => false;
    flashcardService.flashcards.next([fc]);
    fixture.detectChanges();
    flush();
    expect(fixture.componentInstance.displayedFc).toBeFalsy();
    expect(fixture.debugElement.query(By.css('#fc-container')).nativeElement.innerHTML)
        .toContain('All done');
  }));

  it('displays queue for each tag in flashcard', fakeAsync(() => {
    const fc1 = {
      side1: 'visible side',
      side2: 'hidden side',
      tags: ['#tag1', '#tag2'],
      learningData: INITIAL_FLASHCARD_LEARNING_DATA
    } as Flashcard;
    const fc2 = {
      side1: 'visible side',
      side2: 'hidden side',
      tags: ['#tag2', '#tag3'],
      learningData: INITIAL_FLASHCARD_LEARNING_DATA
    } as Flashcard;

    fixture.detectChanges();
    flashcardService.flashcards.next([ fc1, fc2 ]);
    fixture.detectChanges();
    const queues = fixture.componentInstance.fcQueues.map(t => t[0]);
    expect(queues).toEqual(
        jasmine.arrayContaining(
            [DUE_FCS_QUEUE_NAME, ALL_FCS_QUEUE_NAME, '#tag1', '#tag2', '#tag3']));
    expect(fixture.componentInstance.dueFcQueues.get(ALL_FCS_QUEUE_NAME).length).toBe(2);
  }));
});
