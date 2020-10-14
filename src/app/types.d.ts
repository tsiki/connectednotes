import {BehaviorSubject} from 'rxjs';
import {Theme} from './settings.service';
import CodeMirror from 'codemirror';

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

declare interface FileMetadata {
  id: string;
  title: string;
  lastChangedEpochMillis: number;
  createdEpochMillis: number;
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

interface MessageStatusNotification {
  id: string; // A notification can be overwritten by sending another notification with the same ID
  message: string; // Actual message to be displayed to the user
}

interface BackendStatusNotification {
  id: string; // A notification can be overwritten by sending another notification with the same ID
  message: string; // Actual message to be displayed to the user
}

interface UserSettings {
  theme?: Theme;
  ignoredTags?: string[];
}

interface AttachmentMetadata {
  [noteId: string]: AttachedFile[];
}

interface AttachedFile {
  name: string;
  fileId: string;
  mimeType: string;
}

interface FlashcardLearningData {
  easinessFactor: number;
  numRepetitions: number;
  prevRepetitionIntervalMillis: number;
  prevRepetitionEpochMillis: number;
}

interface Flashcard {
  id?: string; // Not set if unsaved
  createdEpochMillis?: number; // Not set if unsaved
  lastChangedEpochMillis?: number; // Not set if unsaved
  tags: string[];
  side1: string;
  side2: string;
  isTwoWay: boolean;
  learningData: FlashcardLearningData;
}

// Rule for extracting a flashcard suggestion from text
interface FlashcardSuggestionExtractionRule {
  start: RegExp;
  isStartInclusive?: boolean; // Defaults to false
  end: RegExp;
  isEndInclusive?: boolean; // Defaults to false
  description?: string;
}

interface FlashcardSuggestion {
  text: string;
  start: CodeMirror.Position;
  end: CodeMirror.Position;
}

export enum TextHidingLogic {
  HIDE_EVERYTHING_TO_RIGHT,
  HIDE_EVERYTHING_TO_LEFT,
  HIDE_MATCHING_ONLY,
}

interface FlashcardTextHidingRule {
  matcher: RegExp;
  hidingLogic: TextHidingLogic[];
}

interface StorageBackend {
  notes: BehaviorSubject<NoteObject[]>;
  flashcards: BehaviorSubject<Flashcard[]>;
  storedSettings: BehaviorSubject<UserSettings>;
  attachmentMetadata: BehaviorSubject<AttachmentMetadata>;
  initialize();
  // Loads any javascript needed for the backend to operate (should maybe be combined with 'initialize'?)
  loadScript();
  signInIfNotSignedIn();
  isSignedIn(): Promise<boolean>;
  updateSettings(settingKey: string, settingValue: string|string[]);
  createNote(title: string): Promise<FileMetadata>;
  createFlashcard(fc: Flashcard): Promise<FileMetadata>;
  renameFile(fileId: string, newTitle: string): Promise<void>;
  deleteFile(fileId: string);
  saveContent(fileId: string, content: string, notify: boolean, mimeType: string);
  uploadFile(content: any, fileType: string, fileName: string): Promise<string>;
  addAttachmentToNote(noteId: string, fileId: string, fileName: string, mimeType: string);
  removeAttachmentFromNote(noteId: string, fileId: string);
  logout();
}
