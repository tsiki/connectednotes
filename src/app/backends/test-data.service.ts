import { Injectable } from '@angular/core';
import {
  AttachedFile,
  AttachmentMetadata,
  FileMetadata,
  Flashcard,
  NoteObject,
  ParentTagToChildTags,
  StorageBackend,
  UserSettings
} from '../types';
import {BehaviorSubject} from 'rxjs';
import {NotificationService} from '../notification.service';
import {TEST_FLASHCARDS, TEST_NESTED_TAGS, TEST_NOTES} from './test-data';
import {TEXT_MIMETYPE} from '../constants';

@Injectable({
  providedIn: 'root'
})
export class TestDataService implements StorageBackend {

  flashcards = new BehaviorSubject<Flashcard[]>(TEST_FLASHCARDS);
  nestedTagGroups = new BehaviorSubject<ParentTagToChildTags>(TEST_NESTED_TAGS);
  notes = new BehaviorSubject<NoteObject[]>(TEST_NOTES);
  storedSettings = new BehaviorSubject<UserSettings>({});
  attachedFiles: BehaviorSubject<AttachedFile[]>;

  constructor(private notifications: NotificationService) { }

  updateNote(noteId: string, title: string, content: string) {
    const note = this.notes.value.find(n => n.id === noteId);
    note.content = content || note.content;
    note.title = title || note.title;
    this.notes.next(this.notes.value);
    return Promise.resolve();
  }

  deleteNote(noteId: any): Promise<void> {
    const idx = this.notes.value.findIndex(n => n.id === noteId);
    this.notes.value.splice(idx, 1);
    this.notes.next(this.notes.value);
    return Promise.resolve();
  }

  updateFlashcard(fc: Flashcard): Promise<void> {
    const newFc = this.flashcards.value.find(f => f.id === f.id);
    Object.assign(newFc, fc);
    Object.assign(newFc.learningData, fc.learningData);
    this.flashcards.next(this.flashcards.value);
    return Promise.resolve();
  }

  deleteFlashcard(fcId: string): Promise<void> {
    const idx = this.flashcards.value.findIndex(f => f.id === f.id);
    this.flashcards.value.splice(idx, 1);
    this.flashcards.next(this.flashcards.value);
    return Promise.resolve();
  }

  deleteUploadedFile(fileId: string): Promise<void> {
      throw new Error('Method not implemented.');
  }

  addAttachmentToNote(noteId: string, fileId: string, fileName: string, mimeType: string) {
  }

  createFlashcard(fc: Flashcard): Promise<FileMetadata> {
    this.flashcards.value.push(fc);
    this.flashcards.next(this.flashcards.value);
    const curTime = new Date().getTime();
    return Promise.resolve({
      id: Math.random().toString(),
      title: 'fc',
      mimeType: TEXT_MIMETYPE,
      lastChangedEpochMillis: curTime,
      createdEpochMillis: curTime
    });
  }

  createNote(title: string): Promise<FileMetadata> {
    const curTime = new Date().getTime();
    const id = Math.random().toString();
    const note = { id, title, content: '', lastChangedEpochMillis: curTime};
    this.notes.value.push(note);
    this.notes.next(this.notes.value);
    return Promise.resolve({
      id,
      title,
      mimeType: TEXT_MIMETYPE,
      lastChangedEpochMillis: curTime,
      createdEpochMillis: curTime
    });
  }

  initialize(): Promise<void> {
    return Promise.resolve(undefined);
  }

  removeAttachmentFromNote(noteId: string, fileId: string) {
  }

  renameFile(fileId: string, newTitle: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  saveNestedTagGroups(nestedTagGroups: ParentTagToChildTags) {
    this.nestedTagGroups.next(nestedTagGroups);
  }

  saveSettings(settings: UserSettings): Promise<void> {
    return Promise.resolve(undefined);
  }

  shouldUseThisBackend(): Promise<boolean> {
    return Promise.resolve(false);
  }

  uploadFile(content: any, fileType: string, fileName: string): Promise<string> {
    return Promise.resolve('');
  }

  logout() {
  }
}
