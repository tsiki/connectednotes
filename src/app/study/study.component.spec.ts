import {async, ComponentFixture, flush, TestBed, waitForAsync} from '@angular/core/testing';

import {StudyComponent} from './study.component';
import {FlashcardService} from '../flashcard.service';
import {BehaviorSubject} from 'rxjs';
import {Flashcard} from '../types';
import {FilelistComponent} from '../filelist/filelist.component';
import {By} from '@angular/platform-browser';


describe('StudyComponent', () => {
  let component: StudyComponent;
  let fixture: ComponentFixture<StudyComponent>;
  let flashcardService;

  beforeEach(waitForAsync(() => {
    flashcardService = {
      flashcards: new BehaviorSubject<Flashcard[]>([]),
    };

    TestBed.configureTestingModule({
      declarations: [ StudyComponent ],
      providers: [
        { provide: FlashcardService, useValue: flashcardService },
      ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StudyComponent);
    component = fixture.componentInstance;
  });

  // TODO: finish testing this view
  // it('displays no flashcards after submitting last', () => {
  //   const fc = {
  //     side1: 'visible side',
  //     side2: 'hidden side',
  //     tags: [],
  //     learningData: {
  //       easinessFactor: 1,
  //       numRepetitions: 0,
  //       prevRepetitionIntervalMillis: 0,
  //       prevRepetitionEpochMillis: 0,
  //     }
  //   } as Flashcard;
  //   flashcardService.flashcards.next([ fc ]);
  //   component.submitRating(3, fc);
  //
  //   // fixture.detectChanges();
  //   // flush();
  //
  //   fixture.detectChanges();
  //   flush();
  //
  //   expect(fixture.debugElement.queryAll(By.css('')))
  // });
});
