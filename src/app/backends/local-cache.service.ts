import { Injectable } from '@angular/core';
import {Flashcard, NoteObject} from '../types';


const NOTE_STORE_NAME = 'notes';
const FLASHCARD_STORE_NAME = 'flashcards';

@Injectable({
  providedIn: 'root'
})
export class LocalCacheService {

  private db;
  private initPromise: Promise<any>;

  constructor() {
    this.initializeIndexedDb();
  }

  private initializeIndexedDb() {
    const openRequest = indexedDB.open('ConnectedNotes', 2);
    this.initPromise = new Promise((resolve, reject) => {
      openRequest.onupgradeneeded = (e) => {
        this.db = openRequest.result;
        if (!this.db.objectStoreNames.contains(NOTE_STORE_NAME)) {
          this.db.createObjectStore(NOTE_STORE_NAME, {keyPath: 'id'});
        }
        if (!this.db.objectStoreNames.contains(FLASHCARD_STORE_NAME)) {
          this.db.createObjectStore(FLASHCARD_STORE_NAME, {keyPath: 'id'});
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
}
