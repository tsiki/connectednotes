import { Injectable } from '@angular/core';
import {AttachmentMetadata, Flashcard, NoteObject, ParentTagToChildTags, UserSettings} from '../types';
import {BehaviorSubject} from 'rxjs';
import {NotificationService} from '../notification.service';

const NOTE_STORE_NAME = 'notes';
const FLASHCARD_STORE_NAME = 'flashcards';
const SETTINGS_AND_METADATA_STORE_NAME = 'settings_and_metadata';

const SETTINGS_ID = 'settings';
const ATTACHMENT_METADATA_ID = 'attachment_metadata';
const NESTED_TAG_GROUPS_ID = 'parent_tag_to_child_tag';

declare interface KeyValuePair {
  key: string;
  value: any;
}

@Injectable({
  providedIn: 'root'
})
export class InMemoryCache {

  notes: BehaviorSubject<NoteObject[]>;
  flashcards: BehaviorSubject<Flashcard[]>;
  storedSettings: BehaviorSubject<UserSettings>;
  attachmentMetadata: BehaviorSubject<AttachmentMetadata>;
  nestedTagGroups: BehaviorSubject<ParentTagToChildTags>;

  private db;
  private initPromise: Promise<any>;

  constructor(private notifications: NotificationService) {
    this.initializeIndexedDb();
  }

  /** Settings and metadata */

  async upsertSettingsInCache(settings: UserSettings) {
    return this.addOrUpdateKeyValuePair(SETTINGS_ID, settings);
  }

  // TODO: figure out how to update the cache smoothly in case NoteObject structure changes
  //  maybe just run indexedDB.deleteDatabase("ConnectedNotes") or change objectStore name?
  async addOrUpdateNoteInCache(noteId: string, lastChangedEpochMillis: number, title: string, content: string) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(NOTE_STORE_NAME, 'readwrite');
    const notes = transaction.objectStore(NOTE_STORE_NAME);
    const newNote: NoteObject = {
      id: noteId,
      lastChangedEpochMillis,
      title,
      content,
    };

    const putReq = notes.put(newNote);
    return new Promise((resolve, reject) => {
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject();
    });
  }

  // TODO: the caching logic needs some tests
  async deleteNoteFromCache(noteId: string) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(NOTE_STORE_NAME, 'readwrite');
    const notes = transaction.objectStore(NOTE_STORE_NAME);
    notes.delete(noteId);
  }

  async getAllNoteIdToLastChangedTimestamp(): Promise<Map<string, number>> {
    if (!this.db) {
      await this.initPromise;
    }
    const notes = await this.getAllNotesInCache();
    const noteIdToLastChanged = new Map<string, number>();
    for (const {id, lastChangedEpochMillis} of notes) {
      noteIdToLastChanged.set(id, lastChangedEpochMillis);
    }
    return noteIdToLastChanged;
  }

  async getAllNotesInCache(): Promise<NoteObject[]> {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(NOTE_STORE_NAME, 'readwrite');
    const notes = transaction.objectStore(NOTE_STORE_NAME);
    const req = notes.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => {
        resolve(req.result);
      };
      req.onerror = (e) => {
        resolve([]);
      };
    });
  }

  /** Flashcard caching */

  async addOrUpdateFlashcardInCache(flashcardId: string, flashcard: Flashcard) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(FLASHCARD_STORE_NAME, 'readwrite');
    const flashcards = transaction.objectStore(FLASHCARD_STORE_NAME);

    const putReq = flashcards.put(flashcard);
    return new Promise((resolve, reject) => {
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject();
    });
  }

  async deleteFlashcardFromCache(id: string) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(FLASHCARD_STORE_NAME, 'readwrite');
    const flashcards = transaction.objectStore(FLASHCARD_STORE_NAME);
    flashcards.delete(id);
  }

  async getAllFlashcardIdToLastChangedTimestamp(): Promise<Map<string, number>> {
    if (!this.db) {
      await this.initPromise;
    }
    const flashcards = await this.getAllFlashcardsInCache();
    const flashcardIdToLastChanged = new Map<string, number>();
    for (const {id, lastChangedEpochMillis} of flashcards) {
      flashcardIdToLastChanged.set(id, lastChangedEpochMillis);
    }
    return flashcardIdToLastChanged;
  }

  async getAllFlashcardsInCache(): Promise<Flashcard[]> {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(FLASHCARD_STORE_NAME, 'readwrite');
    const flashcards = transaction.objectStore(FLASHCARD_STORE_NAME);
    const req = flashcards.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => {
        resolve(req.result);
      };
      req.onerror = (e) => {
        resolve([]);
      };
    });
  }

  async getSettingsInCache(): Promise<UserSettings> {
    return this.getByKeyFromKeyValuePair(SETTINGS_ID);
  }

  async upsertAttachmentMetadataInCache(settings: UserSettings) {
    return this.addOrUpdateKeyValuePair(ATTACHMENT_METADATA_ID, settings);
  }

  async getAttachmentMetadataInCache(): Promise<UserSettings> {
    return this.getByKeyFromKeyValuePair(ATTACHMENT_METADATA_ID);
  }

  async upsertNestedTagGroupsInCache(nestedTagGroups: ParentTagToChildTags) {
    return this.addOrUpdateKeyValuePair(NESTED_TAG_GROUPS_ID, nestedTagGroups);
  }

  async getNestedTagGroupsInCache(): Promise<UserSettings> {
    return this.getByKeyFromKeyValuePair(NESTED_TAG_GROUPS_ID);
  }

  private initializeIndexedDb() {
    const openRequest = indexedDB.open('ConnectedNotes', 3);
    this.initPromise = new Promise((resolve, reject) => {
      openRequest.onblocked = (unused) => {
        // If some other tab is loaded with the database, then it needs to be closed
        // before we can proceed.
        this.notifications.showFullScreenBlockingMessage(
            'Connected Notes must update. Please close all other tabs with this site open.');
      };
      openRequest.onupgradeneeded = (e) => {
        this.db = openRequest.result;
        if (!this.db.objectStoreNames.contains(NOTE_STORE_NAME)) {
          this.db.createObjectStore(NOTE_STORE_NAME, {keyPath: 'id'});
        }
        if (!this.db.objectStoreNames.contains(FLASHCARD_STORE_NAME)) {
          this.db.createObjectStore(FLASHCARD_STORE_NAME, {keyPath: 'id'});
        }
        if (!this.db.objectStoreNames.contains(SETTINGS_AND_METADATA_STORE_NAME)) {
          this.db.createObjectStore(SETTINGS_AND_METADATA_STORE_NAME, {keyPath: 'key'});
        }
        resolve();
      };
      openRequest.onsuccess = () => {
        this.db = openRequest.result;
        resolve();
      };
      openRequest.onerror = () => {
        reject();
      };
    });
  }

  private async addOrUpdateKeyValuePair(key: string, value: any) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(SETTINGS_AND_METADATA_STORE_NAME, 'readwrite');
    const settingsAndMetadata = transaction.objectStore(SETTINGS_AND_METADATA_STORE_NAME);
    const obj: KeyValuePair = { key, value };
    const putReq = settingsAndMetadata.put(obj);
    return new Promise((resolve, reject) => {
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject();
    });
  }

  private async getByKeyFromKeyValuePair(key: string) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction(SETTINGS_AND_METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SETTINGS_AND_METADATA_STORE_NAME);
    const req = store.get(key);
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => {
        const res: KeyValuePair = req.result;
        resolve(res.value);
      };
      req.onerror = (e) => {
        reject();
      };
    });
  }
}
