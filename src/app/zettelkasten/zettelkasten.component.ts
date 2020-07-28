import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AngularFireAuth} from '@angular/fire/auth';
import {Backend, NoteService} from '../note.service';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import * as marked from 'marked';
import {EditorComponent} from '../editor/editor.component';
import {debounceTime} from 'rxjs/operators';
import { SplitAreaDirective } from 'angular-split';
import {SearchDialogComponent} from '../search-dialog/search-dialog.component';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {GoogleDriveService} from '../backends/google-drive.service';
import {SettingsComponent} from '../settings/settings.component';
import {BackendStatusNotification} from '../types';
import {SettingsService, Theme} from '../settings.service';
import {NotificationService} from '../notification.service';


@Component({
  selector: 'app-zettelkasten',
  templateUrl: './zettelkasten.component.html',
  animations: [
    trigger('openClose', [
      state('open', style({
        flex: '0 0 {{curWidth}}px',
      }), {params: {curWidth: 250}}),
      state('closed', style({
        flex: '0 0 50px',
      })),
      transition('open => closed', [
        animate('0.25s')
      ]),
      transition('closed => open', [
        animate('0.25s')
      ]),
    ]),
  ],
})
export class ZettelkastenComponent implements OnInit, AfterViewInit {
  @ViewChild('editor') editor: EditorComponent;
  @ViewChild('markdown') markdown: ElementRef;
  @ViewChild('sidebarArea') sidebarArea: SplitAreaDirective;
  @ViewChild('sidebar') sidebar: ElementRef;

  editorState: 'editor'|'graph'|'split' = 'editor';
  theme: Theme;
  sidebarCollapsed: boolean;
  unCollapsedSidebarWidth: number;
  currentNoteTitle: string;
  activeStatusUpdates: BackendStatusNotification[] = [];
  clearStatusUpdateFns = new Map<string, number>();

  constructor(
    private fireAuth: AngularFireAuth,
    private readonly route: ActivatedRoute,
    private router: Router,
    private readonly noteService: NoteService,
    readonly settingsService: SettingsService,
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private notifications: NotificationService) { }

  ngOnInit(): void {
    this.settingsService.themeSetting.subscribe(newTheme => this.theme = newTheme);

    if (this.router.url === '/gd') {
      this.noteService.initialize(Backend.GOOGLE_DRIVE);
    } else {
      this.noteService.initialize(Backend.FIREBASE);
    }

    this.setUpStorageBackendStatusUpdates();

    // Set up change in selected note
    this.noteService.selectedNote.subscribe(selected => {
      if (selected === null) {
        return;
      }
      if (this.editorState === 'graph') {
        this.editorState = 'editor';
      }
      this.currentNoteTitle = selected.title;
    });
  }

  private setUpStorageBackendStatusUpdates() {
    this.notifications.sidebar.subscribe(newNotifications => {
      this.activeStatusUpdates = newNotifications;
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit() {
    this.editor.contentChange.pipe(debounceTime(100)).subscribe(newContent => {
      if (this.editorState === 'split') {
        // Currently not sanitizing html since you need to be logged into see anything and nothing's shareable
        this.markdown.nativeElement.innerHTML = (marked as any)(newContent);
      }
    });
  }

  logout() {
    this.noteService.logout();
    this.router.navigate(['']);
  }

  toggleSidebar() {
    // Keep track of sidebars size so we can also restore it to its former width
    if (!this.sidebarCollapsed) {
      this.unCollapsedSidebarWidth = this.sidebar.nativeElement.getBoundingClientRect().width;
    }
    setTimeout(() => this.sidebarCollapsed = !this.sidebarCollapsed);
  }

  openNewNoteDialog() {
    const dialogRef = this.dialog.open(CreateNoteDialog);
    dialogRef.afterClosed().subscribe(async result => {
      if (result) { // result is undefined if user didn't create note
        const newNoteId = await this.noteService.createNote(result);
        this.noteService.selectNote(newNoteId);
      }
    });
  }

  openSearchDialog() {
    const dialogRef = this.dialog.open(SearchDialogComponent, {position: {top: '10px'}});
  }

  openSettings() {
    const dialogRef = this.dialog.open(SettingsComponent, {position: {top: '10px'}});
    dialogRef.afterClosed().subscribe(async result => {
      // TODO: this
    });
  }

  openGraphView() {
    this.editorState = 'graph';
    this.noteService.selectNote(null);
  }

  toggleSplitView() {
    if (this.editorState !== 'split') {
      this.editorState = 'split';
      // Needs to be async since markdown isn't inserted into the dom at this point yet
      setTimeout(() => {
        const content = this.editor.getContent();
        this.markdown.nativeElement.innerHTML = (marked as any)(content);
      });
    } else {
      this.editorState = 'editor';
    }
  }

  dragEnd(unit, {sizes}) {
    // nothing here i guess?
  }

  @HostListener('window:keydown', ['$event'])
  shortcutHandler(e) {
    const ctrlPressed = e.ctrlKey || e.metaKey;
    if (e.key === 'f' && ctrlPressed && e.shiftKey) {
      this.openSearchDialog();
    } else if (e.key === 'k' && ctrlPressed) {
      this.openNewNoteDialog();
    }
  }
}

@Component({
  selector: 'app-create-note-dialog',
  template: `
  <mat-form-field>
    <mat-label>Note title</mat-label>
    <input matInput [(ngModel)]="noteTitle" (keyup.enter)="close()">
  </mat-form-field>`
})
// tslint:disable-next-line:component-class-suffix
export class CreateNoteDialog {

  noteTitle: string;

  constructor(public dialogRef: MatDialogRef<CreateNoteDialog>) {}

  close() {
    this.dialogRef.close(this.noteTitle);
  }
}
