import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {Theme} from "./settings.service";

declare interface NoteFile {
  title: string; // Maps to file name when exported
  content: string;
  lastChangedEpochMillis?: number; // Doesn't exist if the file hasn't been commited yet
  // lastChanged?: FirebaseTimestamp; // Doesn't exist if the file hasn't been commited yet
}

declare interface NoteObject extends NoteFile {
  id: string;
}

declare interface TagGroup {
  tag: string;
  noteIds: string[];
}

interface NotesAndTagGroups {
  tagGroups: TagGroup[];
  notes: NoteObject[];
}


declare interface NoteMetadata {
  id: string;
  title: string;
  lastChangedEpochMillis: number;
}

declare interface FirebaseTimestamp {
  seconds: number;
  nanos: number;
}

declare interface NoteAndLinks {
  noteTitle: string;
  connectedTo: string[];
  lastChanged: number;
}

interface SearchResult {
  segments: HighlightedSegment[];
  noteId: string;
}

interface HighlightedSegment {
  text: string;
  highlighted: boolean;
}

interface DragAndDropImage {
  name: string;
  url: string;
}

interface RenameResult {
  renamedBackRefCount: number;
  renamedNoteCount: number;
  status: Promise<any>;
}

export enum BackendStatusNotificationType {
  POPUP,
  MOLE,
}

interface BackendStatusNotification {
  id: string; // A notification can be overwritten by sending another notification with the same ID
  removeAfterMillis?: number; // If not defined the status stays until overriden
  message: string; // Actual message to be displayed to the user
  type?: BackendStatusNotificationType;
}

interface StorageBackend {
  notes: Subject<NoteObject[]>;
  backendStatusNotifications: Subject<BackendStatusNotification>;
  storedSettings: BehaviorSubject<UserSettings>;
  requestRefreshAllNotes();
  updateSettings(settingKey: string, settingValue: string);
  createNote(title: string): Promise<NoteObject>;
  renameNote(noteId: string, newTitle: string): Promise<void>;
  deleteNote(noteId: string);
  saveContent(noteId: string, content: string, notify: boolean);
  saveImage(image: any, fileType: string, fileName: string): Promise<string>;
  logout();
}

interface UserSettings {
  theme?: Theme;
}
