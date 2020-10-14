import {ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Backend, NoteService} from '../note.service';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import { SplitAreaDirective } from 'angular-split';
import {SearchDialogComponent} from '../search-dialog/search-dialog.component';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {SettingsComponent} from '../settings/settings.component';
import {BackendStatusNotification} from '../types';
import {SettingsService, Theme} from '../settings.service';
import {NotificationService} from '../notification.service';
import {MatSelect} from '@angular/material/select';
import {FilelistComponent} from '../filelist/filelist.component';
import {ValidateImmediatelyMatcher} from '../already-existing-note.directive';
import {Subview, SubviewManagerService} from '../subview-manager.service';


export enum SortDirection {
  MODIFIED_NEWEST_FIRST,
  MODIFIED_OLDEST_FIRST,
  ALPHABETICAL,
  ALPHABETICAL_REVERSED,
}

@Component({
  selector: 'app-zettelkasten',
  templateUrl: './zettelkasten.component.html',
  animations: [
    trigger('openClose', [
      state('open', style({
        flex: '0 0 {{curWidth}}px',
      }), {params: {curWidth: 300}}),
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
export class ZettelkastenComponent implements OnInit {
  @ViewChild('sidebarArea') sidebarArea: SplitAreaDirective;
  @ViewChild('sidebar') sidebar: ElementRef;
  @ViewChild('sortOptions') sortOptions: MatSelect;
  @ViewChild('filelist') filelist: FilelistComponent;

  theme: Theme;
  sidebarCollapsed: boolean;
  unCollapsedSidebarWidth: number;
  activeStatusUpdates: BackendStatusNotification[] = [];
  currentSortDirection = SortDirection.MODIFIED_NEWEST_FIRST;
  icon: string;

  constructor(
    private readonly route: ActivatedRoute,
    private router: Router,
    private readonly noteService: NoteService,
    readonly subviewManager: SubviewManagerService,
    readonly settingsService: SettingsService,
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private notifications: NotificationService,
    private readonly elRef: ElementRef) { }

  ngOnInit(): void {
    this.subviewManager.somethingOpened.subscribe(() => {
      if (this.elRef.nativeElement.getBoundingClientRect().width < 600 && !this.sidebarCollapsed) {
        this.toggleSidebar();
      }
    });
    this.settingsService.themeSetting.subscribe(newTheme => this.theme = newTheme);

    if (this.router.url.split('?')[0] === '/gd') {
      this.noteService.initialize(Backend.GOOGLE_DRIVE);
    } else {
      this.noteService.initialize(Backend.FIREBASE);
    }

    this.setUpStorageBackendStatusUpdates();

    // this.route.queryParams.subscribe(params => {
    //   // TODO: if we change the noteid in the url and change it back to the old, it might trigger this and overwrite
    //   //  the new version of the note with the old.
    //
    //   // TODO: we need to handle multiple views here!!
    //   if (params.noteid) {
    //     this.subviewManager.openNoteInNewWindow(params.noteId, false);
    //   }
    // });
  }

  onWindowFocus(subview: Subview) {
    this.subviewManager.setActiveSubview(subview);
  }

  private setUpStorageBackendStatusUpdates() {
    this.notifications.sidebar.subscribe(newNotifications => {
      this.activeStatusUpdates = newNotifications;
      this.cdr.detectChanges();
    });
    this.notifications.saveIcon.subscribe(newIcon => this.icon = newIcon);
  }

  logout() {
    this.noteService.logout();
    this.router.navigate(['']);
  }

  toggleSidebar() {
    // Keep track of sidebars width so we can also restore it to its former glory
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
        this.subviewManager.openNoteInActiveWindow(newNoteId);
      }
    });
  }

  openSearchDialog() {
    this.dialog.open(SearchDialogComponent, {position: {top: '10px'}});
  }

  openSettings() {
    this.dialog.open(SettingsComponent, {position: {top: '10px'}});
  }

  openExploreAndLearnView(e) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openExploreAndLearnInNewWindow();
    } else {
      this.subviewManager.openExploreAndLearnInActiveWindow();
    }
  }

  doSort(sortDirection: SortDirection) {
    this.currentSortDirection = sortDirection;
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

  trackByFn(idx: number, subview: Subview) {
    return subview.type === 'note' ? subview.noteId : subview.type;
  }
}

@Component({
  selector: 'app-create-note-dialog',
  template: `
  <mat-form-field>
    <mat-label>Note title</mat-label>
    <input matInput
           [(ngModel)]="noteTitle"
           (keyup.enter)="close()"
           appAlreadyExistingNote
           [errorStateMatcher]="matcher"
           autocomplete="off"
           #name="ngModel">
    <mat-error *ngIf="name.errors?.forbiddenName">
      Note name must be unique
    </mat-error>
  </mat-form-field>`
})
// tslint:disable-next-line:component-class-suffix
export class CreateNoteDialog {
  noteTitle: string;
  matcher = new ValidateImmediatelyMatcher();

  constructor(public dialogRef: MatDialogRef<CreateNoteDialog>) {}

  close() {
    this.dialogRef.close(this.noteTitle.trim());
  }
}
