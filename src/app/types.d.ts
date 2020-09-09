import {BehaviorSubject, Subject} from 'rxjs';
import {Theme} from './settings.service';

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
  oldestTimestamp: number;
  newestTimestamp: number;
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
  titleSegments: FormattedSegment[];
  contentSegments: FormattedSegment[][];
  numContentMatches: number;
  noteId: string;
}

interface FormattedSegment {
  text: string;
  highlighted: boolean;
}

interface RenameResult {
  renamedBackRefCount: number;
  renamedNoteCount: number;
  status: Promise<any>;
}

interface BackendStatusNotification {
  id: string; // A notification can be overwritten by sending another notification with the same ID
  message: string; // Actual message to be displayed to the user
}

interface StorageBackend {
  notes: BehaviorSubject<NoteObject[]>;
  storedSettings: BehaviorSubject<UserSettings>;
  attachmentMetadata: BehaviorSubject<AttachmentMetadata>;
  initialize();
  signInIfNotSignedIn();
  isSignedIn(): Promise<boolean>;
  requestRefreshAllNotes();
  updateSettings(settingKey: string, settingValue: string);
  createNote(title: string): Promise<NoteObject>;
  renameFile(noteId: string, newTitle: string): Promise<void>;
  deleteFile(noteId: string);
  saveContent(noteId: string, content: string, notify: boolean);
  uploadFile(content: any, fileType: string, fileName: string): Promise<string>;
  addAttachmentToNote(noteId: string, fileId: string, fileName: string, mimeType: string);
  removeAttachmentFromNote(noteId: string, fileId: string);
  logout();
}

interface UserSettings {
  theme?: Theme;
}

interface AttachmentMetadata {
  [noteId: string]: AttachedFile[];
}

interface AttachedFile {
  name: string;
  fileId: string;
  mimeType: string;
}
