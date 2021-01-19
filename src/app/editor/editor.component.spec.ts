import { ComponentFixture, TestBed } from '@angular/core/testing';
import {EditorComponent} from './editor.component';
import {MatDialog} from '@angular/material/dialog';
import {StorageService} from '../storage.service';
import {SubviewManagerService} from '../subview-manager.service';
import {SettingsService, Theme} from '../settings.service';
import {NotificationService} from '../notification.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {DomSanitizer} from '@angular/platform-browser';
import {BehaviorSubject, Subject} from 'rxjs';
import {MatInputModule} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {MatMenuModule} from '@angular/material/menu';


describe('EditorComponent', () => {
    let component: EditorComponent;
    let fixture: ComponentFixture<EditorComponent>;

    const dialog = { open: () => {} };
    const storage = {  };
    const subviewManager = {
        noteTitleChanged: new Subject(),
        tagChanged: new Subject(),
    };
    const settings = { themeSetting: new BehaviorSubject(Theme.DARK) };
    const notifications = { noteSaved: () => {} };
    const snackBar = {  };
    const sanitizer = {  };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [ EditorComponent ],
            providers: [
                { provide: MatDialog, useValue: dialog },
                { provide: StorageService, useValue: storage },
                { provide: SubviewManagerService, useValue: subviewManager },
                { provide: SettingsService, useValue: settings },
                { provide: NotificationService, useValue: notifications },
                { provide: MatSnackBar, useValue: snackBar },
                { provide: DomSanitizer, useValue: sanitizer },
            ],
            imports: [
                MatInputModule,
                FormsModule,
                MatMenuModule,
            ],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(EditorComponent);
        component = fixture.componentInstance;
        spyOn(component, 'ngOnDestroy').and.callFake(() => {});
    });

    it('should be created', () => {
        expect(component).toBeTruthy();
    });

});
