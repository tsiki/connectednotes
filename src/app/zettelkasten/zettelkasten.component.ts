import {ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Backend, StorageService} from '../storage.service';
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
import {SubviewManagerService, ViewType} from '../subview-manager.service';
import {FlashcardService} from '../flashcard.service';
import {ConfirmationDialogComponent, ConfirmDialogData} from '../confirmation-dialog/confirmation-dialog.component';


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
      }), {params: {curWidth: 250}}),
      state('closed', style({
        flex: '0 0 0px',
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
  viewType = ViewType;
  fullScreenMessage: string;

  constructor(
    private readonly route: ActivatedRoute,
    private router: Router,
    private readonly storage: StorageService,
    readonly flashcardService: FlashcardService,
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
      this.storage.initialize(Backend.GOOGLE_DRIVE);
    } else if (['/test', '/demo'].includes(this.router.url.split('?')[0])) {
      this.dialog.open(ConfirmationDialogComponent, {
        width: '600px',
        data: {
          title: 'Demo',
          message:
              "This is a (mostly) read-only demo of Connected Notes. It's meant for testing the overall flow and "
              + 'structure. Some changes are working (eg. restructuring notes) and some not (eg. creating notes), '
              + 'but all changes will be lost when the page is refreshed.',
          confirmButtonText: 'ok',
        } as ConfirmDialogData,
      });
      this.storage.initialize(Backend.TEST_DATA);
    } else {
      this.storage.initialize(Backend.FIREBASE);
    }

    this.setUpStorageBackendStatusUpdates();
  }

  onWindowFocus(subview: string) {
    this.subviewManager.setActiveSubview(subview);
  }

  private setUpStorageBackendStatusUpdates() {
    this.notifications.sidebar.subscribe(newNotifications => {
      this.activeStatusUpdates = newNotifications;
      this.cdr.detectChanges();
    });
    this.notifications.saveIcon.subscribe(newIcon => this.icon = newIcon);
    this.notifications.fullScreenBlocking.subscribe(msg => {
      this.fullScreenMessage = msg;
    });
  }

  logout() {
    this.storage.logout();
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
        const newNoteId = await this.storage.createNote(result);
        this.subviewManager.openNoteInNewWindow(newNoteId);
      }
    });
  }

  openSearchDialog() {
    this.dialog.open(SearchDialogComponent, {position: {top: '10px'}});
  }

  openSettings() {
    this.dialog.open(SettingsComponent, {position: {top: '10px'}});
  }

  openLearnView(e) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openFlashcardsInNewWindow();
    } else {
      this.subviewManager.openFlashcardsInActiveWindow();
    }
  }

  openGraphView(e) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openGraphInNewWindow();
    } else {
      this.subviewManager.openGraphInActiveWindow();
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

  trackByFn(idx: number, subview: string) {
    return subview;
  }

  getViewType(subview: string): ViewType {
    return SubviewManagerService.getViewType(subview);
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
