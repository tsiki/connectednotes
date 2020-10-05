import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import {INITIAL_FLASHCARD_LEARNING_DATA, StudyComponent} from './study.component';
import {BehaviorSubject} from 'rxjs';
import {NoteService} from '../note.service';
import {Flashcard} from '../types';

class MockNoteService {
  flashcards: BehaviorSubject<any> = new BehaviorSubject<any>(null);
}

describe('StudyComponent', () => {
  let component: StudyComponent;
  let fixture: ComponentFixture<StudyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NoteService, useClass: MockNoteService }
      ],
      declarations: [ StudyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StudyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();


    // @ts-ignore
    window.Date = class extends Date {
      // @ts-ignore
      constructor() {
        return new Date('2020-01-01');
      }
    };

  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should do stuff', () => {
    const study = TestBed.inject(StudyComponent);
    const fcs: Flashcard[] = [
      {
        id: 'qwe',
        createdEpochMillis: 123,
        lastChangedEpochMillis: 123,
        tags: [],
        side1: 'asd',
        side2: 'asd!',
        isTwoWay: true,
        learningData: INITIAL_FLASHCARD_LEARNING_DATA,
      }
    ];
    study.noteService.flashcards.next(fcs);
    expect(component.dueFcs.length).toBe(1);
  });
});
