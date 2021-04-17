import {ComponentFixture, fakeAsync, flush, flushMicrotasks, TestBed, tick} from '@angular/core/testing';

import { UploadExistingDialogComponent } from './upload-existing-dialog.component';
import {StorageService} from '../storage.service';
import {MatDialogRef} from '@angular/material/dialog';
import {ChangeDetectorRef} from '@angular/core';



const createFile = (fileName: string, fullPath: string, content: string, type: string) => {
  const f = new File([content], fileName, { type });
  (f as any).fullPath = fullPath; // dropzone provided path
  return f;
};


describe('UploadExistingDialogComponent', () => {
  let component: UploadExistingDialogComponent;
  let fixture: ComponentFixture<UploadExistingDialogComponent>;

  let createCounter = 0;
  let uploadCounter = 0;
  const storage = {
    createNote: () => {
      createCounter++;
      return Promise.resolve('fake note ID ' + createCounter);
    },
    uploadFile: () => {
      uploadCounter++;
      return Promise.resolve('file ID ' + uploadCounter);
    },
    saveNote: () => Promise.resolve(),
    notes: {value: []},
    attachedFiles: {value: []},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UploadExistingDialogComponent ],
      providers: [
        { provide: StorageService, useValue: storage },
        { provide: MatDialogRef, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: () => {}}},
      ],
    })
    .compileComponents();
    createCounter = 0;
    uploadCounter = 0;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UploadExistingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should rename notes if duplicate', async (done) => {
    const note1 = new File(['asd [image](img1.jpg) qwe'], 'name', { type: 'text/plain' });
    const note2 = new File(['asd [image](img2.jpg) qwe'], 'name', { type: 'text/plain' });
    component.files = [note1, note2] as any[];
    const createSpy = spyOn(storage, 'createNote').and.callThrough();

    await component.upload();

    expect(createSpy).toHaveBeenCalledTimes(2);
    // @ts-ignore
    expect(createSpy.calls.argsFor(0)).toEqual(['name']);
    // @ts-ignore
    expect(createSpy.calls.argsFor(1)).toEqual(['name (1)']);
    done();
  });

  it('should skip notes with no matching attachment', async (done) => {
    const note = new File(['asd [image](img1.jpg) qwe'], 'name', { type: 'text/plain' });
    component.files = [note] as any[];
    const contentSpy = spyOn(storage, 'saveNote').and.callThrough();
    await component.upload();

    expect(contentSpy).toHaveBeenCalledTimes(1);
    done();
  });
});
