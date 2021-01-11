import { Injectable } from '@angular/core';
import {
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

@Injectable({
  providedIn: 'root'
})
export class TestDataService implements StorageBackend {

  attachmentMetadata = new BehaviorSubject<AttachmentMetadata>({});
  flashcards = new BehaviorSubject<Flashcard[]>(TEST_FLASHCARDS);
  nestedTagGroups = new BehaviorSubject<ParentTagToChildTags>(TEST_NESTED_TAGS);
  notes = new BehaviorSubject<NoteObject[]>(TEST_NOTES);
  storedSettings = new BehaviorSubject<UserSettings>({});

  constructor(private notifications: NotificationService) { }

  addAttachmentToNote(noteId: string, fileId: string, fileName: string, mimeType: string) {
  }

  createFlashcard(fc: Flashcard): Promise<FileMetadata> {
    return Promise.resolve(undefined);
  }

  createNote(title: string): Promise<FileMetadata> {
    return Promise.resolve(undefined);
  }

  deleteFile(fileId: string) {
  }

  initialize(): Promise<void> {
    return Promise.resolve(undefined);
  }

  removeAttachmentFromNote(noteId: string, fileId: string) {
  }

  renameFile(fileId: string, newTitle: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  saveContent(fileId: string, content: string, notify: boolean, mimeType: string) {
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
