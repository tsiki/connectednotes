import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BackreferencesDialogComponent } from './backreferences-dialog.component';

describe('BackreferencesDialogComponent', () => {
  let component: BackreferencesDialogComponent;
  let fixture: ComponentFixture<BackreferencesDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BackreferencesDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BackreferencesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
