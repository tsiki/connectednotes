import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AttachmentsDialogComponent } from './attachments-dialog.component';

describe('AttachmentsDialogComponent', () => {
  let component: AttachmentsDialogComponent;
  let fixture: ComponentFixture<AttachmentsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AttachmentsDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AttachmentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
