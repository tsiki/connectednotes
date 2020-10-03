import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FlashcardDialogComponent } from './flashcard-dialog.component';

describe('FlashcardDialogComponent', () => {
  let component: FlashcardDialogComponent;
  let fixture: ComponentFixture<FlashcardDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FlashcardDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlashcardDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
