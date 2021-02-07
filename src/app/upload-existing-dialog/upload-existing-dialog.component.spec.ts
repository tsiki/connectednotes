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
    saveContent: () => Promise.resolve(),
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

  // Test cases:
  // 1. replace
  // 2. note name is replaced if its a duplicate
  // 3. note and image with path are replaced correctly

  // Angular fakeASync doesn't support reading files or images so falling back to Jasmine async testing
  it('should replace link', async (done) => {
    const note = new File(['[image](img.jpg)'], 'note name', { type: 'text/plain' });
    const attachment = createFile('img.jpg', 'img.jpg', 'aa', 'image/jpeg');
    component.files = [note, attachment] as any[];
    const spy = spyOn(storage, 'saveContent');

    await component.upload();

    const expectedUrl = StorageService.fileIdToLink('file ID 1');
    // @ts-ignore
    expect(spy.calls.mostRecent().args).toEqual(['fake note ID 1', `[image](${expectedUrl})`]);
    done();
  });

  it('should replace link after ref', async (done) => {
    const note = new File(['[[ref]] [image](img.jpg)'], 'note name', { type: 'text/plain' });
    const attachment = createFile('img.jpg', 'img.jpg', 'aa', 'image/jpeg');
    component.files = [note, attachment] as any[];
    const spy = spyOn(storage, 'saveContent');

    await component.upload();

    const expectedUrl = StorageService.fileIdToLink('file ID 1');
    // @ts-ignore
    expect(spy.calls.mostRecent().args).toEqual(['fake note ID 1', `[[ref]] [image](${expectedUrl})`]);
    done();
  });

  it('should replace multiple links', async (done) => {
    const note = new File(['asdasd [image](img1.jpg) asdasd [image](img2.jpg)'], 'note name',
        { type: 'text/plain' });
    const attachment1 = createFile('img1.jpg', 'img1.jpg', 'aa', 'image/jpeg');
    const attachment2 = createFile('img2.jpg', 'img2.jpg', 'aa', 'image/jpeg');
    component.files = [note, attachment1, attachment2] as any[];
    const saveSpy = spyOn(storage, 'saveContent');
    const uploadSpy = spyOn(storage, 'uploadFile').and.callThrough();

    await component.upload();

    const expectedUrl1 = StorageService.fileIdToLink('file ID 1');
    const expectedUrl2 = StorageService.fileIdToLink('file ID 2');
    expect(saveSpy.calls.mostRecent().args).toEqual(
        // @ts-ignore
        ['fake note ID 1', `asdasd [image](${expectedUrl1}) asdasd [image](${expectedUrl2})`]);
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    done();
  });


  it('should replace multiple links in multiple notes', async (done) => {
    const note1 = new File(['asd [image](img1.jpg) qwe'], 'note name 1', { type: 'text/plain' });
    const note2 = new File(['asd [image](img2.jpg) qwe'], 'note name 2', { type: 'text/plain' });
    const attachment1 = createFile('img1.jpg', 'img1.jpg', 'aa', 'image/jpeg');
    const attachment2 = createFile('img2.jpg', 'img2.jpg', 'aa', 'image/jpeg');
    component.files = [note1, note2, attachment1, attachment2] as any[];
    const spy = spyOn(storage, 'saveContent');

    await component.upload();

    expect(spy.calls.count()).toEqual(2);
    const expectedUrl1 = StorageService.fileIdToLink('file ID 1');
    const expectedUrl2 = StorageService.fileIdToLink('file ID 2');
    // @ts-ignore
    expect(spy.calls.argsFor(0)).toEqual(['fake note ID 1', `asd [image](${expectedUrl1}) qwe`]);
    // @ts-ignore
    expect(spy.calls.argsFor(1)).toEqual(['fake note ID 2', `asd [image](${expectedUrl2}) qwe`]);
    done();
  });

  it('should replace with path', async (done) => {
    const note = createFile('note name', 'path/note name', '[image](to/img.jpg)', 'text/plain');
    const attachment = createFile('img.jpg', 'path/to/img.jpg', 'aa', 'image/jpeg');
    component.files = [note, attachment] as any[];
    const spy = spyOn(storage, 'saveContent');

    await component.upload();

    const expectedUrl = StorageService.fileIdToLink('file ID 1');
    // @ts-ignore
    expect(spy.calls.mostRecent().args).toEqual(['fake note ID 1', `[image](${expectedUrl})`]);
    done();
  });

  it('should replace note names if duplicate', async (done) => {
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
    const contentSpy = spyOn(storage, 'saveContent').and.callThrough();
    await component.upload();

    expect(contentSpy).toHaveBeenCalledTimes(1);
    done();
  });
});
