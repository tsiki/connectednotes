import {async, ComponentFixture, fakeAsync, flush, TestBed} from '@angular/core/testing';

import {FilelistComponent} from './filelist.component';
import {StorageService} from '../storage.service';
import {ParentTagToChildTags, TagGroup} from '../types';
import {BehaviorSubject} from 'rxjs';
import {NotificationService} from '../notification.service';
import {ROOT_TAG_NAME} from '../constants';
import {By} from '@angular/platform-browser';
import {SubviewManagerService} from '../subview-manager.service';
import {TagGroupComponent} from '../tag-group/tag-group.component';
import {MatDialog} from '@angular/material/dialog';
import {SettingsService} from '../settings.service';
import {MatMenuModule} from '@angular/material/menu';
import {MatIconModule} from '@angular/material/icon';
import {SortDirection} from '../zettelkasten/zettelkasten.component';
import {CdkDragDrop} from '@angular/cdk/drag-drop';

describe('FilelistComponent', () => {
  let component: FilelistComponent;
  let fixture: ComponentFixture<FilelistComponent>;
  let storageService;
  let notifications;
  let subviewManager;

  beforeEach(async(() => {
    const tagGroups = new BehaviorSubject<TagGroup[]>([]);
    storageService = {
      nestedTagGroups: new BehaviorSubject<ParentTagToChildTags>(null),
      tagGroups,
      getTagGroupForTag: tag => tagGroups.value.find(tg => tg.tag === tag),
      getNote: noteId => ({ id: noteId, lastChangedEpochMillis: 0 }),
      addChildTag: () => {},
    };

    notifications = {
      unsaved: new BehaviorSubject<string[]>([]),
      showFullScreenBlockingMessage: () => {},
    };

    subviewManager = {
      activeNotes: new BehaviorSubject<string[]>([]),
    };

    TestBed.configureTestingModule({
      declarations: [
        FilelistComponent,
        TagGroupComponent,
      ],
      imports: [
        MatMenuModule,
        MatIconModule,
      ],
      providers: [
          { provide: StorageService, useValue: storageService },
          { provide: NotificationService, useValue: notifications },
          { provide: SettingsService, useValue: {} },
          { provide: SubviewManagerService, useValue: subviewManager },
          { provide: MatDialog, useValue: {} },
      ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FilelistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should only show tags at the root level which have explicit root as parent or no parents',
      fakeAsync(() => {

    const ptct: ParentTagToChildTags = {
      '#root-tag-implicitly': ['#root-tag-explicitly-attached', '#non-root-tag'],
      [ROOT_TAG_NAME]: ['#root-tag-explicitly-attached'],
    };
    const tagGroups: TagGroup[] = [
      { tag: '#root-tag-implicitly', noteIds: ['id1', 'id2'], newestNoteChangeTimestamp: 0 },
      { tag: '#root-tag-explicitly-attached', noteIds: ['id3', 'id4'], newestNoteChangeTimestamp: 0 },
      { tag: '#non-root-tag', noteIds: ['id5', 'id6'], newestNoteChangeTimestamp: 0 },
    ];
    storageService.nestedTagGroups.next(ptct);
    storageService.tagGroups.next(tagGroups);

    fixture.detectChanges();
    flush();

    // We should only see the root level tags, #non-root-tag is hidden by *ngIf
    const rootTagGroups = fixture.debugElement.queryAll(By.css('app-tag-group'));
    expect(rootTagGroups.length).toBe(3);

    // Then expand everything and check that the we have the right number of child tags
    for (const tg of rootTagGroups) {
      tg.componentInstance.expanded = true;
    }
    fixture.detectChanges();
    flush();
    const tagGroupsAfterExpanding = fixture.debugElement.queryAll(By.css('app-tag-group'));
    expect(tagGroupsAfterExpanding.length).toBe(5);
  }));

  it('should sort tags', fakeAsync(() => {
    const tagGroups: TagGroup[] = [
      { tag: '#rt1', noteIds: ['id1', 'id2'], newestNoteChangeTimestamp: 1 },
      { tag: '#rt2', noteIds: ['id3', 'id4'], newestNoteChangeTimestamp: 2 },
      { tag: '#rt3', noteIds: ['id5', 'id6'], newestNoteChangeTimestamp: 4 },
      { tag: '#rt4', noteIds: ['id5', 'id6'], newestNoteChangeTimestamp: 3 },
    ];
    storageService.nestedTagGroups.next({});
    storageService.tagGroups.next(tagGroups);

    // Default sorting is SortDirection.MODIFIED_NEWEST_FIRST
    fixture.detectChanges();
    flush();
    let rootTagGroups = fixture.debugElement.queryAll(By.css('app-tag-group'));
    let tags = rootTagGroups
        .filter(tf => !tf.componentInstance.isRootTagGroup)
        .map(tg => tg.componentInstance.tag);
    expect(tags).toEqual(['#rt3', '#rt4', '#rt2', '#rt1']);

    fixture.componentInstance.sortDirection = SortDirection.MODIFIED_OLDEST_FIRST;
    fixture.detectChanges();
    flush();
    rootTagGroups = fixture.debugElement.queryAll(By.css('app-tag-group'));
    tags = rootTagGroups
        .filter(tf => !tf.componentInstance.isRootTagGroup)
        .map(tg => tg.componentInstance.tag);
    expect(tags).toEqual(['#rt1', '#rt2', '#rt4', '#rt3']);

    fixture.componentInstance.sortDirection = SortDirection.ALPHABETICAL;
    fixture.detectChanges();
    flush();
    rootTagGroups = fixture.debugElement.queryAll(By.css('app-tag-group'));
    tags = rootTagGroups
        .filter(tf => !tf.componentInstance.isRootTagGroup)
        .map(tg => tg.componentInstance.tag);
    expect(tags).toEqual(['#rt1', '#rt2', '#rt3', '#rt4']);

    fixture.componentInstance.sortDirection = SortDirection.ALPHABETICAL_REVERSED;
    fixture.detectChanges();
    flush();
    rootTagGroups = fixture.debugElement.queryAll(By.css('app-tag-group'));
    tags = rootTagGroups
        .filter(tf => !tf.componentInstance.isRootTagGroup)
        .map(tg => tg.componentInstance.tag);
    expect(tags).toEqual(['#rt4', '#rt3', '#rt2', '#rt1']);
  }));

  it('should sort notes', fakeAsync(() => {
    const tagGroups: TagGroup[] = [
      { tag: '#rt', noteIds: ['id1', 'id2', 'id3', 'id4'], newestNoteChangeTimestamp: 0 },
    ];
    storageService.getNote = noteId => {
      switch (noteId) {
        case 'id1':
          return { id: noteId, title: noteId, lastChangedEpochMillis: 1 };
        case 'id2':
          return { id: noteId, title: noteId, lastChangedEpochMillis: 4 };
        case 'id3':
          return { id: noteId, title: noteId, lastChangedEpochMillis: 3 };
        case 'id4':
          return { id: noteId, title: noteId, lastChangedEpochMillis: 2 };
      }
    };
    storageService.nestedTagGroups.next({});
    storageService.tagGroups.next(tagGroups);

    fixture.detectChanges();
    flush();

    const allTags = fixture.debugElement.queryAll(By.css('app-tag-group'));
    const rootTag = allTags.filter(tf => !tf.componentInstance.isRootTagGroup)[0];
    rootTag.componentInstance.expanded = true;
    fixture.detectChanges();
    flush();
    expect(rootTag.componentInstance.noteIds).toEqual(['id2', 'id3', 'id4', 'id1']);

    fixture.componentInstance.sortDirection = SortDirection.MODIFIED_OLDEST_FIRST;
    fixture.detectChanges();
    flush();
    expect(rootTag.componentInstance.noteIds).toEqual(['id1', 'id4', 'id3', 'id2']);

    fixture.componentInstance.sortDirection = SortDirection.ALPHABETICAL;
    fixture.detectChanges();
    flush();
    expect(rootTag.componentInstance.noteIds).toEqual(['id1', 'id2', 'id3', 'id4']);

    fixture.componentInstance.sortDirection = SortDirection.ALPHABETICAL_REVERSED;
    fixture.detectChanges();
    flush();
    expect(rootTag.componentInstance.noteIds).toEqual(['id4', 'id3', 'id2', 'id1']);
  }));

  it('should create nested tags when one is drag and dropped over another', fakeAsync(() => {
    storageService.nestedTagGroups.next({});
    storageService.tagGroups.next([]);

    fixture.componentInstance.forTesting.setLastChildTagDragged('#rt1');
    fixture.componentInstance.forTesting.setLastParentTagDragged('#rt2');

    const spy = spyOn(storageService, 'addChildTag');
    fixture.componentInstance.nestTags({ isPointerOverContainer: true } as CdkDragDrop<unknown>);
    expect(spy.calls.mostRecent().args).toEqual(['#rt2', '#rt1']);
  }));
});
