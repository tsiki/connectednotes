import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTagParentsDialogComponent } from './edit-tag-parents-dialog.component';

describe('EditTagParentsDialogComponent', () => {
  let component: EditTagParentsDialogComponent;
  let fixture: ComponentFixture<EditTagParentsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditTagParentsDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditTagParentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
